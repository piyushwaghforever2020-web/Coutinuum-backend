const { sequelize } = require('../models');
const cohortRepository = require('../repositories/cohort.repository');
const paymentRepository = require('../repositories/payment.repository');
const participantRepository = require('../repositories/participant.repository');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');
const { getRegistrationStatusFromPaymentStatus } = require('../utils/participantStatus');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const getCohortStatusForSeatCount = (cohort, seatsFilled) =>
  cohort.status === 'closed'
    ? 'closed'
    : Number(seatsFilled) >= Number(cohort.seatLimit)
      ? 'full'
      : 'active';

const isProgramFullForSeatCount = (programMapping, seatsFilled) =>
  Number(programMapping.allocatedSeats) > 0 &&
  Number(seatsFilled) >= Number(programMapping.allocatedSeats);

const mapPayment = (payment) => ({
  id: payment.id,
  amount: Number(payment.amount),
  status: payment.status,
  transaction_id: payment.transactionId,
  stripe_checkout_session_id: payment.stripeCheckoutSessionId,
  stripe_payment_intent_id: payment.stripePaymentIntentId,
  checkout_url: payment.checkoutUrl,
  completed_at: payment.completedAt,
  created_at: payment.createdAt,
  participant: payment.participant
    ? {
        id: payment.participant.id,
        name: payment.participant.name,
        email: payment.participant.email,
        phone: payment.participant.phone,
        company: payment.participant.company,
        role: payment.participant.role,
        payment_status: payment.participant.paymentStatus,
        registration_status: getRegistrationStatusFromPaymentStatus(
          payment.participant.paymentStatus
        )
      }
    : null,
  cohort: payment.cohort
    ? {
        id: payment.cohort.id,
        name: payment.cohort.name,
        start_date: payment.cohort.startDate,
        price: Number(payment.cohort.price),
        status: payment.cohort.status,
        refund_policy: payment.cohort.refundPolicy
      }
    : null
});

class PaymentService {
  async getPayments(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const filters = {
      search: query.search,
      status: query.status,
      cohortId: query.cohort
    };

    const { rows, count } = await paymentRepository.findAll({
      filters,
      limit,
      offset
    });

    return {
      items: rows.map(mapPayment),
      pagination: buildPaginationMeta(count, page, limit)
    };
  }

  async getPaymentById(id) {
    const payment = await paymentRepository.findById(id);

    if (!payment) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Payment not found.');
    }

    return mapPayment(payment);
  }

  async refundPayment(id) {
    await sequelize.transaction(async (transaction) => {
      const payment = await paymentRepository.findById(id, { transaction });

      if (!payment) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Payment not found.');
      }

      if (payment.status === 'refunded') {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Payment has already been refunded.');
      }

      if (payment.status !== 'paid') {
        throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Only paid payments can be refunded.');
      }

      await paymentRepository.update(
        payment,
        {
          status: 'refunded'
        },
        { transaction }
      );

      if (payment.participant) {
        await participantRepository.update(
          payment.participant,
          {
            paymentStatus: 'refunded',
            registrationStatus: getRegistrationStatusFromPaymentStatus('refunded')
          },
          { transaction }
        );

        const cohort = await cohortRepository.findById(payment.cohortId, {
          transaction,
          lock: transaction.LOCK.UPDATE
        });
        const seatsFilled = await participantRepository.countEnrolledByCohort(payment.cohortId, {
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

        if (payment.participant.programId) {
          const programMapping = await cohortRepository.findProgramMapping(
            payment.cohortId,
            payment.participant.programId,
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
                payment.cohortId,
                payment.participant.programId,
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
        }
      }
    });

    return this.getPaymentById(id);
  }

  async refundPaymentByParticipantId(participantId) {
    const participant = await participantRepository.findById(participantId);

    if (!participant) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found.');
    }

    const payment = await paymentRepository.findLatestPaidByParticipantAndCohort(
      participant.id,
      participant.cohortId
    );

    if (!payment) {
      throw new ApiError(
        HTTP_STATUS.BAD_REQUEST,
        'No paid payment found for this participant.'
      );
    }

    return this.refundPayment(payment.id);
  }
}

module.exports = new PaymentService();
