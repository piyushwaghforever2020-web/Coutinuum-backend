const { Op } = require('sequelize');
const { Payment, Participant, Cohort } = require('../models');

class PaymentRepository {
  buildFilters({ status, cohortId }) {
    const where = {};

    if (status) {
      where.status = status;
    }

    if (cohortId) {
      where.cohortId = cohortId;
    }

    return where;
  }

  buildParticipantFilters({ search }) {
    if (!search) {
      return undefined;
    }

    return {
      [Op.or]: [
        {
          name: {
            [Op.like]: `%${search}%`
          }
        },
        {
          email: {
            [Op.like]: `%${search}%`
          }
        }
      ]
    };
  }

  async findAll({ filters, limit, offset }) {
    const participantWhere = this.buildParticipantFilters(filters);

    return Payment.findAndCountAll({
      where: this.buildFilters(filters),
      include: [
        {
          model: Participant,
          as: 'participant',
          where: participantWhere,
          required: Boolean(participantWhere),
          attributes: [
            'id',
            'cohortId',
            'programId',
            'name',
            'email',
            'phone',
            'company',
            'role',
            'answers',
            'paymentStatus',
            'registrationStatus'
          ]
        },
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name', 'startDate', 'price', 'status', 'refundPolicy']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });
  }

  async findById(id, options = {}) {
    return Payment.findByPk(id, {
      include: [
        {
          model: Participant,
          as: 'participant',
          attributes: [
            'id',
            'cohortId',
            'programId',
            'name',
            'email',
            'phone',
            'company',
            'role',
            'answers',
            'paymentStatus',
            'registrationStatus'
          ]
        },
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name', 'startDate', 'price', 'status', 'refundPolicy']
        }
      ],
      ...options
    });
  }

  async create(data, options = {}) {
    return Payment.create(data, options);
  }

  async findLatestByParticipantAndCohort(participantId, cohortId, options = {}) {
    return Payment.findOne({
      where: {
        participantId,
        cohortId
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Participant,
          as: 'participant',
          attributes: ['id', 'cohortId', 'programId', 'name', 'email', 'paymentStatus', 'registrationStatus']
        },
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name', 'price', 'seatLimit', 'seatsFilled', 'status']
        }
      ],
      ...options
    });
  }

  async findLatestPaidByParticipantAndCohort(participantId, cohortId, options = {}) {
    return Payment.findOne({
      where: {
        participantId,
        cohortId,
        status: 'paid'
      },
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: Participant,
          as: 'participant',
          attributes: ['id', 'cohortId', 'programId', 'name', 'email', 'paymentStatus', 'registrationStatus']
        },
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name', 'price', 'seatLimit', 'seatsFilled', 'status']
        }
      ],
      ...options
    });
  }

  async findByStripeInvoiceId(stripeInvoiceId, options = {}) {
    return Payment.findOne({
      where: {
        stripeInvoiceId
      },
      include: [
        {
          model: Participant,
          as: 'participant',
          attributes: ['id', 'cohortId', 'programId', 'name', 'email', 'paymentStatus', 'registrationStatus']
        },
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name', 'price', 'seatLimit', 'seatsFilled', 'status']
        }
      ],
      ...options
    });
  }

  async findByStripeCheckoutSessionId(stripeCheckoutSessionId, options = {}) {
    return Payment.findOne({
      where: {
        stripeCheckoutSessionId
      },
      include: [
        {
          model: Participant,
          as: 'participant',
          attributes: ['id', 'cohortId', 'programId', 'name', 'email', 'paymentStatus', 'registrationStatus']
        },
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name', 'price', 'seatLimit', 'seatsFilled', 'status']
        }
      ],
      ...options
    });
  }

  async update(instance, data, options = {}) {
    return instance.update(data, options);
  }
}

module.exports = new PaymentRepository();
