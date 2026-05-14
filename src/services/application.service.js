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
const { getRegistrationStatusFromPaymentStatus } = require('../utils/participantStatus');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');
const { sendPaymentConfirmationEmail,sendPaymentFailedEmail } = require('../utils/helpers');

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

const ensureCohortAvailableForPayment = (cohort) => {
  if (!cohort.isActive) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'This cohort is inactive.');
  }

  if (cohort.status === 'closed') {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'This cohort is closed for enrollment.');
  }

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

const ensureProgramSeatAvailableForPayment = async (participant, transaction) => {
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

    const cohort = participant.cohort || (await ensureCohortExists(payload.cohort_id));
    ensureCohortAvailableForPayment(cohort);
    const cohortPrice = parseStoredPrice(cohort.price);

    if (!Number.isFinite(cohortPrice)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid cohort price.');
    }

    const latestPayment = participant.payments?.length
      ? [...participant.payments].sort(
          (left, right) => new Date(right.createdAt) - new Date(left.createdAt)
        )[0]
      : await paymentRepository.findLatestByParticipantAndCohort(participant.id, payload.cohort_id);

    const reusableSession = await findOpenStripeSession(latestPayment);

    if (reusableSession) {
      return {
        participant_id: participant.id,
        cohort_id: cohort.id,
        session_id: reusableSession.id,
        checkout_url: reusableSession.url,
        reused_existing_session: true
      };
    }

    const session = await stripeService.createCheckoutSession({
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

      ensureCohortAvailableForPayment(lockedCohort);

      const paidCohortSeats = await participantRepository.countEnrolledByCohort(
        lockedCohort.id,
        { transaction }
      );

      if (paidCohortSeats >= Number(lockedCohort.seatLimit)) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'No seats available for this cohort.');
      }

      await ensureProgramSeatAvailableForPayment(lockedParticipant, transaction);

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
        stripeCheckoutSessionId: session.id,
        stripePaymentIntentId:
          typeof session.payment_intent === 'string' ? session.payment_intent : null,
        checkoutUrl: session.url,
        completedAt: null
      };

      if (currentPayment && currentPayment.status !== 'paid') {
        await paymentRepository.update(currentPayment, paymentPayload, { transaction });
      } else {
        await paymentRepository.create(paymentPayload, { transaction });
      }

      await participantRepository.update(
        lockedParticipant,
        {
          paymentStatus: 'pending',
          registrationStatus: getRegistrationStatusFromPaymentStatus('pending')
        },
        { transaction }
      );
    });

    return {
      participant_id: participant.id,
      cohort_id: cohort.id,
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
    const paymentIntentId =
      typeof sessionData.payment_intent === 'string'
        ? sessionData.payment_intent
        : sessionData.payment_intent?.id || null;

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

      const programMapping = await ensureProgramSeatAvailableForPayment(participant, transaction);
      const accessPassword = generateParticipantAccessPassword();
      const passwordHash = await bcrypt.hash(accessPassword, env.bcryptSaltRounds);
      const passwordGeneratedAt = new Date();

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

    if (result?.processed) {
      try {
        await sendPaymentConfirmationEmail(confirmationEmailPayload);
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

    const paymentIntentId =
      typeof sessionData.payment_intent === 'string'
        ? sessionData.payment_intent
        : sessionData.payment_intent?.id || null;

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

      if (participant.paymentStatus === 'paid') {
        console.log('[Stripe Webhook] Ignoring failed event for already paid participant.', {
          checkout_session_id: sessionData.id,
          participant_id: participantId,
          cohort_id: cohortId
        });

        return {
          processed: false,
          ignored: true,
          reason: 'participant_already_paid'
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
