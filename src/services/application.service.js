const { sequelize } = require('../models');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const fs = require('fs/promises');
const path = require('path');
const env = require('../config/env');
const cohortRepository = require('../repositories/cohort.repository');
const participantRepository = require('../repositories/participant.repository');
const paymentRepository = require('../repositories/payment.repository');
const stripeService = require('./stripe.service');
const crmService = require('./crm.service');
const { getRegistrationStatusFromPaymentStatus } = require('../utils/participantStatus');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS, EMPLOYER_FUNDED_FLOW } = require('../constants/app.constants');
const { sendPaymentConfirmationEmail,sendPaymentFailedEmail, sendEmployerPaymentReceivedEmail,sendMagicLinkEmail } = require('../utils/helpers');
const seatRepository = require('../repositories/seat.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const magicLinkService = require('./magicLink.service');

const normalizeEmail = (email) => String(email).trim().toLowerCase();
// Cohort prices may be stored as display strings like "6000 USD".
// Extract the numeric portion so checkout/payment math still works.
const parseStoredPrice = (value) => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  const numericMatch = String(value ?? '')
    .replace(/,/g, '')
    .match(/\d+(?:\.\d+)?/);

  return numericMatch ? Number(numericMatch[0]) : NaN;
};

const UPCOMING_COHORT_FILE_NAME = 'Upcoming_Cohort_Dates_v2 1.pdf';
const UPCOMING_COHORT_FILE_PATH = path.join(
  __dirname,
  '..',
  '..',
  'public',
  UPCOMING_COHORT_FILE_NAME
);

const generateParticipantAccessPassword = (length = 12) => {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  const bytes = crypto.randomBytes(length);
  let password = '';

  for (let index = 0; index < length; index += 1) {
    password += charset[bytes[index] % charset.length];
  }

  return password;
};

const mapApplicationParticipant = (participant) => ({
  id: participant.id,
  name: participant.name,
  email: participant.email,
  phone: participant.phone,
  company: participant.company,
  role: participant.role,
  program_id: participant.programId,
  answers: participant.answers,
  agree_email: Boolean(participant.agreeEmail),
  agree_sms: Boolean(participant.agreeSms),
  employer_funded: Boolean(participant.employerFunded),
  payment_type: participant.paymentType || 'self_pay',
  billing_manager_name: participant.billingManagerName || null,
  billing_manager_email: participant.billingManagerEmail || null,
  payment_status: participant.paymentStatus,
  registration_status: getRegistrationStatusFromPaymentStatus(participant.paymentStatus),
  is_active: Boolean(participant.isActive),
  created_at: participant.createdAt,
  updated_at: participant.updatedAt,
  cohort: participant.cohort
    ? {
        id: participant.cohort.id,
        name: participant.cohort.name,
        start_date: participant.cohort.startDate,
        price: parseStoredPrice(participant.cohort.price),
        seat_limit: participant.cohort.seatLimit,
        seats_filled: participant.cohort.seatsFilled,
        status: participant.cohort.status,
        is_active: Boolean(participant.cohort.isActive)
      }
    : null,
  program: participant.program
    ? {
        id: participant.program.id,
        name: participant.program.name
      }
    : null
});

const getApplicationProgramId = (payload) =>
  payload.program_id ?? payload.programm_id ?? null;

const ensureCohortExists = async (cohortId, options = {}) => {
  const cohort = await cohortRepository.findActiveById(cohortId, options);

  if (!cohort) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
  }

  return cohort;
};

const ensureCohortOpenForPayment = (cohort) => {
  if (!cohort.isActive) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'This cohort is inactive.');
  }

  if (cohort.status === 'closed') {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'This cohort is closed for enrollment.');
  }
};

const ensureCohortAvailableForPayment = (cohort) => {
  ensureCohortOpenForPayment(cohort);

  if (cohort.seatsFilled >= cohort.seatLimit || cohort.status === 'full') {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'No seats available for this cohort.');
  }
};

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

const SELF_PAY_HOLD_STATUSES = ['locked', 'active'];

const getSelfPayHoldExpiresAt = () => {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + env.stripe.selfPaySeatHoldMinutes);
  return expiresAt;
};

const isUnexpiredHold = (seat, now = new Date()) =>
  seat?.status === 'locked' &&
  seat.holdExpiresAt &&
  new Date(seat.holdExpiresAt).getTime() > now.getTime();

const hasEffectiveCohortCapacity = async (cohort, { transaction, now = new Date() }) => {
  const reservedSeats = await seatRepository.countEffectiveReservedCapacityByCohort(
    cohort.id,
    { now },
    { transaction }
  );

  return reservedSeats < Number(cohort.seatLimit);
};

const ensureProgramSeatAvailableForCheckout = async (
  { cohortId, programId },
  { transaction, now = new Date() }
) => {
  if (!programId) {
    return null;
  }

  const programMapping = await cohortRepository.findProgramMapping(cohortId, programId, {
    transaction,
    lock: {
      level: transaction.LOCK.UPDATE,
      of: sequelize.models.CohortProgram
    }
  });

  if (!programMapping) {
    throw new ApiError(
      HTTP_STATUS.BAD_REQUEST,
      'Selected program is not available for this cohort.'
    );
  }

  const reservedProgramSeats = await seatRepository.countEffectiveReservedCapacityByCohortAndProgram(
    cohortId,
    programId,
    { now },
    { transaction }
  );

  if (
    Number(programMapping.allocatedSeats) > 0 &&
    reservedProgramSeats >= Number(programMapping.allocatedSeats)
  ) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'No seats available for this program.');
  }

  return programMapping;
};

const ensureProgramSeatAvailableForPaidEnrollment = async (participant, transaction) => {
  if (!participant.programId) {
    return null;
  }

  const programMapping = await cohortRepository.findProgramMapping(
    participant.cohortId,
    participant.programId,
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

  const paidProgramSeats = await participantRepository.countEnrolledByCohortAndProgram(
    participant.cohortId,
    participant.programId,
    { transaction }
  );

  if (isProgramFullForSeatCount(programMapping, paidProgramSeats)) {
    throw new ApiError(HTTP_STATUS.CONFLICT, 'No seats available for this program.');
  }

  return programMapping;
};

const syncPaidSeatCounts = async ({ cohort, participant, programMapping, transaction }) => {
  const seatsFilled = await participantRepository.countEnrolledByCohort(cohort.id, {
    transaction
  });
  const cohortStatus = getCohortStatusForSeatCount(cohort, seatsFilled);

  await cohortRepository.update(
    cohort,
    {
      seatsFilled,
      status: cohortStatus
    },
    { transaction }
  );

  let programSeatsFilled = null;
  let programIsFull = null;

  if (participant.programId) {
    const mapping =
      programMapping ||
      (await cohortRepository.findProgramMapping(cohort.id, participant.programId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.CohortProgram
        }
      }));

    if (mapping) {
      programSeatsFilled = await participantRepository.countEnrolledByCohortAndProgram(
        cohort.id,
        participant.programId,
        { transaction }
      );
      programIsFull = isProgramFullForSeatCount(mapping, programSeatsFilled);

      await cohortRepository.updateProgramMapping(
        mapping,
        {
          seatsFilled: programSeatsFilled,
          isFull: programIsFull
        },
        { transaction }
      );
    }
  }

  return {
    seatsFilled,
    cohortStatus,
    programSeatsFilled,
    programIsFull
  };
};

