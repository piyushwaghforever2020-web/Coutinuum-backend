const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const { sequelize } = require('../models');
const env = require('../config/env');
const cohortRepository = require('../repositories/cohort.repository');
const participantRepository = require('../repositories/participant.repository');
const paymentRepository = require('../repositories/payment.repository');
const seatRepository = require('../repositories/seat.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const employerUserRepository = require('../repositories/employerUser.repository');
const sponsorshipRepository = require('../repositories/sponsorship.repository');
const stripeService = require('./stripe.service');
const magicLinkService = require('./magicLink.service');
const ApiError = require('../utils/apiError');
const {
  HTTP_STATUS,
  SPONSORSHIP_FLOW
} = require('../constants/app.constants');
const { getRegistrationStatusFromPaymentStatus } = require('../utils/participantStatus');
const {
  sendEmployerSponsorshipInvoiceEmail,
  sendParticipantLoginCredentialsEmail
} = require('../utils/helpers');
const { generateTemporaryPassword } = require('../utils/password');

const normalizeEmail = (email) => String(email).trim().toLowerCase();

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

const mapDashboard = (sponsorship) => {
  const seats = (sponsorship.seats || []).map(mapSeat);
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
      total_seats: Number(sponsorship.totalSeats),
      used_seats: Number(sponsorship.usedSeats || 0),
      available_seats: seatCounts.available || 0,
      locked_seats: seatCounts.locked || 0,
      assigned_seats: seatCounts.assigned || 0,
      active_seats: seatCounts.active || 0,
      amount: Number(sponsorship.amount || 0),
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
    },
    seats
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

    const cohort = await cohortRepository.findActiveById(payload.cohort_id);
    if (!cohort) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
    }

    if (cohort.status === 'closed' || cohort.status === 'full' || !cohort.isActive) {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        'This cohort is not accepting sponsorship bookings.'
      );
    }

    ensureProgramBelongsToCohort(cohort, programId);

    const cohortPrice = parseStoredPrice(cohort.price);

    if (!Number.isFinite(cohortPrice) || cohortPrice <= 0) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid cohort price.');
    }

    const amount = Number((cohortPrice * totalSeats).toFixed(2));
    const invoiceDueAt = new Date(
      Date.now() + env.stripe.invoiceDueDays * 24 * 60 * 60 * 1000
    );

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

      const reservedSeats = await seatRepository.countReservedByCohortExcludingUnpaidSponsorship(
        lockedCohort.id,
        { transaction }
      );

      const paidParticipantSeats = await participantRepository.countEnrolledByCohort(
        lockedCohort.id,
        { transaction }
      );

      const participantSeatRows = await sequelize.models.Seat.count({
        where: {
          cohortId: lockedCohort.id,
          participantId: {
            [Op.ne]: null
          },
          status: {
            [Op.in]: ['assigned', 'active']
          }
        },
        transaction
      });

      const capacityUsed = reservedSeats + Math.max(0, paidParticipantSeats - participantSeatRows);

      if (capacityUsed + totalSeats > Number(lockedCohort.seatLimit)) {
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

        const reservedProgramSeats = await seatRepository.countReservedByCohortAndProgramExcludingUnpaidSponsorship(
          lockedCohort.id,
          programId,
          { transaction }
        );

        const paidProgramSeats = await participantRepository.countEnrolledByCohortAndProgram(
          lockedCohort.id,
          programId,
          { transaction }
        );

        const participantProgramSeatRows = await sequelize.models.Seat.count({
          where: {
            cohortId: lockedCohort.id,
            programId,
            participantId: {
              [Op.ne]: null
            },
            status: {
              [Op.in]: ['assigned', 'active']
            }
          },
          transaction
        });

        const programCapacityUsed =
          reservedProgramSeats + Math.max(0, paidProgramSeats - participantProgramSeatRows);

        if (
          Number(programMapping.allocatedSeats) > 0 &&
          programCapacityUsed + totalSeats > Number(programMapping.allocatedSeats)
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
          invoiceDueAt
        },
        { transaction }
      );

      const seatRows = Array.from({ length: totalSeats }, () => ({
        cohortId: lockedCohort.id,
        programId,
        sponsorshipId: sponsorship.id,
        status: 'locked',
        lockedAt: new Date(),
        holdExpiresAt: invoiceDueAt
      }));

      await seatRepository.bulkCreate(seatRows, { transaction });
    });

    let stripeResult;
    try {
      stripeResult = await stripeService.createAndSendEmployerInvoice({
        managerEmail: employerEmail,
        managerName: payload.employer_name,
        amount,
        currency: env.stripe.currency,
        cohortName: cohort.name,
        metadata: {
          flow: SPONSORSHIP_FLOW,
          sponsorship_id: String(sponsorship.id),
          employer_user_id: String(employerUser.id),
          cohort_id: String(cohort.id),
          program_id: programId ? String(programId) : '',
          total_seats: String(totalSeats),
          payment_type: 'employer_sponsorship'
        }
      });

      if (Math.round(Number(stripeResult.amountDue || 0) * 100) !== Math.round(amount * 100)) {
        throw new Error('Stripe invoice amount does not match the sponsorship seat price.');
      }
    } 
    catch (error) {
      console.error('[Sponsorship] Stripe invoice creation failed:', error.message);

      await sequelize.transaction(async (transaction) => {
        const lockedSponsorship = await sponsorshipRepository.findPlainById(sponsorship.id, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Sponsorship
          }
        });

        if (lockedSponsorship && lockedSponsorship.status !== 'paid') {
          await sponsorshipRepository.update(
            lockedSponsorship,
            { status: 'failed' },
            { transaction }
          );

          await sequelize.models.Seat.update(
            { status: 'released' },
            {
              where: {
                sponsorshipId: lockedSponsorship.id,
                status: 'locked'
              },
              transaction
            }
          );
        }
      });

      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Failed to create sponsorship invoice. Please try again.'
      );
    }

    let invoice;
    await sequelize.transaction(async (transaction) => {
      const lockedSponsorship = await sponsorshipRepository.findPlainById(sponsorship.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Sponsorship
        }
      });

      await employerUserRepository.update(
        employerUser,
        {
          stripeCustomerId: stripeResult.customerId
        },
        { transaction }
      );

      invoice = await invoiceRepository.create(
        {
          employerUserId: employerUser.id,
          sponsorshipId: sponsorship.id,
          cohortId: cohort.id,
          stripeCustomerId: stripeResult.customerId,
          stripeInvoiceId: stripeResult.invoiceId,
          stripeInvoiceNumber: stripeResult.invoiceNumber,
          managerName: payload.employer_name,
          managerEmail: employerEmail,
          amount,
          currency: env.stripe.currency,
          status: 'invoice_requested',
          hostedInvoiceUrl: stripeResult.hostedInvoiceUrl,
          invoicePdfUrl: stripeResult.invoicePdfUrl,
          sentAt: new Date()
        },
        { transaction }
      );

      await sponsorshipRepository.update(
        lockedSponsorship,
        {
          status: 'invoice_requested',
          stripeCustomerId: stripeResult.customerId,
          stripeInvoiceId: stripeResult.invoiceId,
          invoiceId: invoice.id,
          hostedInvoiceUrl: stripeResult.hostedInvoiceUrl,
          invoicePdfUrl: stripeResult.invoicePdfUrl
        },
        { transaction }
      );
    });

    const employerMagicLink = await magicLinkService.generateMagicLink({
      email: employerEmail,
      role: 'employer',
      employerUserId: employerUser.id,
      sponsorshipId: sponsorship.id,
      cohortId: cohort.id,
      purpose: 'dashboard_access'
    });

    try {
      await sendEmployerSponsorshipInvoiceEmail({
        employerEmail,
        employerName: payload.employer_name,
        cohortName: cohort.name,
        totalSeats,
        hostedInvoiceUrl: stripeResult.hostedInvoiceUrl,
        dashboardUrl: employerMagicLink.magicLinkUrl
      });
    } catch (error) {
      console.error('[Sponsorship] Invoice/dashboard email failed:', error.message);
    }

    return {
      sponsorship_id: Number(sponsorship.id),
      employer_user_id: Number(employerUser.id),
      invoice_id: Number(invoice.id),
      stripe_invoice_id: stripeResult.invoiceId,
      status: 'invoice_requested',
      total_seats: totalSeats,
      amount,
      currency: env.stripe.currency,
      hosted_invoice_url: stripeResult.hostedInvoiceUrl,
      dashboard_login_sent: true
    };
  }

  async getEmployerDashboard(sponsorshipId, user) {
    const sponsorship = await sponsorshipRepository.findById(sponsorshipId);

    if (!sponsorship) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Sponsorship not found.');
    }

    ensureEmployerAccess(sponsorship, user);
    return mapDashboard(sponsorship);
  }

  async assignSeat(sponsorshipId, seatId, payload, user) {
    const participantEmail = normalizeEmail(payload.participant_email);
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

      if (sponsorship.status !== 'paid') {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'Sponsorship invoice must be paid before assigning seats.'
        );
      }

      const seat = await seatRepository.findBySponsorshipAndId(sponsorship.id, seatId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Seat
        }
      });

      if (!seat) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Seat not found for this sponsorship.');
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
        used_seats: usedSeats,
        total_seats: Number(sponsorship.totalSeats)
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

      const seat = await seatRepository.findBySponsorshipAndId(sponsorship.id, seatId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Seat
        }
      });

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
        sponsorship_id: Number(sponsorship.id),
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

  async syncRequestedStripeInvoice(stripeInvoice, stripeEventId, { markSent = false } = {}) {
    const metadata = stripeInvoice?.metadata || {};
    if (metadata.flow !== SPONSORSHIP_FLOW) {
      return { processed: false, reason: 'unsupported_flow' };
    }

    const sponsorshipId = Number(metadata.sponsorship_id || 0);

    return sequelize.transaction(async (transaction) => {
      const sponsorship = sponsorshipId
        ? await sponsorshipRepository.findPlainById(sponsorshipId, {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.Sponsorship
            }
          })
        : await sponsorshipRepository.findPlainByStripeInvoiceId(stripeInvoice.id, {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.Sponsorship
            }
          });

      if (!sponsorship) {
        return { processed: false, ignored: true, reason: 'local_sponsorship_not_found_yet' };
      }

      if (['paid', 'failed', 'voided', 'cancelled'].includes(sponsorship.status)) {
        return { processed: false, ignored: true, reason: `sponsorship_already_${sponsorship.status}` };
      }

      await sponsorshipRepository.update(
        sponsorship,
        {
          status: 'invoice_requested',
          stripeInvoiceId: stripeInvoice.id || sponsorship.stripeInvoiceId,
          hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || sponsorship.hostedInvoiceUrl,
          invoicePdfUrl: stripeInvoice.invoice_pdf || sponsorship.invoicePdfUrl,
          stripeEventId
        },
        { transaction }
      );

      const invoice = await invoiceRepository.findPlainByStripeInvoiceId(stripeInvoice.id, {
        transaction
      });

      if (invoice && invoice.status !== 'paid') {
        await invoiceRepository.update(
          invoice,
          {
            status: 'invoice_requested',
            stripeInvoiceNumber: stripeInvoice.number || invoice.stripeInvoiceNumber,
            hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || invoice.hostedInvoiceUrl,
            invoicePdfUrl: stripeInvoice.invoice_pdf || invoice.invoicePdfUrl,
            sentAt: markSent ? invoice.sentAt || new Date() : invoice.sentAt,
            stripeEventId
          },
          { transaction }
        );
      }

      return {
        processed: true,
        sponsorship_id: Number(sponsorship.id),
        status: 'invoice_requested'
      };
    });
  }

  processCreatedStripeInvoice(stripeInvoice, stripeEventId) {
    return this.syncRequestedStripeInvoice(stripeInvoice, stripeEventId);
  }

  processFinalizedStripeInvoice(stripeInvoice, stripeEventId) {
    return this.syncRequestedStripeInvoice(stripeInvoice, stripeEventId);
  }

  processSentStripeInvoice(stripeInvoice, stripeEventId) {
    return this.syncRequestedStripeInvoice(stripeInvoice, stripeEventId, { markSent: true });
  }

  async processPaidStripeInvoice(stripeInvoice, stripeEventId) {
    const metadata = stripeInvoice?.metadata || {};
    if (metadata.flow !== SPONSORSHIP_FLOW) {
      return { processed: false, reason: 'unsupported_flow' };
    }

    const stripeAmountPaidInCents = Number(stripeInvoice.amount_paid || 0);
    const stripeTotalInCents = Number(stripeInvoice.total ?? stripeInvoice.amount_due ?? 0);

    if (
      !Number.isFinite(stripeAmountPaidInCents) ||
      !Number.isFinite(stripeTotalInCents) ||
      stripeAmountPaidInCents <= 0 ||
      stripeTotalInCents <= 0
    ) {
      return {
        processed: false,
        ignored: true,
        reason: 'zero_amount_invoice_paid_event'
      };
    }

    const sponsorshipId = Number(metadata.sponsorship_id || 0);

    return sequelize.transaction(async (transaction) => {
      const sponsorship = sponsorshipId
        ? await sponsorshipRepository.findPlainById(sponsorshipId, {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.Sponsorship
            }
          })
        : await sponsorshipRepository.findPlainByStripeInvoiceId(stripeInvoice.id, {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.Sponsorship
            }
          });

      if (!sponsorship) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Local sponsorship record not found.');
      }

      if (sponsorship.status === 'paid') {
        return { processed: false, duplicate: true };
      }

      const localAmountInCents = Math.round(Number(sponsorship.amount || 0) * 100);
      if (
        !Number.isFinite(localAmountInCents) ||
        localAmountInCents <= 0 ||
        stripeAmountPaidInCents < localAmountInCents
      ) {
        return {
          processed: false,
          ignored: true,
          reason: 'invoice_paid_event_without_full_amount'
        };
      }

      const invoice = await invoiceRepository.findPlainByStripeInvoiceId(stripeInvoice.id, {
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
          paidAt,
          stripeInvoiceId: stripeInvoice.id,
          hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || sponsorship.hostedInvoiceUrl,
          invoicePdfUrl: stripeInvoice.invoice_pdf || sponsorship.invoicePdfUrl,
          stripeEventId
        },
        { transaction }
      );

      if (invoice) {
        await invoiceRepository.update(
          invoice,
          {
            status: 'paid',
            paidAt,
            hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || invoice.hostedInvoiceUrl,
            invoicePdfUrl: stripeInvoice.invoice_pdf || invoice.invoicePdfUrl,
            stripeEventId
          },
          { transaction }
        );
      }

      await sequelize.models.Seat.update(
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

      return {
        processed: true,
        sponsorship_id: Number(sponsorship.id),
        invoice_id: invoice ? Number(invoice.id) : null,
        seats_unlocked: true
      };
    });
  }

  async processFailedStripeInvoice(stripeInvoice, stripeEventId) {
    const metadata = stripeInvoice?.metadata || {};
    if (metadata.flow !== SPONSORSHIP_FLOW) {
      return { processed: false, reason: 'unsupported_flow' };
    }

    return this.markInvoiceTerminal(stripeInvoice, stripeEventId, 'failed');
  }

  async processVoidedStripeInvoice(stripeInvoice, stripeEventId) {
    const metadata = stripeInvoice?.metadata || {};
    if (metadata.flow !== SPONSORSHIP_FLOW) {
      return { processed: false, reason: 'unsupported_flow' };
    }

    return this.markInvoiceTerminal(stripeInvoice, stripeEventId, 'voided');
  }

  async markInvoiceTerminal(stripeInvoice, stripeEventId, status) {
    const metadata = stripeInvoice?.metadata || {};
    const sponsorshipId = Number(metadata.sponsorship_id || 0);

    return sequelize.transaction(async (transaction) => {
      const sponsorship = sponsorshipId
        ? await sponsorshipRepository.findPlainById(sponsorshipId, {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.Sponsorship
            }
          })
        : await sponsorshipRepository.findPlainByStripeInvoiceId(stripeInvoice.id, {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.Sponsorship
            }
          });

      if (!sponsorship) {
        return { processed: false, ignored: true, reason: 'local_sponsorship_not_found' };
      }

      if (sponsorship.status === 'paid') {
        return { processed: false, ignored: true, reason: 'already_paid' };
      }

      await sponsorshipRepository.update(
        sponsorship,
        {
          status,
          stripeEventId
        },
        { transaction }
      );

      const invoice = await invoiceRepository.findPlainByStripeInvoiceId(stripeInvoice.id, {
        transaction
      });

      if (invoice && invoice.status !== 'paid') {
        await invoiceRepository.update(
          invoice,
          {
            status: 'failed',
            stripeEventId
          },
          { transaction }
        );
      }

      await sequelize.models.Seat.update(
        {
          status: 'released'
        },
        {
          where: {
            sponsorshipId: sponsorship.id,
            status: {
              [Op.in]: ['locked', 'available']
            }
          },
          transaction
        }
      );

      return {
        processed: true,
        sponsorship_id: Number(sponsorship.id),
        status
      };
    });
  }
}

module.exports = new SponsorshipService();
