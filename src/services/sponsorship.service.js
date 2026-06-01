const bcrypt = require('bcrypt');
const { sequelize } = require('../models');
const env = require('../config/env');
const cohortRepository = require('../repositories/cohort.repository');
const participantRepository = require('../repositories/participant.repository');
const paymentRepository = require('../repositories/payment.repository');
const seatRepository = require('../repositories/seat.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const employerUserRepository = require('../repositories/employerUser.repository');
const sponsorshipRepository = require('../repositories/sponsorship.repository');
const magicLinkService = require('./magicLink.service');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');
const { getRegistrationStatusFromPaymentStatus } = require('../utils/participantStatus');
const {
  sendEmployerSponsorshipRegistrationAckEmail,
  sendMagicLinkEmail,
  sendParticipantLoginCredentialsEmail,
  sendSponsorshipRegistrationNotification
} = require('../utils/helpers');
const { generateTemporaryPassword } = require('../utils/password');

const normalizeEmail = (email) => String(email).trim().toLowerCase();

const normalizeOptionalMessage = (message) => {
  const trimmed = typeof message === 'string' ? message.trim() : '';
  return trimmed.length ? trimmed : null;
};

const parseStoredPrice = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const numericMatch = String(value ?? '')
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/);

  return numericMatch ? Number(numericMatch[0]) : NaN;
};

const getProgramId = (payload) => payload.program_id ?? payload.programm_id ?? null;

const ensureProgramBelongsToCohort = (cohort, programId) => {
  if (!programId) {
    return;
  }

  const hasProgram = (cohort.programs || []).some(
    (program) => Number(program.id) === Number(programId)
  );

  if (!hasProgram) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'Selected program is not available for this cohort.'
    );
  }
};

const getCohortStatusForSeatCount = (cohort, seatsFilled) =>
  cohort.status === 'closed'
    ? 'closed'
    : Number(seatsFilled) >= Number(cohort.seatLimit)
      ? 'full'
      : 'active';

const isProgramFullForSeatCount = (programMapping, seatsFilled) =>
  Number(programMapping.allocatedSeats) > 0 &&
  Number(seatsFilled) >= Number(programMapping.allocatedSeats);

const buildParticipantLoginUrl = (participant) =>
  `${env.frontendUrl}/auth/participant/login?email=${encodeURIComponent(
    participant.email
  )}&cohort_id=${participant.cohortId}`;

const mapSeat = (seat) => ({
  id: Number(seat.id),
  sponsorship_id: seat.sponsorshipId ? Number(seat.sponsorshipId) : null,
  status: seat.status,
  participant_id: seat.participantId ? Number(seat.participantId) : null,
  participant_email: seat.participantEmail || null,
  assigned_email: seat.assignedEmail || null,
  assigned_at: seat.assignedAt,
  activated_at: seat.activatedAt,
  participant: seat.participant
    ? {
        id: Number(seat.participant.id),
        name: seat.participant.name,
        email: seat.participant.email,
        must_change_password: Boolean(seat.participant.mustChangePassword)
      }
    : null
});

