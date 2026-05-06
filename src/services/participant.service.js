const { sequelize } = require('../models');
const cohortRepository = require('../repositories/cohort.repository');
const participantRepository = require('../repositories/participant.repository');
const paymentService = require('./payment.service');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');
const { convertToCsv } = require('../utils/csv');
const {
  getParticipantPaymentStatus,
  getRegistrationStatusFromPaymentStatus,
  normalizeParticipantPaymentStatusInput
} = require('../utils/participantStatus');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const mapParticipantSummary = (participant) => ({
  id: participant.id,
  name: participant.name,
  email: participant.email,
  phone: participant.phone,
  company: participant.company,
  role: participant.role,
  program_id: participant.programId,
  answers: participant.answers,
  payment_status: getParticipantPaymentStatus(participant.paymentStatus),
  registration_status: getRegistrationStatusFromPaymentStatus(participant.paymentStatus),
  is_active: Boolean(participant.isActive),
  created_at: participant.createdAt,
  cohort: participant.cohort
    ? {
        id: participant.cohort.id,
        name: participant.cohort.name,
        start_date: participant.cohort.startDate,
        price: Number(participant.cohort.price),
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

class ParticipantService {
  async getParticipants(query) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const cohortIds =
      Array.isArray(query.cohort_ids) && query.cohort_ids.length
        ? query.cohort_ids
        : undefined;

    const filters = {
      search: query.search,
      cohortId: cohortIds ? undefined : query.cohort,
      cohortIds,
      paymentStatus: normalizeParticipantPaymentStatusInput(query.payment_status),
      registrationStatus: query.registration_status,
      isActive: query.is_active
    };

    const { rows, count } = await participantRepository.findAll({
      filters,
      limit,
      offset
    });

    return {
      items: rows.map(mapParticipantSummary),
      pagination: buildPaginationMeta(count, page, limit)
    };
  }

  async getParticipantById(id) {
    const participant = await participantRepository.findById(id);

    if (!participant) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found.');
    }

    return {
      id: participant.id,
      name: participant.name,
      email: participant.email,
      phone: participant.phone,
      company: participant.company,
      role: participant.role,
      program_id: participant.programId,
      answers: participant.answers,
      payment_status: getParticipantPaymentStatus(participant.paymentStatus),
      registration_status: getRegistrationStatusFromPaymentStatus(participant.paymentStatus),
      is_active: Boolean(participant.isActive),
      created_at: participant.createdAt,
      cohort: participant.cohort
        ? {
            id: participant.cohort.id,
            name: participant.cohort.name,
            description: participant.cohort.description,
            start_date: participant.cohort.startDate,
            price: Number(participant.cohort.price),
            status: participant.cohort.status,
            is_active: Boolean(participant.cohort.isActive),
            refund_policy: participant.cohort.refundPolicy
          }
        : null,
      program: participant.program
        ? {
            id: participant.program.id,
            name: participant.program.name
          }
        : null,
      payments: [...participant.payments]
        .sort((left, right) => new Date(right.createdAt) - new Date(left.createdAt))
        .map((payment) => ({
          id: payment.id,
          amount: Number(payment.amount),
          status: payment.status,
          transaction_id: payment.transactionId,
          stripe_checkout_session_id: payment.stripeCheckoutSessionId,
          stripe_payment_intent_id: payment.stripePaymentIntentId,
          created_at: payment.createdAt
        }))
    };
  }

  async updateParticipantStatus(id, payload) {
    const normalizedPaymentStatus = normalizeParticipantPaymentStatusInput(payload.payment_status);

    await sequelize.transaction(async (transaction) => {
      const participant = await participantRepository.findById(id, { transaction });

      if (!participant) {
        throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found.');
      }

      await participantRepository.update(
        participant,
        {
          paymentStatus: normalizedPaymentStatus ?? participant.paymentStatus,
          registrationStatus: getRegistrationStatusFromPaymentStatus(
            normalizedPaymentStatus ?? participant.paymentStatus
          )
        },
        { transaction }
      );

      const cohort = await cohortRepository.findById(participant.cohortId, {
        transaction,
        lock: transaction.LOCK.UPDATE
      });
      const seatsFilled = await participantRepository.countEnrolledByCohort(participant.cohortId, {
        transaction
      });

      await cohortRepository.update(
        cohort,
        {
          seatsFilled,
          status:
            cohort.status === 'closed'
              ? 'closed'
              : seatsFilled >= cohort.seatLimit
                ? 'full'
                : 'active'
        },
        { transaction }
      );
    });

    return this.getParticipantById(id);
  }

  async updateParticipantActiveStatus(id, payload) {
    const participant = await participantRepository.findById(id);

    if (!participant) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Participant not found.');
    }

    await participantRepository.update(participant, {
      isActive: payload.is_active
    });

    return this.getParticipantById(id);
  }

  async refundParticipantPayment(id) {
    return paymentService.refundPaymentByParticipantId(id);
  }

  async exportParticipants(query) {
    const cohortIds =
      Array.isArray(query.cohort_ids) && query.cohort_ids.length
        ? query.cohort_ids
        : undefined;

    const filters = {
      search: query.search,
      cohortId: cohortIds ? undefined : query.cohort,
      cohortIds,
      paymentStatus: normalizeParticipantPaymentStatusInput(query.payment_status),
      registrationStatus: query.registration_status,
      isActive: query.is_active
    };

    const participants = await participantRepository.findAllForExport(filters);
    const headers = [
      { key: 'name', label: 'Name' },
      { key: 'email', label: 'Email' },
      { key: 'phone', label: 'Phone' },
      { key: 'cohort', label: 'Cohort' },
      { key: 'payment', label: 'Payment' },
      { key: 'registration', label: 'Registration' }
    ];

    const rows = participants.map((participant) => ({
      name: participant.name,
      email: participant.email,
      phone: participant.phone || '',
      company: participant.company || '',
      cohort: participant.cohort ? participant.cohort.name : '',
      payment: getParticipantPaymentStatus(participant.paymentStatus),
      registration: getRegistrationStatusFromPaymentStatus(participant.paymentStatus)
    }));

    return {
      filename: `participants-${Date.now()}.csv`,
      csv: convertToCsv(rows, headers)
    };
  }
}

module.exports = new ParticipantService();
