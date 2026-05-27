const { sequelize } = require('../models');
const env = require('../config/env');
const cohortRepository = require('../repositories/cohort.repository');
const participantRepository = require('../repositories/participant.repository');
const paymentRepository = require('../repositories/payment.repository');
const seatRepository = require('../repositories/seat.repository');
const invoiceRepository = require('../repositories/invoice.repository');
const stripeService = require('./stripe.service');
const crmService = require('./crm.service');
const applicationService = require('./application.service');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS, EMPLOYER_FUNDED_FLOW } = require('../constants/app.constants');
const { getRegistrationStatusFromPaymentStatus } = require('../utils/participantStatus');
const {
  sendEmployerInvoiceSentEmail,
  sendEmployerFundingPendingEmail
} = require('../utils/helpers');

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

const getApplicationProgramId = (payload) =>
  payload.program_id ?? payload.programm_id ?? null;

const isProgramFullForSeatCount = (programMapping, seatsFilled) =>
  Number(programMapping.allocatedSeats) > 0 &&
  Number(seatsFilled) >= Number(programMapping.allocatedSeats);

const buildEmployerResponse = (participant, seat, invoice, reused = false) => ({
  flow: 'employer_invoice',
  reused_existing_invoice: reused,
  participant_id: participant.id,
  seat_id: seat.id,
  seat_status: seat.status,
  invoice_id: invoice.id,
  stripe_invoice_id: invoice.stripeInvoiceId,
  hosted_invoice_url: invoice.hostedInvoiceUrl,
  payment_status: participant.paymentStatus,
  registration_status: getRegistrationStatusFromPaymentStatus(participant.paymentStatus)
});

class EmployerFundedRegistrationService {
  async registerEmployerFundedIndividual(payload) {
    const participantEmail = normalizeEmail(payload.email);
    const managerEmail = normalizeEmail(payload.manager_email);
    const programId = getApplicationProgramId(payload);

    const cohort = await cohortRepository.findActiveById(payload.cohort_id);
    if (!cohort) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Cohort not found.');
    }

