const { fn, col, Op, where } = require('sequelize');
const { Cohort, Participant, Payment, Program, CohortProgram } = require('../models');

class CohortRepository {
  buildFilters({ isActive, isDraft } = {}) {
    const where = {};

    if (typeof isActive === 'boolean') {
      where.isActive = isActive;
    }

    if (typeof isDraft === 'boolean') {
      where.isDraft = isDraft;
    }

    return where;
  }

  async findAll({ filters, limit, offset } = {}) {
    return Cohort.findAndCountAll({
      where: this.buildFilters(filters),
      order: [['id', 'ASC']],
      include: [{
        model: Program,
        as: 'programs',
        through: { attributes: ['allocatedSeats', 'seatsFilled', 'isFull'] }
      }],
      limit,
      offset,
      distinct: true
    });
  }

  async findPublicList() {
    return Cohort.findAll({
      where :{
        isDraft: false,
        isActive: true
      },
      include: [{
        model: Program,
        as: 'programs',
        through: { attributes: ['allocatedSeats', 'seatsFilled', 'isFull'] }
      }],
      order: [['id', 'ASC']]
    });
  }

  async findById(id, options = {}) {
    return Cohort.findByPk(id, {
      ...options,
      include: [
        ...(options.include || []),
        {
          model: Program,
          as: 'programs',
          through: { attributes: ['allocatedSeats', 'seatsFilled', 'isFull'] }
        }
      ]
    });
  }

  async findActiveById(id, options = {}) {
    return Cohort.findOne({
      where: {
        id,
        isActive: true
      },
      ...options,
      include: [
        ...(options.include || []),
        {
          model: Program,
          as: 'programs',
          through: { attributes: ['allocatedSeats', 'seatsFilled', 'isFull'] }
        }
      ]
    });
  }

    async findAllActiveById(id, options = {}) {
    return Cohort.findAll({
      where: {
        id,
        isActive: true
      },
      ...options,
      include: [
        ...(options.include || []),
        {
          model: Program,
          as: 'programs',
          through: { attributes: ['allocatedSeats', 'seatsFilled', 'isFull'] }
        }
      ]
    });
  }

  async create(data, options = {}) {
    return Cohort.create(data, options);
  }

  async update(instance, data, options = {}) {
    return instance.update(data, options);
  }

  async findProgramMapping(cohortId, programId, options = {}) {
    return CohortProgram.findOne({
      where: {
        cohortId,
        programId
      },
      ...options
    });
  }

  async updateProgramMapping(instance, data, options = {}) {
    return instance.update(data, options);
  }

  async softDelete(instance) {
    return instance.destroy();
  }

  async getMostBookedSeats(filters = {}) {
    const seatsFilled = await Cohort.max('seatsFilled', {
      where: this.buildFilters(filters)
    });

    return Number(seatsFilled || 0);
  }

  async getFilledSeatMap(cohortIds) {
    if (!cohortIds.length) {
      return {};
    }

    const rows = await Participant.findAll({
      attributes: ['cohortId', [fn('COUNT', col('id')), 'filled_seats']],
      where: {
        cohortId: {
          [Op.in]: cohortIds
        }
      },
      group: ['cohortId'],
      raw: true
    });

    return rows.reduce((accumulator, row) => {
      accumulator[row.cohortId] = Number(row.filled_seats);
      return accumulator;
    }, {});
  }

  async getRevenueMap(cohortIds) {
    if (!cohortIds.length) {
      return {};
    }

    const rows = await Payment.findAll({
      attributes: ['cohortId', [fn('COALESCE', fn('SUM', col('amount')), 0), 'revenue']],
      where: {
        cohortId: {
          [Op.in]: cohortIds
        },
        status: 'paid'
      },
      group: ['cohortId'],
      raw: true
    });

    return rows.reduce((accumulator, row) => {
      accumulator[row.cohortId] = Number(row.revenue);
      return accumulator;
    }, {});
  }
}

module.exports = new CohortRepository();
