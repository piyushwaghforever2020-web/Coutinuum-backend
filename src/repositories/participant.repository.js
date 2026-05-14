const { Op } = require('sequelize');
const { Participant, Cohort, Payment, Program } = require('../models');

class ParticipantRepository {
  buildFilters({ search, cohortId, cohortIds, paymentStatus, registrationStatus, isActive }) {
    const where = {};
    const andConditions = [];

    if (search) {
      where[Op.or] = [
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
      ];
    }

    if (Array.isArray(cohortIds) && cohortIds.length) {
      where.cohortId = {
        [Op.in]: cohortIds
      };
    } else if (cohortId) {
      where.cohortId = cohortId;
    }

    if (paymentStatus) {
      andConditions.push({
        paymentStatus
      });
    }

    if (typeof isActive === 'boolean') {
      andConditions.push({
        isActive
      });
    }

    if (registrationStatus) {
      andConditions.push(
        registrationStatus === 'complete'
          ? {
              paymentStatus: 'paid'
            }
          : {
              paymentStatus: {
                [Op.ne]: 'paid'
              }
            }
      );
    }

    if (andConditions.length) {
      where[Op.and] = andConditions;
    }

    return where;
  }

  async findAll({ filters, limit, offset }) {
    return Participant.findAndCountAll({
      where: this.buildFilters(filters),
      include: [
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name', 'startDate', 'price', 'status', 'isActive']
        },
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });
  }

  async findAllForExport(filters) {
    return Participant.findAll({
      where: this.buildFilters(filters),
      include: [
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name']
        },
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findById(id, options = {}) {
    const { lock, ...otherOptions } = options;
    
    // When using FOR UPDATE lock, we need to separate it because
    // PostgreSQL doesn't allow FOR UPDATE on the nullable side of outer joins
    const subQuery = lock
      ? await Participant.findByPk(id, {
          attributes: ['id'],
          transaction: otherOptions.transaction,
          lock
        })
      : null;

    // If we have a lock, verify the participant exists
    if (lock && !subQuery) {
      return null;
    }

    return Participant.findByPk(id, {
      include: [
        {
          model: Cohort,
          as: 'cohort',
          attributes: [
            'id',
            'name',
            'description',
            'startDate',
            'price',
            'seatLimit',
            'seatsFilled',
            'status',
            'refundPolicy',
            'isActive'
          ]
        },
        {
          model: Payment,
          as: 'payments',
          attributes: [
            'id',
            'amount',
            'status',
            'transactionId',
            'stripeCheckoutSessionId',
            'stripePaymentIntentId',
            'checkoutUrl',
            'completedAt',
            'createdAt'
          ]
        },
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'name']
        }
      ],
      ...otherOptions
    });
  }

  async findByEmailAndCohort(email, cohortId, options = {}) {
    const { lock, ...otherOptions } = options;
    
    // When using FOR UPDATE lock, we need to separate it because
    // PostgreSQL doesn't allow FOR UPDATE on the nullable side of outer joins
    const subQuery = lock
      ? await Participant.findOne({
          where: {
            email,
            cohortId
          },
          attributes: ['id'],
          transaction: otherOptions.transaction,
          lock
        })
      : null;

    // If we have a lock, verify the participant exists
    if (lock && !subQuery) {
      return null;
    }

    return Participant.findOne({
      where: {
        email,
        cohortId
      },
      include: [
        {
          model: Cohort,
          as: 'cohort',
          attributes: [
            'id',
            'name',
            'description',
            'startDate',
            'price',
            'seatLimit',
            'seatsFilled',
            'status',
            'refundPolicy',
            'isActive'
          ]
        },
        {
          model: Payment,
          as: 'payments',
          attributes: [
            'id',
            'amount',
            'status',
            'transactionId',
            'stripeCheckoutSessionId',
            'stripePaymentIntentId',
            'checkoutUrl',
            'completedAt',
            'createdAt'
          ]
        },
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'name']
        }
      ],
      ...otherOptions
    });
  }

  async create(data, options = {}) {
    return Participant.create(data, options);
  }

  async update(instance, data, options = {}) {
    return instance.update(data, options);
  }

  async countByCohort(cohortId) {
    return Participant.count({
      where: {
        cohortId
      }
    });
  }

  async countEnrolledByCohort(cohortId, options = {}) {
    return Participant.count({
      where: {
        cohortId,
        paymentStatus: 'paid'
      },
      ...options
    });
  }

  async countEnrolledByCohortAndProgram(cohortId, programId, options = {}) {
    return Participant.count({
      where: {
        cohortId,
        programId,
        paymentStatus: 'paid'
      },
      ...options
    });
  }

  async findByCohort(cohortId) {
    return Participant.findAll({
      where: {
        cohortId
      },
      include: [
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name']
        },
        {
          model: Program,
          as: 'program',
          attributes: ['id', 'name']
        }
      ],
      order: [['createdAt', 'DESC']]
    });
  }

  async findPaidWithPassword(options = {}) {
    return Participant.findAll({
      where: {
        paymentStatus: 'paid',
        passwordHash: {
          [Op.ne]: null
        }
      },
      include: [
        {
          model: Cohort,
          as: 'cohort',
          attributes: ['id', 'name', 'startDate']
        }
      ],
      order: [
        ['passwordGeneratedAt', 'DESC'],
        ['updatedAt', 'DESC']
      ],
      ...options
    });
  }
}

module.exports = new ParticipantRepository();
