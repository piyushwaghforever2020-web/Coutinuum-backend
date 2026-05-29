const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { sequelize } = require('../models');
const env = require('../config/env');
const participantRepository = require('../repositories/participant.repository');
const seatRepository = require('../repositories/seat.repository');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const buildParticipantSession = (participant) =>
  jwt.sign(
    {
      email: participant.email,
      role: 'participant',
      participantId: Number(participant.id),
      employerUserId: null,
      sponsorshipId: null,
      cohortId: Number(participant.cohortId),
      purpose: 'participant_login'
    },
    env.magicLink.secret,
    {
      expiresIn: env.jwtExpiresIn,
      subject: String(participant.email)
    }
  );

const mapParticipantUser = (participant) => ({
  id: Number(participant.id),
  email: participant.email,
  name: participant.name,
  cohort_id: Number(participant.cohortId),
  program_id: participant.programId ? Number(participant.programId) : null,
  payment_status: participant.paymentStatus,
  registration_status: participant.registrationStatus,
  must_change_password: Boolean(participant.mustChangePassword)
});

class ParticipantAuthService {
  async login({ email, password, cohort_id: cohortId }) {
    const normalizedEmail = normalizeEmail(email);
    const participant = cohortId
      ? await participantRepository.findByEmailAndCohort(normalizedEmail, cohortId)
      : await participantRepository.findByEmail(normalizedEmail);

    if (!participant || !participant.passwordHash) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password.');
    }

    if (!participant.isActive || participant.paymentStatus !== 'paid') {
      throw new ApiError(
        HTTP_STATUS.FORBIDDEN,
        'Participant access is not active for this cohort.'
      );
    }

    const isPasswordValid = await bcrypt.compare(password, participant.passwordHash);
    if (!isPasswordValid) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid email or password.');
    }

    await participantRepository.update(participant, { lastLoginAt: new Date() });

    return {
      session_token: buildParticipantSession(participant),
      user: mapParticipantUser(participant),
      redirect_url: Boolean(participant.mustChangePassword)
        ? `/auth/participant/change-password`
        : `/cohort/${participant.cohortId}`
    };
  }

  async changePassword({ participantId, current_password: currentPassword, new_password: newPassword }) {
    const result = await sequelize.transaction(async (transaction) => {
      const participant = await participantRepository.findById(participantId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Participant
        }
      });

      if (!participant) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found.');
      }

      if (!participant.passwordHash) {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Password has not been generated yet.');
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, participant.passwordHash);
      if (!isPasswordValid) {
        throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Current password is invalid.');
      }

      const passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);
      await participantRepository.update(
        participant,
        {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date()
        },
        { transaction }
      );

      const seat = await seatRepository.findByParticipantAndCohort(
        participant.id,
        participant.cohortId,
        {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Seat
          }
        }
      );

      if (seat && seat.status === 'assigned') {
        await seatRepository.update(
          seat,
          {
            status: 'active',
            activatedAt: new Date()
          },
          { transaction }
        );
      }

      return participant;
    });

    return {
      session_token: buildParticipantSession(result),
      user: {
        ...mapParticipantUser(result),
        must_change_password: false
      },
      redirect_url: `/cohort/${result.cohortId}`
    };
  }

  async setPassword({ token, new_password: newPassword }) {
    const magicLinkService = require('./magicLink.service');

    const verifyResult = await magicLinkService.verifyMagicLink(token, {
      expectedPurpose: 'set_password',
      expectedRole: 'participant'
    });

    const participantId = verifyResult.user.participantId;
    if (!participantId) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Participant ID not found in magic link.'
      );
    }

    const result = await sequelize.transaction(async (transaction) => {
      const participant = await participantRepository.findById(participantId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Participant
        }
      });

      if (!participant) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found.');
      }

      // Hash the new password
      const passwordHash = await bcrypt.hash(newPassword, env.bcryptSaltRounds);

      // Update participant: set password, mark setup complete, activate seat if needed
      await participantRepository.update(
        participant,
        {
          passwordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date()
        },
        { transaction }
      );

      // If participant has an assigned seat, activate it
      const seat = await seatRepository.findByParticipantAndCohort(
        participant.id,
        participant.cohortId,
        {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Seat
          }
        }
      );

      if (seat && seat.status === 'assigned') {
        await seatRepository.update(
          seat,
          {
            status: 'active',
            activatedAt: new Date()
          },
          { transaction }
        );
      }

      return participant;
    });

    return {
      session_token: buildParticipantSession(result),
      user: {
        ...mapParticipantUser(result),
        must_change_password: false
      },
      redirect_url: `/cohort/${result.cohortId}`
    };
  }
}

module.exports = new ParticipantAuthService();