const mapDashboard = (sponsorship, aggregate = {}) => {
  const sponsorships = aggregate.sponsorships || [sponsorship];
  const seats = (aggregate.seats || sponsorship.seats || []).map(mapSeat);
  const totalSeats = sponsorships.reduce(
    (total, item) => total + Number(item.totalSeats || 0),
    0
  );
  const usedSeats = sponsorships.reduce(
    (total, item) => total + Number(item.usedSeats || 0),
    0
  );
  const amount = sponsorships.reduce(
    (total, item) => total + Number(item.amount || 0),
    0
  );
  const seatCounts = seats.reduce(
    (counts, seat) => {
      counts[seat.status] = (counts[seat.status] || 0) + 1;
      return counts;
    },
    {}
  );

  return {
    sponsorship: {
      id: Number(sponsorship.id),
      status: sponsorship.status,
      total_seats: totalSeats,
      used_seats: usedSeats,
      available_seats: seatCounts.available || 0,
      locked_seats: seatCounts.locked || 0,
      assigned_seats: seatCounts.assigned || 0,
      active_seats: seatCounts.active || 0,
      amount,
      currency: sponsorship.currency,
      paid_at: sponsorship.paidAt,
      invoice_due_at: sponsorship.invoiceDueAt,
      hosted_invoice_url: sponsorship.hostedInvoiceUrl,
      invoice_pdf_url: sponsorship.invoicePdfUrl,
      cohort: sponsorship.cohort
        ? {
            id: Number(sponsorship.cohort.id),
            name: sponsorship.cohort.name,
            status: sponsorship.cohort.status
          }
        : null,
      program: sponsorship.program
        ? {
            id: Number(sponsorship.program.id),
            name: sponsorship.program.name
          }
        : null,
      employer: sponsorship.employer
        ? {
            id: Number(sponsorship.employer.id),
            name: sponsorship.employer.name,
            email: sponsorship.employer.email,
            company_name: sponsorship.employer.companyName
          }
        : null
    },
    read_only: sponsorship.status !== 'paid',
    payment_panel: {
      status: sponsorship.status,
      hosted_invoice_url: sponsorship.hostedInvoiceUrl,
      invoice_pdf_url: sponsorship.invoicePdfUrl,
      amount: Number(sponsorship.amount || 0),
      currency: sponsorship.currency,
      due_at: sponsorship.invoiceDueAt
    }
  };
};

const ensureEmployerAccess = (sponsorship, user) => {
  if (
    !user ||
    user.role !== 'employer' ||
    !user.employerUserId ||
    Number(sponsorship.employerUserId) !== Number(user.employerUserId)
  ) {
    throw new ApiError(HTTP_STATUS.FORBIDDEN, 'You do not have access to this sponsorship.');
  }
};

const syncPaidSeatCounts = async ({ cohort, participant, transaction }) => {
  const seatsFilled = await participantRepository.countEnrolledByCohort(cohort.id, {
    transaction
  });

  await cohortRepository.update(
    cohort,
    {
      seatsFilled,
      status: getCohortStatusForSeatCount(cohort, seatsFilled)
    },
    { transaction }
  );

  if (!participant.programId) {
    return;
  }

  const programMapping = await cohortRepository.findProgramMapping(
    cohort.id,
    participant.programId,
    {
      transaction,
      lock: {
        level: transaction.LOCK.UPDATE,
        of: sequelize.models.CohortProgram
      }
    }
  );

  if (programMapping) {
    const programSeatsFilled =
      await participantRepository.countEnrolledByCohortAndProgram(
        cohort.id,
        participant.programId,
        { transaction }
      );

    await cohortRepository.updateProgramMapping(
      programMapping,
      {
        seatsFilled: programSeatsFilled,
        isFull: isProgramFullForSeatCount(programMapping, programSeatsFilled)
      },
      { transaction }
    );
  }
};

class SponsorshipService {
 
  async createBlockSponsorship(payload) {
    const employerEmail = normalizeEmail(payload.employer_email);
    const programId = getProgramId(payload);
    const totalSeats = Number(payload.total_seats);
    const employerMessage = normalizeOptionalMessage(payload.message);

    const cohort = await cohortRepository.findActiveById(payload.cohort_id);
    if (!cohort) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
    }