const findOpenStripeSession = async (payment) => {
  if (!payment?.stripeCheckoutSessionId || payment.status !== 'pending') {
    return null;
  }

  try {
    const session = await stripeService.retrieveCheckoutSession(payment.stripeCheckoutSessionId);

    if (session.status === 'open' && session.url) {
      return session;
    }
  } catch (error) {
    return null;
  }

  return null;
};

const CHECKOUT_SESSION_LINK_MAX_ATTEMPTS = 3;

const wait = (milliseconds) =>
  new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });

const getStripePaymentIntentId = (stripeObject) =>
  typeof stripeObject?.payment_intent === 'string'
    ? stripeObject.payment_intent
    : stripeObject?.payment_intent?.id || null;

const linkCheckoutSessionToPayment = async ({ paymentId, session }) => {
  let lastError = null;

  for (let attempt = 1; attempt <= CHECKOUT_SESSION_LINK_MAX_ATTEMPTS; attempt += 1) {
    try {
      return await sequelize.transaction(async (transaction) => {
        const payment = await paymentRepository.findById(paymentId, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Payment
          }
        });

        if (!payment || payment.status !== 'pending') {
          return false;
        }

        await paymentRepository.update(
          payment,
          {
            stripeCheckoutSessionId: session.id,
            stripePaymentIntentId: getStripePaymentIntentId(session),
            checkoutUrl: session.url
          },
          { transaction }
        );

        return true;
      });
    } catch (error) {
      lastError = error;
      console.warn('[Checkout] Stripe session link attempt failed.', {
        payment_id: paymentId,
        checkout_session_id: session?.id || null,
        attempt,
        error: error.message
      });

      if (attempt < CHECKOUT_SESSION_LINK_MAX_ATTEMPTS) {
        await wait(100 * attempt);
      }
    }
  }

  throw lastError;
};

const ensureUpcomingCohortFileExists = async () => {
  try {
    await fs.access(UPCOMING_COHORT_FILE_PATH);
  } catch (error) {
    throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Upcoming cohort file not found.');
  }
};