    if (cohort.syncStatus === 'closed' || !cohort.isActive) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Closed cohort cannot accept new applications.');
    }

    if (cohort.status === 'full') {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Cohort is full and cannot accept new applications.');
    }

    if (programId) {
      const hasProgram = (cohort.programs || []).some(
        (program) => Number(program.id) === Number(programId)
      );

      if (!hasProgram) {
        throw new ApiError(
          HTTP_STATUS.BAD_REQUEST,
          'Selected program is not available for this cohort.'
        );
      }
    }

    const cohortPrice = parseStoredPrice(cohort.price);
    if (!Number.isFinite(cohortPrice)) {
      throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invalid cohort price.');
    }

    let participant;
    let seat;
    let existingOpenInvoice = null;

    await sequelize.transaction(async (transaction) => {
      const lockedCohort = await cohortRepository.findById(cohort.id, {
        transaction,
        lock: {
          level: transaction.LOCK.UPDATE,
          of: sequelize.models.Cohort
        }
      });

      const reservedSeats = await seatRepository.countReservedByCohort(lockedCohort.id, {
        transaction
      });

      participant = await participantRepository.findByEmailAndCohort(
        participantEmail,
        lockedCohort.id,
        {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Participant
          }
        }
      );

      if (participant?.paymentStatus === 'paid') {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'User already enrolled for this cohort.');
      }

      seat = participant
        ? await seatRepository.findByParticipantAndCohort(participant.id, lockedCohort.id, {
            transaction,
            lock: {
              level: transaction.LOCK.UPDATE,
              of: sequelize.models.Seat
            }
          })
        : null;

      const hasExistingReservation = seat && ['locked', 'assigned', 'active'].includes(seat.status);
      if (!hasExistingReservation && reservedSeats >= Number(lockedCohort.seatLimit)) {
        throw new ApiError(HTTP_STATUS.CONFLICT, 'No seats available for this cohort.');
      }

      if (seat?.status === 'locked') {
        existingOpenInvoice = await invoiceRepository.findBySeatId(seat.id, { transaction });
        if (existingOpenInvoice && ['created', 'sent'].includes(existingOpenInvoice.status)) {
          return;
        }
      }

      if (programId) {
        const programMapping = await cohortRepository.findProgramMapping(
          lockedCohort.id,
          programId,
          { transaction }
        );

        if (!programMapping) {
          throw new ApiError(
            HTTP_STATUS.BAD_REQUEST,
            'Selected program is not available for this cohort.'
          );
        }

        const paidProgramSeats = await participantRepository.countEnrolledByCohortAndProgram(
          lockedCohort.id,
          programId,
          { transaction }
        );

        if (isProgramFullForSeatCount(programMapping, paidProgramSeats)) {
          throw new ApiError(HTTP_STATUS.CONFLICT, 'No seats available for this program.');
        }
      }

      if (!participant) {
        participant = await participantRepository.create(
          {
            name: payload.name,
            email: participantEmail,
            phone: payload.phone || null,
            company: payload.company || null,
            role: payload.role || null,
            cohortId: lockedCohort.id,
            programId,
            answers: payload.answers ?? null,
            agreeEmail: Boolean(payload.agree_email),
            agreeSms: Boolean(payload.agree_sms),
            employerFunded: true,
            paymentType: 'employer_funded',
            billingManagerName: payload.manager_name,
            billingManagerEmail: managerEmail,
            billingPhone: payload.billing_phone,
            billingAddress: payload.billing_address,
            billingCity: payload.billing_city,
            billingZipCode: payload.billing_zip_code,
            paymentStatus: 'pending',
            registrationStatus: getRegistrationStatusFromPaymentStatus('pending'),
            isActive: true
          },
          { transaction }
        );
      } else {
        await participantRepository.update(
          participant,
          {
            name: payload.name,
            phone: payload.phone || null,
            company: payload.company || null,
            role: payload.role || null,
            programId,
            answers: payload.answers ?? null,
            agreeEmail: Boolean(payload.agree_email),
            agreeSms: Boolean(payload.agree_sms),
            employerFunded: true,
            paymentType: 'employer_funded',
            billingManagerName: payload.manager_name,
            billingManagerEmail: managerEmail,
            billingPhone: payload.billing_phone,
            billingAddress: payload.billing_address,
            billingCity: payload.billing_city,
            billingZipCode: payload.billing_zip_code,
            paymentStatus: 'pending',
            registrationStatus: getRegistrationStatusFromPaymentStatus('pending')
          },
          { transaction }
        );
      }

      if (!seat) {
        seat = await seatRepository.create(
          {
            participantId: participant.id,
            cohortId: lockedCohort.id,
            participantEmail,
            status: 'locked',
            lockedAt: new Date()
          },
          { transaction }
        );
      } else if (seat.status !== 'locked') {
        await seatRepository.update(
          seat,
          {
            status: 'locked',
            lockedAt: new Date(),
            activatedAt: null,
            assignedAt: null
          },
          { transaction }
        );
      }
    });

    if (existingOpenInvoice) {
      return buildEmployerResponse(participant, seat, existingOpenInvoice, true);
    }

    const metadata = {
      flow: EMPLOYER_FUNDED_FLOW,
      participant_id: String(participant.id),
      participant_email: participantEmail,
      cohort_id: String(cohort.id),
      seat_id: String(seat.id),
      payment_type: 'employer_funded'
    };

    let stripeResult;
    try {
      stripeResult = await stripeService.createAndSendEmployerInvoice({
        managerEmail,
        managerName: payload.manager_name,
        amount: cohortPrice,
        currency: env.stripe.currency,
        cohortName: cohort.name,
        metadata
      });
    } catch (error) {
      await sequelize.transaction(async (transaction) => {
        const lockedSeat = await seatRepository.findById(seat.id, {
          transaction,
          lock: {
            level: transaction.LOCK.UPDATE,
            of: sequelize.models.Seat
          }
        });

        if (lockedSeat && lockedSeat.status === 'locked') {
          await seatRepository.update(
            lockedSeat,
            {
              status: 'available'
            },
            { transaction }
          );
        }
      });

      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Failed to create employer invoice. Please try again.'
      );
    }

    let invoice;
    await sequelize.transaction(async (transaction) => {
      invoice = await invoiceRepository.create(
        {
          seatId: seat.id,
          participantId: participant.id,
          cohortId: cohort.id,
          stripeCustomerId: stripeResult.customerId,
          stripeInvoiceId: stripeResult.invoiceId,
          stripeInvoiceNumber: stripeResult.invoiceNumber,
          managerName: payload.manager_name,
          managerEmail,
          amount: cohortPrice,
          currency: env.stripe.currency,
          status: stripeResult.status,
          hostedInvoiceUrl: stripeResult.hostedInvoiceUrl,
          invoicePdfUrl: stripeResult.invoicePdfUrl,
          sentAt: new Date()
        },
        { transaction }
      );

      const existingPayment = await paymentRepository.findLatestByParticipantAndCohort(
        participant.id,
        cohort.id,
        { transaction }
      );

      const paymentPayload = {
        participantId: participant.id,
        cohortId: cohort.id,
        amount: cohortPrice,
        status: 'pending',
        paymentMethod: 'stripe_invoice',
        stripeInvoiceId: stripeResult.invoiceId,
        invoiceId: invoice.id,
        transactionId: null,
        stripeCheckoutSessionId: null,
        stripePaymentIntentId: null,
        checkoutUrl: stripeResult.hostedInvoiceUrl,
        completedAt: null
      };

      if (existingPayment && existingPayment.status !== 'paid') {
        await paymentRepository.update(existingPayment, paymentPayload, { transaction });
      } else {
        await paymentRepository.create(paymentPayload, { transaction });
      }
    });

    try {
      await sendEmployerInvoiceSentEmail({
        managerEmail,
        managerName: payload.manager_name,
        participantName: participant.name,
        cohortName: cohort.name,
        hostedInvoiceUrl: stripeResult.hostedInvoiceUrl
      });

      await sendEmployerFundingPendingEmail({
        participantEmail,
        participantName: participant.name,
        cohortName: cohort.name,
        managerName: payload.manager_name
      });
      
      await crmService.update({
        email: participantEmail,
        tags: ['Pending Employer Payment']
      });
    } catch (error) {
      console.error('[Employer Registration] Notification email failed:', error.message);
    }

    return buildEmployerResponse(participant, seat, invoice, false);
  }

  async registerCohort(payload) {
    if (payload.payment_type === 'self_pay') {
      const participant = await applicationService.submitApplication({
        ...payload,
        employer_funded: false
      });

      return {
        flow: 'checkout',
        participant,
        next_step: 'POST /create-checkout-session'
      };
    }

    if (payload.payment_type === 'employer_funded') {
      return this.registerEmployerFundedIndividual(payload);
    }

    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Unsupported payment_type.');
  }
}

module.exports = new EmployerFundedRegistrationService();