   if (cohort.syncStatus === 'closed' || cohort.syncStatus === 'full' || cohort.syncStatus === 'draft' || cohort.syncStatus === 'inactive') {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        'This cohort is not accepting sponsorship bookings.'
      );
    }

    const initiallyReservedSeats =
      await seatRepository.countEffectiveReservedCapacityByCohort(cohort.id);
    // If available seats are less than requested seats, block the sponsorship.
    if(Number(cohort.seatLimit) - Number(initiallyReservedSeats) < totalSeats){
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        'Only ' + (Number(cohort.seatLimit) - Number(initiallyReservedSeats)) + ' seats are available in this cohort. Please reduce the number of seats requested or choose a different cohort.'
      );
    }

    ensureProgramBelongsToCohort(cohort, programId);

    const cohortPrice = parseStoredPrice(cohort.price);

    if (!Number.isFinite(cohortPrice) || cohortPrice <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid cohort price.');
    }

    const amount = Number((cohortPrice * totalSeats).toFixed(2));

    let employerUser;
    let sponsorship;

    await sequelize.transaction(async (transaction) => {
      const lockedCohort = await sequelize.models.Cohort.findByPk(cohort.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Cohort
        }
      });

      if (!lockedCohort || !lockedCohort.isActive || lockedCohort.status === 'closed') {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'This cohort is not accepting sponsorship bookings.'
        );
      }

      const reservedSeats = await seatRepository.countEffectiveReservedCapacityByCohort(
        lockedCohort.id,
        {},
        { transaction }
      );

      if (reservedSeats + totalSeats > Number(lockedCohort.seatLimit)) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Not enough cohort seats are available.');
      }

      if (programId) {
        const programMapping = await cohortRepository.findProgramMapping(
          lockedCohort.id,
          programId,
          {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.CohortProgram
            }
          }
        );

        if (!programMapping) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Selected program is not available for this cohort.'
          );
        }

        const reservedProgramSeats =
          await seatRepository.countEffectiveReservedCapacityByCohortAndProgram(
          lockedCohort.id,
          programId,
          {},
          { transaction }
        );

        if (
          Number(programMapping.allocatedSeats) > 0 &&
          reservedProgramSeats + totalSeats > Number(programMapping.allocatedSeats)
        ) {
          throw new ApiError(HTTP_STATUS.CONFLICT, 'Not enough program seats are available.');
        }
      }

      employerUser = await employerUserRepository.findOrCreateByEmail(
        {
          email: employerEmail,
          name: payload.employer_name,
          companyName: payload.company_name || null
        },
        { transaction }
      );

      sponsorship = await sponsorshipRepository.create(
        {
          employerUserId: employerUser.id,
          cohortId: lockedCohort.id,
          programId,
          status: 'invoice_requested',
          totalSeats,
          usedSeats: 0,
          amount,
          currency: env.stripe.currency,
          sponsershipCategory: 'block_seats',
          message: employerMessage,
          invoiceDueAt: null
        },
        { transaction }
      );

      const seatRows = Array.from({ length: totalSeats }, () => ({
        cohortId: lockedCohort.id,
        programId,
        sponsorshipId: sponsorship.id,
        status: 'locked',
        lockedAt: new Date(),
        holdExpiresAt: null
      }));

      await seatRepository.bulkCreate(seatRows, { transaction });
    });

    let invoice;
    await sequelize.transaction(async (transaction) => {
      const lockedSponsorship = await sponsorshipRepository.findPlainById(sponsorship.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Sponsorship
        }
      });

      invoice = await invoiceRepository.create(
        {
          employerUserId: employerUser.id,
          sponsorshipId: sponsorship.id,
          cohortId: cohort.id,
          isManualInvoice: true,
          managerName: payload.employer_name,
          managerEmail: employerEmail,
          amount,
          currency: env.stripe.currency,
          status: 'invoice_requested',
          sentAt: new Date()
        },
        { transaction }
      );

      await sponsorshipRepository.update(
        lockedSponsorship,
        {
          status: 'invoice_requested',
          invoiceId: invoice.id
        },
        { transaction }
      );
    });

    try {
      await sendEmployerSponsorshipRegistrationAckEmail({
        employerEmail,
        employerName: payload.employer_name,
        cohortName: cohort.name,
        totalSeats
      });
    } catch (error) {
      console.error('[Sponsorship] Employer acknowledgement email failed:', error.message);
    }

    try {
      await sendSponsorshipRegistrationNotification({
        adminEmail: env.sponsorshipAdminNotificationEmail,
        employerEmail,
        employerName: payload.employer_name,
        companyName: payload.company_name || null,
        cohortName: cohort.name,
        totalSeats,
        amount,
        currency: env.stripe.currency,
        message: employerMessage
      });
    } catch (error) {
      console.error('[Sponsorship] Admin notification email failed:', error.message);
    }

    return {
      sponsorship_id: Number(sponsorship.id),
      employer_user_id: Number(employerUser.id),
      invoice_id: Number(invoice.id),
      status: 'invoice_requested',
      total_seats: totalSeats,
      amount,
      currency: env.stripe.currency,
      dashboard_login_sent: false
    };
  }

  async markSponsorshipAsPaid(sponsorshipId, adminUser) {
    const terminalStatuses = ['failed', 'voided', 'cancelled'];
    const payableStatuses = ['invoice_requested', 'pending_payment'];

    let result;

    await sequelize.transaction(async (transaction) => {
      const sponsorship = await sponsorshipRepository.findPlainById(sponsorshipId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Sponsorship
        }
      });

      if (!sponsorship) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
      }

      if (sponsorship.status === 'paid') {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Sponsorship is already marked as paid.');
      }

      if (terminalStatuses.includes(sponsorship.status)) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          `Cannot mark sponsorship as paid while status is ${sponsorship.status}.`
        );
      }

      if (!payableStatuses.includes(sponsorship.status)) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          `Sponsorship cannot be marked as paid from status ${sponsorship.status}.`
        );
      }

      const invoice = await invoiceRepository.findBySponsorshipId(sponsorship.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Invoice
        }
      });

      const paidAt = new Date();

      await sponsorshipRepository.update(
        sponsorship,
        {
          status: 'paid',
          paidAt
        },
        { transaction }
      );

      if (invoice) {
        await invoiceRepository.update(
          invoice,
          {
            status: 'paid',
            paidAt
          },
          { transaction }
        );
      }

      const [seatsUnlocked] = await sequelize.models.Seat.update(
        {
          status: 'available',
          holdExpiresAt: null
        },
        {
          where: {
            sponsorshipId: sponsorship.id,
            status: 'locked'
          },
          transaction
        }
      );

      result = {
        sponsorship_id: Number(sponsorship.id),
        invoice_id: invoice ? Number(invoice.id) : null,
        status: 'paid',
        seats_unlocked: seatsUnlocked,
        dashboard_login_sent: false
      };
    });

    const sponsorship = await sponsorshipRepository.findById(sponsorshipId);
    const employer = sponsorship?.employer;

    if (employer) {
      try {
        const magicLink = await magicLinkService.generateMagicLink({
          email: employer.email,
          role: 'employer',
          employerUserId: employer.id,
          sponsorshipId: sponsorship.id,
          cohortId: sponsorship.cohortId,
          purpose: 'dashboard_access'
        });

        await sendMagicLinkEmail({
          email: employer.email,
          name: employer.name,
          magicLinkUrl: magicLink.magicLinkUrl
        });

        result.dashboard_login_sent = true;
      } catch (error) {
        console.error('[Sponsorship] Dashboard magic link email failed:', error.message);
      }
    }

    console.info('[Admin] Sponsorship marked paid', {
      sponsorshipId: result.sponsorship_id,
      adminId: adminUser?.id || null
    });

    return result;
  }

  async getEmployerDashboard(sponsorshipId, user) {
    const sponsorship = await sponsorshipRepository.findById(sponsorshipId);

    if (!sponsorship) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
    }

    ensureEmployerAccess(sponsorship, user);

    const [sponsorships, seats] = await Promise.all([
      sponsorshipRepository.findAllByEmployerAndCohort(
        sponsorship.employerUserId,
        sponsorship.cohortId
      ),
      seatRepository.findAllByEmployerAndCohort(sponsorship.employerUserId, sponsorship.cohortId)
    ]);

    return mapDashboard(sponsorship, { sponsorships, seats });
  }

  async getEmployerSeats(sponsorshipId, user) {
    const sponsorship = await sponsorshipRepository.findPlainById(sponsorshipId);

    if (!sponsorship) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
    }

    ensureEmployerAccess(sponsorship, user);

    const [sponsorships, seats] = await Promise.all([
      sponsorshipRepository.findAllByEmployerAndCohort(
        sponsorship.employerUserId,
        sponsorship.cohortId
      ),
      seatRepository.findAllByEmployerAndCohort(sponsorship.employerUserId, sponsorship.cohortId)
    ]);
    const totalSeats = sponsorships.reduce(
      (total, item) => total + Number(item.totalSeats || 0),
      0
    );
    const usedSeats = sponsorships.reduce(
      (total, item) => total + Number(item.usedSeats || 0),
      0
    );

    return {
      sponsorship_id: Number(sponsorship.id),
      total_seats: totalSeats,
      used_seats: usedSeats,
      read_only: sponsorship.status !== 'paid',
      seats: seats.map(mapSeat)
    };
  }

  async assignSeat(sponsorshipId, seatId, payload, user) {
    const participantEmail = normalizeEmail(payload.participant_email);
    let emailPayload = null;
    let response = null;

    await sequelize.transaction(async (transaction) => {
      const anchorSponsorship = await sponsorshipRepository.findPlainById(sponsorshipId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Sponsorship
        }
      });

      if (!anchorSponsorship) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
      }

      ensureEmployerAccess(anchorSponsorship, user);

      const seat = await seatRepository.findByEmployerCohortAndId(
        anchorSponsorship.employerUserId,
        anchorSponsorship.cohortId,
        seatId,
        {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Seat
          }
        }
      );

      if (!seat) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Seat not found for this sponsorship.');
      }

      const sponsorship = await sponsorshipRepository.findPlainById(seat.sponsorshipId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Sponsorship
        }
      });

      if (
        !sponsorship ||
        Number(sponsorship.employerUserId) !== Number(anchorSponsorship.employerUserId) ||
        Number(sponsorship.cohortId) !== Number(anchorSponsorship.cohortId)
      ) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Seat not found for this sponsorship.');
      }

      if (sponsorship.status !== 'paid') {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'Sponsorship invoice must be paid before assigning seats.'
        );
      }

      if (seat.status !== 'available') {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'This seat is not available for assignment.');
      }

      const cohort = await sequelize.models.Cohort.findByPk(sponsorship.cohortId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Cohort
        }
      });

      if (!cohort || !cohort.isActive || cohort.status === 'closed') {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Cohort is not active for assignment.');
      }

      let participant = await participantRepository.findByEmailAndCohort(
        participantEmail,
        sponsorship.cohortId,
        {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Participant
          }
        }
      );

      if (participant?.paymentStatus === 'paid') {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Participant is already enrolled in this cohort.');
      }

      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, env.bcryptSaltRounds);
      const passwordGeneratedAt = new Date();

      const participantPayload = {
        name: payload.participant_name,
        email: participantEmail,
        phone: payload.phone || null,
        company: payload.company || null,
        role: payload.role || null,
        cohortId: sponsorship.cohortId,
        programId: sponsorship.programId,
        answers: payload.answers ?? null,
        agreeEmail: true,
        agreeSms: false,
        employerFunded: true,
        paymentType: 'employer_funded',
        billingManagerName: user.email,
        billingManagerEmail: user.email,
        paymentStatus: 'paid',
        registrationStatus: getRegistrationStatusFromPaymentStatus('paid'),
        passwordHash,
        passwordGeneratedAt,
        mustChangePassword: true,
        passwordChangedAt: null,
        isActive: true
      };

      if (!participant) {
        participant = await participantRepository.create(participantPayload, { transaction });
      } else {
        await participantRepository.update(participant, participantPayload, { transaction });
      }

      const perSeatAmount = Number(
        (Number(sponsorship.amount || 0) / Number(sponsorship.totalSeats)).toFixed(2)
      );

      const existingPayment = await paymentRepository.findLatestByParticipantAndCohort(
        participant.id,
        sponsorship.cohortId,
        {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Payment
          }
        }
      );

      const paymentPayload = {
        participantId: participant.id,
        cohortId: sponsorship.cohortId,
        amount: perSeatAmount,
        status: 'paid',
        paymentMethod: 'stripe_invoice',
        transactionId: `sponsorship:${sponsorship.id}:seat:${seat.id}`,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        stripeInvoiceId: null,
        invoiceId: sponsorship.invoiceId,
        checkoutUrl: sponsorship.hostedInvoiceUrl,
        completedAt: sponsorship.paidAt || new Date()
      };

      if (existingPayment && existingPayment.status !== 'paid') {
        await paymentRepository.update(existingPayment, paymentPayload, { transaction });
      } else if (!existingPayment) {
        await paymentRepository.create(paymentPayload, { transaction });
      }

      await seatRepository.update(
        seat,
        {
          participantId: participant.id,
          participantEmail,
          assignedEmail: participantEmail,
          status: 'assigned',
          assignedAt: new Date(),
          activatedAt: null
        },
        { transaction }
      );

      const usedSeats = await seatRepository.countUsedBySponsorship(sponsorship.id, {
        transaction
      });

      await sponsorshipRepository.update(
        sponsorship,
        {
          usedSeats
        },
        { transaction }
      );

      const groupSponsorships = await sponsorshipRepository.findAllByEmployerAndCohort(
        sponsorship.employerUserId,
        sponsorship.cohortId,
        { transaction }
      );
      const groupTotalSeats = groupSponsorships.reduce(
        (total, item) => total + Number(item.totalSeats || 0),
        0
      );
      const groupUsedSeats = groupSponsorships.reduce(
        (total, item) => total + Number(item.usedSeats || 0),
        0
      );

      await syncPaidSeatCounts({ cohort, participant, transaction });

      // Generate set-password magic link for participant
      const { magicLinkUrl: setPasswordUrl } = await magicLinkService.generateMagicLink({
        email: participant.email,
        role: 'participant',
        participantId: participant.id,
        cohortId: sponsorship.cohortId,
        purpose: 'set_password',
        transaction
      });

      emailPayload = {
        participantEmail,
        participantName: participant.name,
        cohortName: cohort.name,
        temporaryPassword: temporaryPassword,
        setPasswordUrl,
        loginUrl: buildParticipantLoginUrl(participant)
      };

      response = {
        sponsorship_id: Number(sponsorship.id),
        seat_id: Number(seat.id),
        seat_status: 'assigned',
        participant_id: Number(participant.id),
        participant_email: participantEmail,
        used_seats: groupUsedSeats,
        total_seats: groupTotalSeats
      };
    });

    if (emailPayload) {
      try {
        await sendParticipantLoginCredentialsEmail(emailPayload);
      } catch (error) {
        console.error('[Sponsorship] Participant credentials email failed:', error.message);
      }
    }

    return response;
  }

  async resendParticipantLogin(sponsorshipId, seatId, user) {
    let emailPayload = null;
    let response = null;

    await sequelize.transaction(async (transaction) => {
      const sponsorship = await sponsorshipRepository.findPlainById(sponsorshipId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Sponsorship
        }
      });

      if (!sponsorship) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
      }

      ensureEmployerAccess(sponsorship, user);

      const seat = await seatRepository.findByEmployerCohortAndId(
        sponsorship.employerUserId,
        sponsorship.cohortId,
        seatId,
        {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Seat
          }
        }
      );

      if (!seat || !seat.participantId || !['assigned', 'active'].includes(seat.status)) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Assigned participant seat not found.');
      }

      const participant = await participantRepository.findById(seat.participantId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Participant
        }
      });

      if (!participant || Number(participant.cohortId) !== Number(sponsorship.cohortId)) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found for this seat.');
      }

      const temporaryPassword = generateTemporaryPassword();
      const passwordHash = await bcrypt.hash(temporaryPassword, env.bcryptSaltRounds);

      await participantRepository.update(
        participant,
        {
          passwordHash,
          passwordGeneratedAt: new Date(),
          mustChangePassword: true,
          passwordChangedAt: null
        },
        { transaction }
      );

      const cohort = await sequelize.models.Cohort.findByPk(sponsorship.cohortId, {
        transaction
      });

      emailPayload = {
        participantEmail: participant.email,
        participantName: participant.name,
        cohortName: cohort ? cohort.name : 'your cohort',
        temporaryPassword,
        loginUrl: buildParticipantLoginUrl(participant)
      };

      response = {
        sponsorship_id: Number(seat.sponsorshipId),
        seat_id: Number(seat.id),
        participant_id: Number(participant.id),
        participant_email: participant.email
      };
    });

    if (emailPayload) {
      await sendParticipantLoginCredentialsEmail(emailPayload);
    }

    return response;
  }

}


module.exports = new SponsorshipService();