class ApplicationService {
  async submitApplication(payload) {
    const email = normalizeEmail(payload.email);
    const programId = getApplicationProgramId(payload);
    const cohort = await ensureCohortExists(payload.cohort_id);
    ensureProgramBelongsToCohort(cohort, programId);

    const existingParticipant = await participantRepository.findByEmailAndCohort(
      email,
      payload.cohort_id
    );

    //get cohort details for response
     const cohortData =  await cohortRepository.findById(payload.cohort_id)

     if(cohortData.sync_status === 'closed' || !cohortData.isActive )
     {
       throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Closed cohort cannot accept new applications.'
      );
     }
     else if(cohortData.status === 'full'){
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Cohort is full and cannot accept new applications.'
      )
     }
     
     
    if (!existingParticipant) {
      const participant = await participantRepository.create({
        name: payload.name,
        email,
        phone: payload.phone || null,
        company: payload.company || null,
        role: payload.role || null,
        cohortId: payload.cohort_id,
        programId,
        answers: payload.answers ?? null,
        agreeEmail: Boolean(payload.agree_email),
        agreeSms: Boolean(payload.agree_sms),
        employerFunded: Boolean(payload.employer_funded),
        paymentType: payload.employer_funded ? 'employer_funded' : 'self_pay',
        isActive: true,
        paymentStatus: 'pending',
        registrationStatus: getRegistrationStatusFromPaymentStatus('pending')
      });

      return this.getApplicationParticipant(participant.id);
    }

    if (existingParticipant.paymentStatus === 'paid') {
      throw new ApiError(
        HTTP_STATUS.CONFLICT,
        'User already enrolled for this cohort.'
      );
    }

    await participantRepository.update(existingParticipant, {
      name: payload.name,
      email,
      phone: payload.phone || null,
      company: payload.company || null,
      role: payload.role || null,
      programId,
      answers: payload.answers ?? null,
      agreeEmail: Boolean(payload.agree_email),
      agreeSms: Boolean(payload.agree_sms),
      employerFunded: Boolean(payload.employer_funded),
      paymentType: payload.employer_funded ? 'employer_funded' : 'self_pay',
      paymentStatus: 'pending',
      registrationStatus: getRegistrationStatusFromPaymentStatus('pending')
    });

    return this.getApplicationParticipant(existingParticipant.id);
  }

  async getApplicationParticipant(participantId) {
    const participant = await participantRepository.findById(participantId);

    if (!participant) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found.');
    }

    return mapApplicationParticipant(participant);
  }

  async createCheckoutSession(payload) {
    const email = normalizeEmail(payload.email);
    const participant = await participantRepository.findByEmailAndCohort(email, payload.cohort_id);

    if (!participant) {
      throw new ApiError(
        HTTP_STATUS.NOT_FOUND,
        'Application not found. Please submit the application form first.'
      );
    }

    if (participant.paymentStatus === 'paid') {
      throw new ApiError(HTTP_STATUS.CONFLICT, 'Payment already completed.');
    }

    if (participant.paymentType === 'employer_funded' || participant.employerFunded) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'This registration uses employer invoicing. Checkout is not available.'
      );
    }

    const cohort = participant.cohort || (await ensureCohortExists(payload.cohort_id));
    // Fast rejection only; the locked transaction below uses effective reserved capacity.
    ensureCohortAvailableForPayment(cohort);
    const cohortPrice = parseStoredPrice(cohort.price);

    if (!Number.isFinite(cohortPrice)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid cohort price.');
    }

    const existingSeat = await seatRepository.findSelfPayByParticipantAndCohort(
      participant.id,
      payload.cohort_id
    );
    const latestPayment = participant.payments?.length
      ? [...participant.payments].sort(
          (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
        )[0]
      : await paymentRepository.findLatestByParticipantAndCohort(participant.id, payload.cohort_id);

    const reusableSession = await findOpenStripeSession(latestPayment);

    if (reusableSession && isUnexpiredHold(existingSeat)) {
      return {
        participant_id: participant.id,
        cohort_id: cohort.id,
        seat_id: existingSeat.id,
        seat_hold_expires_at: existingSeat.holdExpiresAt,
        session_id: reusableSession.id,
        checkout_url: reusableSession.url,
        reused_existing_session: true
      };
    }

    let reservation;

    await sequelize.transaction(async (transaction) => {
      const lockedParticipant = await participantRepository.findById(participant.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Participant
        }
      });

      if (!lockedParticipant) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found.');
      }

      if (lockedParticipant.paymentStatus === 'paid') {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Payment already completed.');
      }

      const lockedCohort = await cohortRepository.findById(cohort.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Cohort
        }
      });

      ensureCohortOpenForPayment(lockedCohort);

      const seat = await seatRepository.findSelfPayByParticipantAndCohort(
        lockedParticipant.id,
        lockedCohort.id,
        {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Seat
          }
        }
      );

      if (seat && seat.status === 'active') {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'Payment already completed.');
      }

      if (seat && seat.status === 'assigned') {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'This seat is already assigned.');
      }

      const now = new Date();
      const hasExistingHold = isUnexpiredHold(seat, now);

      if (!hasExistingHold) {
        const hasCohortCapacity = await hasEffectiveCohortCapacity(lockedCohort, {
          transaction,
          now
        });

        if (!hasCohortCapacity) {
          throw new ApiError(HTTP_STATUS.CONFLICT, 'No seats available for this cohort.');
        }
      }

      if (!hasExistingHold) {
        await ensureProgramSeatAvailableForCheckout(
          {
            cohortId: lockedCohort.id,
            programId: lockedParticipant.programId
          },
          { transaction, now }
        );
      }

      const holdExpiresAt = getSelfPayHoldExpiresAt();
      let heldSeat = seat;

      if (!heldSeat) {
        heldSeat = await seatRepository.create(
          {
            participantId: lockedParticipant.id,
            sponsorshipId: null,
            cohortId: lockedCohort.id,
            programId: lockedParticipant.programId,
            participantEmail: lockedParticipant.email,
            status: 'locked',
            lockedAt: now,
            holdExpiresAt
          },
          { transaction }
        );
      } else if (!hasExistingHold) {
        heldSeat = await seatRepository.update(
          heldSeat,
          {
            programId: lockedParticipant.programId,
            participantEmail: lockedParticipant.email,
            status: 'locked',
            lockedAt: now,
            activatedAt: null,
            assignedAt: null,
            holdExpiresAt
          },
          { transaction }
        );
      }

      if (!SELF_PAY_HOLD_STATUSES.includes(heldSeat.status)) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'No seats available for this cohort.');
      }

      const currentPayment = await paymentRepository.findLatestByParticipantAndCohort(
        lockedParticipant.id,
        lockedCohort.id,
        {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Payment
          }
        }
      );

      const paymentPayload = {
        participantId: lockedParticipant.id,
        cohortId: lockedCohort.id,
        amount: cohortPrice,
        status: 'pending',
        transactionId: null,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        checkoutUrl: null,
        completedAt: null
      };

      let payment;
      if (currentPayment && currentPayment.status !== 'paid') {
        payment = await paymentRepository.update(currentPayment, paymentPayload, { transaction });
      } else {
        payment = await paymentRepository.create(paymentPayload, { transaction });
      }

      await participantRepository.update(
        lockedParticipant,
        {
          paymentStatus: 'pending',
          registrationStatus: getRegistrationStatusFromPaymentStatus('pending')
        },
        { transaction }
      );

      reservation = {
        paymentId: payment.id,
        seatId: heldSeat.id,
        holdExpiresAt: heldSeat.holdExpiresAt || holdExpiresAt
      };
    });

    let session;
    try {
      session = await stripeService.createCheckoutSession({
        participantId: participant.id,
        cohortId: cohort.id,
        customerEmail: email,
        currency: env.stripe.currency,
        unitAmount: Math.round(cohortPrice * 100),
        productName: cohort.name,
        productDescription: cohort.description,
        successUrl: payload.success_url || env.stripe.successUrl,
        cancelUrl: payload.cancel_url || env.stripe.cancelUrl
      });
    } catch (error) {
      await sequelize.transaction(async (transaction) => {
        const seat = await seatRepository.findById(reservation.seatId, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Seat
          }
        });

        if (seat && seat.status === 'locked') {
          await seatRepository.releaseExpiredHold(seat, { transaction });
        }

        const payment = await paymentRepository.findById(reservation.paymentId, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Payment
          }
        });

        if (payment && payment.status === 'pending') {
          await paymentRepository.update(payment, { status: 'failed' }, { transaction });
        }
      });

      throw error;
    }

    let linkedSession = false;
    try {
      linkedSession = await linkCheckoutSessionToPayment({
        paymentId: reservation.paymentId,
        session
      });
    } catch (error) {
      console.error('[Checkout] CRITICAL: Stripe session was created but not linked.', {
        payment_id: reservation.paymentId,
        seat_id: reservation.seatId,
        checkout_session_id: session.id,
        participant_id: participant.id,
        cohort_id: cohort.id,
        error: error.message
      });

      try {
        await stripeService.expireCheckoutSession(session.id);
      } catch (expireError) {
        console.warn('[Checkout] Stripe checkout session expiration skipped after link failure.', {
          checkout_session_id: session.id,
          error: expireError.message
        });
      }

      throw error;
    }

    if (!linkedSession) {
      console.error('[Checkout] CRITICAL: Stripe session link skipped for non-pending payment.', {
        payment_id: reservation.paymentId,
        seat_id: reservation.seatId,
        checkout_session_id: session.id,
        participant_id: participant.id,
        cohort_id: cohort.id
      });

      try {
        await stripeService.expireCheckoutSession(session.id);
      } catch (expireError) {
        console.warn('[Checkout] Stripe checkout session expiration skipped after skipped link.', {
          checkout_session_id: session.id,
          error: expireError.message
        });
      }

      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Checkout session could not be linked. Please try again.'
      );
    }

    return {
      participant_id: participant.id,
      cohort_id: cohort.id,
      seat_id: reservation.seatId,
      seat_hold_expires_at: reservation.holdExpiresAt,
      session_id: session.id,
      checkout_url: session.url,
      reused_existing_session: false
    };
  }

  async processCompletedCheckoutSession(sessionData) {
    const participantId = Number(sessionData?.metadata?.participant_id);
    const cohortId = Number(sessionData?.metadata?.cohort_id);
    console.log('[Stripe Webhook] Processing checkout.session.completed.', {
      checkout_session_id: sessionData?.id || null,
      participant_id: participantId || null,
      cohort_id: cohortId || null,
      payment_intent:
        typeof sessionData?.payment_intent === 'string'
          ? sessionData.payment_intent
          : sessionData?.payment_intent?.id || null,
      amount_total: sessionData?.amount_total ?? null
    });

    if (!participantId || !cohortId) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Missing participant_id or cohort_id in Stripe session metadata.'
      );
    }

    const amount = Number(sessionData.amount_total || 0) / 100;
    const paymentIntentId = getStripePaymentIntentId(sessionData);

    let confirmationEmailPayload = null;
    const result = await sequelize.transaction(async (transaction) => {
      const participant = await participantRepository.findById(participantId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Participant
        }
      });

      if (!participant || Number(participant.cohortId) !== cohortId) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found for this cohort.');
      }

      const cohort = await cohortRepository.findById(cohortId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Cohort
        }
      });

      if (!cohort) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
      }
      const cohortPrice = parseStoredPrice(cohort.price);

      let payment = await paymentRepository.findByStripeCheckoutSessionId(sessionData.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Payment
        }
      });

      if (!payment) {
        payment = await paymentRepository.findLatestByParticipantAndCohort(participantId, cohortId, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Payment
          }
        });
      }

      if (payment?.status === 'refunded' || participant.paymentStatus === 'refunded') {
        return {
          processed: false,
          duplicate: true,
          refunded: true
        };
      }

      if (payment?.status === 'paid' && participant.paymentStatus === 'paid') {
        const programMapping = participant.programId
          ? await cohortRepository.findProgramMapping(cohortId, participant.programId, {
              transaction,
              lock: {
                level: transaction.LOCK.UPDATE,
                of: sequelize.models.CohortProgram
              }
            })
          : null;
        const seatSync = await syncPaidSeatCounts({
          cohort,
          participant,
          programMapping,
          transaction
        });

        console.log('[Stripe Webhook] Duplicate event detected from payment status.', {
          checkout_session_id: sessionData.id,
          participant_id: participantId,
          cohort_id: cohortId,
          payment_id: payment.id,
          seats_filled: seatSync.seatsFilled,
          program_seats_filled: seatSync.programSeatsFilled
        });

        return {
          processed: false,
          duplicate: true,
          synced_seat_counts: true
        };
      }

      if (participant.paymentStatus === 'paid') {
        const programMapping = participant.programId
          ? await cohortRepository.findProgramMapping(cohortId, participant.programId, {
              transaction,
              lock: {
                level: transaction.LOCK.UPDATE,
                of: sequelize.models.CohortProgram
              }
            })
          : null;
        const seatSync = await syncPaidSeatCounts({
          cohort,
          participant,
          programMapping,
          transaction
        });

        console.log('[Stripe Webhook] Duplicate event detected from participant state.', {
          checkout_session_id: sessionData.id,
          participant_id: participantId,
          cohort_id: cohortId,
          seats_filled: seatSync.seatsFilled,
          program_seats_filled: seatSync.programSeatsFilled
        });

        return {
          processed: false,
          duplicate: true,
          synced_seat_counts: true
        };
      }

      let seat = await seatRepository.findSelfPayByParticipantAndCohort(participant.id, cohortId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Seat
        }
      });

      const now = new Date();
      const hasValidHold =
        seat &&
        Number(seat.participantId) === participantId &&
        Number(seat.cohortId) === cohortId &&
        isUnexpiredHold(seat, now);

      let programMapping = participant.programId
        ? await cohortRepository.findProgramMapping(cohortId, participant.programId, {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.CohortProgram
            }
          })
        : null;

      if (participant.programId && !programMapping) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Selected program is not available for this cohort.'
        );
      }

      let canActivateSeat = Boolean(hasValidHold && cohort.isActive && cohort.status !== 'closed');

      if (!canActivateSeat && cohort.isActive && cohort.status !== 'closed') {
        canActivateSeat = await hasEffectiveCohortCapacity(cohort, { transaction, now });

        if (canActivateSeat && participant.programId && programMapping) {
          const reservedProgramSeats =
            await seatRepository.countEffectiveReservedCapacityByCohortAndProgram(
              cohortId,
              participant.programId,
              { now },
              { transaction }
            );

          canActivateSeat =
            Number(programMapping.allocatedSeats) <= 0 ||
            reservedProgramSeats < Number(programMapping.allocatedSeats);
        }
      }

      if (!canActivateSeat) {
        const refundIdempotencyKey = `capacity-refund:${sessionData.id}`;

        if (payment) {
          await paymentRepository.update(
            payment,
            {
              amount: amount || Number(payment.amount) || cohortPrice,
              status: 'refunded',
              transactionId: paymentIntentId || sessionData.id,
              stripeCheckoutSessionId: sessionData.id,
              stripePaymentIntentId: paymentIntentId,
              checkoutUrl: sessionData.url || payment.checkoutUrl,
              completedAt: new Date()
            },
            { transaction }
          );
        } else {
          payment = await paymentRepository.create(
            {
              participantId,
              cohortId,
              amount: amount || cohortPrice,
              status: 'refunded',
              transactionId: paymentIntentId || sessionData.id,
              stripeCheckoutSessionId: sessionData.id,
              stripePaymentIntentId: paymentIntentId,
              checkoutUrl: sessionData.url || null,
              completedAt: new Date()
            },
            { transaction }
          );
        }

        await participantRepository.update(
          participant,
          {
            paymentStatus: 'refunded',
            registrationStatus: getRegistrationStatusFromPaymentStatus('refunded')
          },
          { transaction }
        );

        if (seat && seat.status === 'locked') {
          await seatRepository.releaseExpiredHold(seat, { transaction });
        }

        await syncPaidSeatCounts({
          cohort,
          participant,
          programMapping,
          transaction
        });

        return {
          processed: true,
          refunded: true,
          duplicate: false,
          participant_id: participantId,
          cohort_id: cohortId,
          payment_id: payment.id,
          refund: {
            payment_intent_id: paymentIntentId,
            idempotency_key: refundIdempotencyKey
          }
        };
      }

      const accessPassword = generateParticipantAccessPassword();
      const passwordHash = await bcrypt.hash(accessPassword, env.bcryptSaltRounds);
      const passwordGeneratedAt = new Date();

      if (!seat) {
        seat = await seatRepository.create(
          {
            participantId,
            sponsorshipId: null,
            cohortId,
            programId: participant.programId,
            participantEmail: participant.email,
            status: 'locked',
            lockedAt: now,
            holdExpiresAt: null
          },
          { transaction }
        );
      }

      await seatRepository.update(
        seat,
        {
          programId: participant.programId,
          participantEmail: participant.email,
          status: 'active',
          holdExpiresAt: null,
          activatedAt: new Date()
        },
        { transaction }
      );

      if (payment) {
        await paymentRepository.update(
          payment,
          {
            amount: amount || Number(payment.amount) || cohortPrice,
            status: 'paid',
            transactionId: paymentIntentId || sessionData.id,
            stripeCheckoutSessionId: sessionData.id,
            stripePaymentIntentId: paymentIntentId,
            checkoutUrl: sessionData.url || payment.checkoutUrl,
            completedAt: new Date()
          },
          { transaction }
        );
      } else {
        payment = await paymentRepository.create(
          {
            participantId,
            cohortId,
            amount: amount || cohortPrice,
            status: 'paid',
            transactionId: paymentIntentId || sessionData.id,
            stripeCheckoutSessionId: sessionData.id,
            stripePaymentIntentId: paymentIntentId,
            checkoutUrl: sessionData.url || null,
            completedAt: new Date()
          },
          { transaction }
        );
      }

      await participantRepository.update(
        participant,
        {
          paymentStatus: 'paid',
          registrationStatus: getRegistrationStatusFromPaymentStatus('paid'),
          passwordHash,
          passwordGeneratedAt
        },
        { transaction }
      );

      const seatSync = await syncPaidSeatCounts({
        cohort,
        participant,
        programMapping,
        transaction
      });

      //---- for sending email confirmation -------------//
      confirmationEmailPayload = {
        participantEmail: participant.email,
        participantName: participant.name,
        cohortName: cohort.name,
        cohortId,
        accessPassword
      };
      //-------------------------------------------------//

      console.log('[Stripe Webhook] Enrollment marked successful.', {
        checkout_session_id: sessionData.id,
        participant_id: participantId,
        cohort_id: cohortId,
        program_id: participant.programId || null,
        payment_id: payment.id,
        seats_filled: seatSync.seatsFilled,
        cohort_status: seatSync.cohortStatus,
        program_seats_filled: seatSync.programSeatsFilled,
        program_is_full: seatSync.programIsFull
      });

      return {
        processed: true,
        duplicate: false,
        participant_id: participantId,
        cohort_id: cohortId,
        payment_id: payment.id
      };
    });

    if (result?.processed && result.refunded) {
      if (result.refund?.payment_intent_id) {
        try {
          await stripeService.refundPaymentIntent(result.refund.payment_intent_id, {
            idempotencyKey: result.refund.idempotency_key
          });
        } catch (error) {
          console.error('[Stripe Webhook] CRITICAL: capacity refund failed after DB commit.', {
            checkout_session_id: sessionData.id,
            participant_id: participantId,
            cohort_id: cohortId,
            payment_id: result.payment_id,
            payment_intent_id: result.refund.payment_intent_id,
            idempotency_key: result.refund.idempotency_key,
            error: error.message
          });
        }
      } else {
        console.error('[Stripe Webhook] CRITICAL: capacity refund needs manual resolution.', {
          checkout_session_id: sessionData.id,
          participant_id: participantId,
          cohort_id: cohortId,
          payment_id: result.payment_id,
          reason: 'missing_payment_intent'
        });
      }
    }

    if (result?.processed && !result.refunded) {
      try {
        console.log('[Stripe Webhook] Sending payment confirmation email.', {
          participant_id: participantId,
          cohort_id: cohortId,
          payment_id: result.payment_id
        });
        await sendPaymentConfirmationEmail(confirmationEmailPayload);

        
        const participantMagicLinkResult = await magicLinkService.generateMagicLink({
          email: confirmationEmailPayload.participantEmail,
          role: 'participant',
          cohortId: confirmationEmailPayload.cohortId,
          purpose: 'login'
        });

        const { sendMagicLinkEmail } = require('../utils/helpers');
        await sendMagicLinkEmail({
          email: confirmationEmailPayload.participantEmail,
          name: confirmationEmailPayload.participantName,
          magicLinkUrl: participantMagicLinkResult.magicLinkUrl
        });
      } catch (error) {
        console.error(
          '[Stripe Webhook] Payment confirmation email failed:',
          error.message
        );
      }
    }

    return result;
  }

  async processFailedPaymentIntent(paymentIntentData) {
    const paymentIntentId = paymentIntentData?.id;

    console.log('[Stripe Webhook] Processing payment_intent.payment_failed.', {
      payment_intent_id: paymentIntentId
    });

    if (!paymentIntentId) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Missing payment intent ID.');
    }

    // Look up the checkout session to get participant/cohort metadata
    const session = await stripeService.retrieveCheckoutSessionByPaymentIntent(paymentIntentId);

    if (!session) {
      console.warn('[Stripe Webhook] No checkout session found for payment intent.', {
        payment_intent_id: paymentIntentId
      });
      return { processed: false, reason: 'no_session_found' };
    }

    // Reuse the existing failed session handler — it has all the DB + email logic
    return this.processFailedCheckoutSession(session);
  }

  async processSucceededPaymentIntent(paymentIntentData) {
    const paymentIntentId = paymentIntentData?.id;

    console.log('[Stripe Webhook] Processing payment_intent.succeeded.', {
      payment_intent_id: paymentIntentId || null
    });

    if (!paymentIntentId) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Missing payment intent ID.');
    }

    const session = await stripeService.retrieveCheckoutSessionByPaymentIntent(paymentIntentId);

    if (!session) {
      console.warn('[Stripe Webhook] No checkout session found for successful payment intent.', {
        payment_intent_id: paymentIntentId
      });

      return {
        processed: false,
        reason: 'checkout_session_not_found'
      };
    }

    return this.processCompletedCheckoutSession(session);
  }

  //------------- Process failed checkout session -------------//
  async processFailedCheckoutSession(sessionData) {

    const participantId = Number(sessionData?.metadata?.participant_id);

    const cohortId = Number(sessionData?.metadata?.cohort_id);

    console.log('[Stripe Webhook] Processing checkout.session.async_payment_failed.', {
      checkout_session_id: sessionData?.id || null,
      participant_id: participantId || null,
      cohort_id: cohortId || null,
      payment_intent:
        typeof sessionData?.payment_intent === 'string'
          ? sessionData.payment_intent
          : sessionData?.payment_intent?.id || null,
      amount_total: sessionData?.amount_total ?? null
    });

    if (!participantId || !cohortId) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Missing participant_id or cohort_id in Stripe session metadata.'
      );
    }

    const amount = Number(sessionData.amount_total || 0) / 100;

    const paymentIntentId = getStripePaymentIntentId(sessionData);

    let failedEmailPayload = null;
    const result = await sequelize.transaction(async (transaction) => {
      const participant = await participantRepository.findById(participantId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Participant
        }
      });

      if (!participant || Number(participant.cohortId) !== cohortId) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found for this cohort.');
      }

      const cohort = await cohortRepository.findById(cohortId, {
        transaction,
        lock: {
        level: transaction.LOCK.UPDATE,
        of: sequelize.models.Cohort
      }
      });

      if (!cohort) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
      }
      const cohortPrice = parseStoredPrice(cohort.price);

      let payment = await paymentRepository.findByStripeCheckoutSessionId(sessionData.id, {
        transaction,
        lock: {
        level: transaction.LOCK.UPDATE,
        of: sequelize.models.Payment
      }
      });

      if (!payment) {
        payment = await paymentRepository.findLatestByParticipantAndCohort(participantId, cohortId, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Payment
          }
        });
      }

      if (participant.paymentStatus === 'paid' || participant.paymentStatus === 'refunded') {
        console.log('[Stripe Webhook] Ignoring failed event for already paid participant.', {
          checkout_session_id: sessionData.id,
          participant_id: participantId,
          cohort_id: cohortId
        });

        return {
          processed: false,
          ignored: true,
          reason: `participant_already_${participant.paymentStatus}`
        };
      }

      if (payment && payment.status === 'failed' && participant.paymentStatus === 'failed') {
        return {
          processed: false,
          duplicate: true
        };
      }

      if (payment) {
        await paymentRepository.update(
          payment,
          {
            amount: amount || Number(payment.amount) || cohortPrice,
            status: 'failed',
            transactionId: paymentIntentId || payment.transactionId || sessionData.id,
            stripeCheckoutSessionId: sessionData.id,
            stripePaymentIntentId: paymentIntentId || payment.stripePaymentIntentId,
            checkoutUrl: sessionData.url || payment.checkoutUrl,
            completedAt: null
          },
          { transaction }
        );
      } 
      else {
        payment = await paymentRepository.create(
          {
            participantId,
            cohortId,
            amount: amount || cohortPrice || 0,
            status: 'failed',
            transactionId: paymentIntentId || sessionData.id,
            stripeCheckoutSessionId: sessionData.id,
            stripePaymentIntentId: paymentIntentId,
            checkoutUrl: sessionData.url || null,
            completedAt: null
          },
          { transaction }
        );
      }

      await participantRepository.update(
        participant,
        {
          paymentStatus: 'failed',
          registrationStatus: getRegistrationStatusFromPaymentStatus('failed')
        },
        { transaction }
      );

      const seat = await seatRepository.findSelfPayByParticipantAndCohort(participant.id, cohortId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Seat
        }
      });

      if (seat && seat.status === 'locked') {
        await seatRepository.releaseExpiredHold(seat, { transaction });
      }

      failedEmailPayload = {
        participantEmail: participant.email,
        participantName: participant.name,
        cohortName: cohort.name,
        retryUrl: sessionData.url || '#'
      };

      return {
        processed: true,
        duplicate: false,
        participant_id: participantId,
        cohort_id: cohortId,
        payment_id: payment.id
      };
    });

    if (result?.processed && failedEmailPayload) {
      try {
        await sendPaymentFailedEmail(failedEmailPayload);
      } catch (error) {
        console.error(
          '[Stripe Webhook] Payment failed email send failed:',
          error.message
        );
      }
    }

    return result;
  }

  async processExpiredCheckoutSession(sessionData) {
    const participantId = Number(sessionData?.metadata?.participant_id);
    const cohortId = Number(sessionData?.metadata?.cohort_id);

    console.log('[Stripe Webhook] Processing checkout.session.expired.', {
      checkout_session_id: sessionData?.id || null,
      participant_id: participantId || null,
      cohort_id: cohortId || null,
      amount_total: sessionData?.amount_total ?? null
    });

    if (!participantId || !cohortId) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Missing participant_id or cohort_id in Stripe session metadata.'
      );
    }

    return sequelize.transaction(async (transaction) => {
      const now = new Date();
      const participant = await participantRepository.findById(participantId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Participant
        }
      });

      if (!participant || Number(participant.cohortId) !== cohortId) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found for this cohort.');
      }

      if (participant.paymentStatus === 'paid' || participant.paymentStatus === 'refunded') {
        return {
          processed: false,
          ignored: true,
          reason: `participant_already_${participant.paymentStatus}`
        };
      }

      const payment = await paymentRepository.findByStripeCheckoutSessionId(sessionData.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Payment
        }
      });

      if (!payment) {
        return {
          processed: false,
          ignored: true,
          reason: 'payment_not_found_for_expired_session'
        };
      }

      if (Number(payment.participantId) !== participantId || Number(payment.cohortId) !== cohortId) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Expired Stripe session does not match payment ownership.'
        );
      }

      if (payment.status !== 'pending') {
        return {
          processed: false,
          ignored: true,
          reason: `payment_already_${payment.status}`,
          payment_id: payment.id
        };
      }

      await paymentRepository.update(
        payment,
        {
          status: 'failed',
          completedAt: null
        },
        { transaction }
      );

      const hasOtherPendingPayment =
        await paymentRepository.hasOtherPendingByParticipantAndCohort(
          participantId,
          cohortId,
          payment.id,
          { transaction }
        );

      if (hasOtherPendingPayment) {
        return {
          processed: true,
          participant_id: participantId,
          cohort_id: cohortId,
          payment_id: payment.id,
          participant_updated: false,
          released_seat_id: null,
          reason: 'newer_pending_payment_exists'
        };
      }

      await participantRepository.update(
        participant,
        {
          paymentStatus: 'failed',
          registrationStatus: getRegistrationStatusFromPaymentStatus('failed')
        },
        { transaction }
      );

      const seat = await seatRepository.findSelfPayByParticipantAndCohort(participant.id, cohortId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Seat
        }
      });

      let releasedSeatId = null;

      if (seat && seat.status === 'locked' && !isUnexpiredHold(seat, now)) {
        await seatRepository.releaseExpiredHold(seat, { transaction });
        releasedSeatId = seat.id;
      }

      return {
        processed: true,
        participant_id: participantId,
        cohort_id: cohortId,
        payment_id: payment.id,
        released_seat_id: releasedSeatId
      };
    });
  }

  async releaseExpiredSelfPaySeatHolds({ limit = 100 } = {}) {
    const expiredSeats = await seatRepository.findExpiredSelfPayHolds({ limit });
    const results = [];

    for (const expiredSeat of expiredSeats) {
      let checkoutSessionId = null;
      let released = false;

      await sequelize.transaction(async (transaction) => {
        const now = new Date();
        const seat = await seatRepository.findById(expiredSeat.id, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Seat
          }
        });

        const holdExpiresAt = seat?.holdExpiresAt ? new Date(seat.holdExpiresAt) : null;
        if (
          !seat ||
          seat.status !== 'locked' ||
          seat.sponsorshipId !== null ||
          !holdExpiresAt ||
          holdExpiresAt.getTime() > now.getTime()
        ) {
          return;
        }

        const participant = await participantRepository.findById(seat.participantId, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Participant
          }
        });

        if (
          !participant ||
          participant.paymentStatus === 'paid' ||
          participant.paymentStatus === 'refunded'
        ) {
          return;
        }

        const payment = await paymentRepository.findLatestPendingByParticipantAndCohort(
          seat.participantId,
          seat.cohortId,
          {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.Payment
            }
          }
        );

        if (payment) {
          checkoutSessionId = payment.stripeCheckoutSessionId;
          await paymentRepository.update(payment, { status: 'failed' }, { transaction });
        }

        const hasOtherPendingPayment = payment
          ? await paymentRepository.hasOtherPendingByParticipantAndCohort(
              seat.participantId,
              seat.cohortId,
              payment.id,
              { transaction }
            )
          : false;

        if (!hasOtherPendingPayment) {
          await participantRepository.update(
            participant,
            {
              paymentStatus: 'failed',
              registrationStatus: getRegistrationStatusFromPaymentStatus('failed')
            },
            { transaction }
          );
        }

        await seatRepository.releaseExpiredHold(seat, { transaction });
        released = true;
      });

      if (checkoutSessionId) {
        try {
          await stripeService.expireCheckoutSession(checkoutSessionId);
        } catch (error) {
          console.warn('[Seat Hold] Stripe checkout session expiration skipped.', {
            checkout_session_id: checkoutSessionId,
            error: error.message
          });
        }
      }

      if (released) {
        results.push({
          seat_id: expiredSeat.id,
          checkout_session_id: checkoutSessionId
        });
      }
    }

    return {
      processed: results.length,
      released: results
    };
  }

  async syncRequestedStripeInvoice(stripeInvoice, stripeEventId, { markSent = false } = {}) {
    const metadata = stripeInvoice?.metadata || {};

    if (metadata.flow !== EMPLOYER_FUNDED_FLOW) {
      return { processed: false, reason: 'unsupported_flow' };
    }

    const result = await sequelize.transaction(async (transaction) => {
      const invoice = await invoiceRepository.findByStripeInvoiceId(stripeInvoice.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Invoice
        }
      });

      if (!invoice) {
        return { processed: false, ignored: true, reason: 'local_invoice_not_found_yet' };
      }

      if (['paid', 'failed', 'refunded'].includes(invoice.status)) {
        return { processed: false, ignored: true, reason: `invoice_already_${invoice.status}` };
      }

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

      return {
        processed: true,
        invoice_id: invoice.id,
        invoice_status: 'invoice_requested',
        stripe_invoice_status: stripeInvoice.status || null
      };
    });

    return result;
  }

  async processCreatedStripeInvoice(stripeInvoice, stripeEventId) {
    return this.syncRequestedStripeInvoice(stripeInvoice, stripeEventId);
  }

  async processFinalizedStripeInvoice(stripeInvoice, stripeEventId) {
    return this.syncRequestedStripeInvoice(stripeInvoice, stripeEventId);
  }

  async processSentStripeInvoice(stripeInvoice, stripeEventId) {
    return this.syncRequestedStripeInvoice(stripeInvoice, stripeEventId, { markSent: true });
  }

  async processPaidStripeInvoice(stripeInvoice, stripeEventId) {
    const metadata = stripeInvoice?.metadata || {};

    if (metadata.flow !== EMPLOYER_FUNDED_FLOW) {
      return { processed: false, reason: 'unsupported_flow' };
    }

    const participantId = Number(metadata.participant_id);
    const cohortId = Number(metadata.cohort_id);
    const seatId = Number(metadata.seat_id);

    if (!participantId || !cohortId || !seatId) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'Missing participant_id, cohort_id, or seat_id in Stripe invoice metadata.'
      );
    }

    const stripeAmountPaidInCents = Number(stripeInvoice.amount_paid || 0);
    const stripeTotalInCents = Number(stripeInvoice.total ?? stripeInvoice.amount_due ?? 0);

    if (
      !Number.isFinite(stripeAmountPaidInCents) ||
      !Number.isFinite(stripeTotalInCents) ||
      stripeAmountPaidInCents <= 0 ||
      stripeTotalInCents <= 0
    ) {
      console.warn('[Stripe Webhook] Ignoring zero-amount invoice.paid event.', {
        stripe_invoice_id: stripeInvoice.id,
        stripe_amount_paid: stripeAmountPaidInCents,
        stripe_total: stripeTotalInCents
      });

      return {
        processed: false,
        ignored: true,
        reason: 'zero_amount_invoice_paid_event'
      };
    }

    let confirmationEmailPayload = null;

    const result = await sequelize.transaction(async (transaction) => {
      const invoice = await invoiceRepository.findByStripeInvoiceId(stripeInvoice.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Invoice
        }
      });

      if (!invoice) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Local invoice record not found.');
      }

      if (invoice.status === 'paid' && invoice.stripeEventId === stripeEventId) {
        return { processed: false, duplicate: true };
      }

      if (invoice.status === 'paid') {
        return { processed: false, duplicate: true };
      }

      const localInvoiceAmountInCents = Math.round(Number(invoice.amount || 0) * 100);

      if (
        !Number.isFinite(localInvoiceAmountInCents) ||
        localInvoiceAmountInCents <= 0 ||
        stripeAmountPaidInCents < localInvoiceAmountInCents
      ) {
        console.warn('[Stripe Webhook] Ignoring invoice.paid without full payable amount.', {
          stripe_invoice_id: stripeInvoice.id,
          stripe_amount_paid: stripeAmountPaidInCents,
          local_invoice_amount: localInvoiceAmountInCents
        });

        await invoiceRepository.update(
          invoice,
          {
            status: 'invoice_requested',
            stripeEventId,
            hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || invoice.hostedInvoiceUrl,
            invoicePdfUrl: stripeInvoice.invoice_pdf || invoice.invoicePdfUrl
          },
          { transaction }
        );

        return {
          processed: false,
          ignored: true,
          reason: 'invoice_paid_event_without_full_amount'
        };
      }

      const seat = await seatRepository.findById(seatId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Seat
        }
      });

      const participant = await participantRepository.findById(participantId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Participant
        }
      });

      const cohort = await cohortRepository.findById(cohortId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Cohort
        }
      });

      if (!seat || Number(seat.participantId) !== participantId || Number(seat.cohortId) !== cohortId) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Seat not found for this registration.');
      }

      if (!participant || Number(participant.cohortId) !== cohortId) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found for this cohort.');
      }

      if (!cohort) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
      }

      if (participant.paymentStatus === 'paid' && seat.status === 'active') {
        await invoiceRepository.update(
          invoice,
          {
            status: 'paid',
            paidAt: invoice.paidAt || new Date(),
            stripeEventId
          },
          { transaction }
        );

        return { processed: false, duplicate: true };
      }

      if (!cohort.isActive || cohort.status === 'closed') {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'Payment received but no seats are currently available for this cohort.'
        );
      }

      const paidCohortSeats = await participantRepository.countEnrolledByCohort(cohortId, {
        transaction
      });

      if (paidCohortSeats >= Number(cohort.seatLimit)) {
        throw new ApiError(
          HTTP_STATUS.CONFLICT,
          'Payment received but no seats are currently available for this cohort.'
        );
      }

      const programMapping = await ensureProgramSeatAvailableForPaidEnrollment(participant, transaction);
      const cohortPrice = parseStoredPrice(cohort.price);
      const amount = Number(stripeInvoice.amount_paid || 0) / 100;
      const paymentIntentId =
        typeof stripeInvoice.payment_intent === 'string'
          ? stripeInvoice.payment_intent
          : stripeInvoice.payment_intent?.id || stripeInvoice.id;

      await seatRepository.update(
        seat,
        {
          status: 'active',
          activatedAt: new Date()
        },
        { transaction }
      );

      await invoiceRepository.update(
        invoice,
        {
          status: 'paid',
          paidAt: new Date(),
          stripeEventId,
          hostedInvoiceUrl: stripeInvoice.hosted_invoice_url || invoice.hostedInvoiceUrl,
          invoicePdfUrl: stripeInvoice.invoice_pdf || invoice.invoicePdfUrl
        },
        { transaction }
      );

      let payment = await paymentRepository.findByStripeInvoiceId(stripeInvoice.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Payment
        }
      });

      if (!payment) {
        payment = await paymentRepository.findLatestByParticipantAndCohort(participantId, cohortId, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Payment
          }
        });
      }

      const accessPassword = generateParticipantAccessPassword();
      const passwordHash = await bcrypt.hash(accessPassword, env.bcryptSaltRounds);
      const passwordGeneratedAt = new Date();

      const paymentPayload = {
        amount: amount || Number(payment?.amount) || cohortPrice,
        status: 'paid',
        paymentMethod: 'stripe_invoice',
        transactionId: paymentIntentId,
        stripeInvoiceId: stripeInvoice.id,
        invoiceId: invoice.id,
        checkoutUrl: stripeInvoice.hosted_invoice_url || payment?.checkoutUrl || null,
        completedAt: new Date()
      };

      if (payment) {
        await paymentRepository.update(payment, paymentPayload, { transaction });
      } else {
        payment = await paymentRepository.create(
          {
            participantId,
            cohortId,
            ...paymentPayload
          },
          { transaction }
        );
      }

      await participantRepository.update(
        participant,
        {
          paymentStatus: 'paid',
          registrationStatus: getRegistrationStatusFromPaymentStatus('paid'),
          passwordHash,
          passwordGeneratedAt
        },
        { transaction }
      );

      const seatSync = await syncPaidSeatCounts({
        cohort,
        participant,
        programMapping,
        transaction
      });

      confirmationEmailPayload = {
        participantEmail: participant.email,
        participantName: participant.name,
        cohortName: cohort.name,
        cohortId,
        accessPassword,
        managerEmail: invoice.managerEmail,
        managerName: invoice.managerName
      };

      console.log('[Stripe Webhook] Employer invoice paid — enrollment activated.', {
        stripe_invoice_id: stripeInvoice.id,
        participant_id: participantId,
        cohort_id: cohortId,
        seat_id: seatId,
        payment_id: payment.id,
        seats_filled: seatSync.seatsFilled
      });

      return {
        processed: true,
        duplicate: false,
        participant_id: participantId,
        cohort_id: cohortId,
        payment_id: payment.id
      };
    });

    if (result?.processed && confirmationEmailPayload) {
      try {
        await sendPaymentConfirmationEmail(confirmationEmailPayload);
        
        const participantMagicLinkResult = await magicLinkService.generateMagicLink({
          email: confirmationEmailPayload.participantEmail,
          role: 'participant',
          cohortId: confirmationEmailPayload.cohortId,
          purpose: 'login'
        });

    
        await sendMagicLinkEmail({
          email: confirmationEmailPayload.participantEmail,
          name: confirmationEmailPayload.participantName,
          magicLinkUrl: participantMagicLinkResult.magicLinkUrl
        });

        await sendEmployerPaymentReceivedEmail(confirmationEmailPayload);
        
        await crmService.update({
          email: confirmationEmailPayload.participantEmail,
          tags: ['Enrollment Confirmed']
        });
      } catch (error) {
        console.error('[Stripe Webhook] Employer paid notification email failed:', error.message);
      }
    }

    return result;
  }

  async processFailedStripeInvoice(stripeInvoice, stripeEventId) {
    const metadata = stripeInvoice?.metadata || {};

    if (metadata.flow !== EMPLOYER_FUNDED_FLOW) {
      return { processed: false, reason: 'unsupported_flow' };
    }

    const result = await sequelize.transaction(async (transaction) => {
      const invoice = await invoiceRepository.findByStripeInvoiceId(stripeInvoice.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Invoice
        }
      });

      if (!invoice || invoice.status === 'paid') {
        return { processed: false, ignored: true };
      }

      await invoiceRepository.update(
        invoice,
        {
          status: 'failed',
          stripeEventId
        },
        { transaction }
      );

      const payment = await paymentRepository.findByStripeInvoiceId(stripeInvoice.id, { transaction });

      if (payment && payment.status !== 'paid') {
        await paymentRepository.update(
          payment,
          {
            status: 'failed'
          },
          { transaction }
        );
      }

      const participant = await participantRepository.findById(invoice.participantId, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Participant
        }
      });

      if (participant && participant.paymentStatus !== 'paid') {
        await participantRepository.update(
          participant,
          {
            paymentStatus: 'failed',
            registrationStatus: getRegistrationStatusFromPaymentStatus('failed')
          },
          { transaction }
        );
      }

      return {
        processed: true,
        invoice_id: invoice.id,
        participant_email: participant ? participant.email : null
      };
    });

    if (result?.processed && result.participant_email) {
      try {
        await crmService.update({
          email: result.participant_email,
          tags: ['Payment Failed']
        });
      } catch (error) {
        console.error('[Stripe Webhook] CRM update failed:', error.message);
      }
    }

    return result;
  }

  async processVoidedStripeInvoice(stripeInvoice, stripeEventId) {
    const metadata = stripeInvoice?.metadata || {};

    if (metadata.flow !== EMPLOYER_FUNDED_FLOW) {
      return { processed: false, reason: 'unsupported_flow' };
    }

    const seatId = Number(metadata.seat_id);

    const result = await sequelize.transaction(async (transaction) => {
      const invoice = await invoiceRepository.findByStripeInvoiceId(stripeInvoice.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Invoice
        }
      });

      if (!invoice) {
        return { processed: false, ignored: true };
      }

      if (invoice.status === 'paid') {
        return { processed: false, ignored: true, reason: 'already_paid' };
      }

      await invoiceRepository.update(
        invoice,
        {
          status: 'failed',
          stripeEventId
        },
        { transaction }
      );

      if (seatId) {
        const seat = await seatRepository.findById(seatId, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Seat
          }
        });

        if (seat && seat.status === 'locked') {
          await seatRepository.update(
            seat,
            {
              status: 'available'
            },
            { transaction }
          );
        }
      }

      const payment = await paymentRepository.findByStripeInvoiceId(stripeInvoice.id, { transaction });

      if (payment && payment.status !== 'paid') {
        await paymentRepository.update(
          payment,
          {
            status: 'failed'
          },
          { transaction }
        );
      }

      return {
        processed: true,
        invoice_id: invoice.id
      };
    });

    return result;
  }

  async getUpcomingCohortFileDownload(payload) {
    const participants = await participantRepository.findPaidWithPassword();

    if (!participants.length) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid password.');
    }

    let matchedParticipant = null;

    for (const participant of participants) {
      if (!participant.passwordHash) {
        continue;
      }

      const isPasswordValid = await bcrypt.compare(payload.password, participant.passwordHash);
      if (isPasswordValid) {
        matchedParticipant = participant;
        break;
      }
    }

    if (!matchedParticipant) {
      throw new ApiError(HTTP_STATUS.UNAUTHORIZED, 'Invalid password.');
    }

    await ensureUpcomingCohortFileExists();

    return {
      fileName: UPCOMING_COHORT_FILE_NAME,
      filePath: UPCOMING_COHORT_FILE_PATH,
      participant: {
        id: matchedParticipant.id,
        email: matchedParticipant.email,
        name: matchedParticipant.name
      }
    };
  }
}

module.exports = new ApplicationService();
