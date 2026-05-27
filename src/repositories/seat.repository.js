const { Op } = require('sequelize');
const { Seat } = require('../models');

class SeatRepository {
  async findById(id, options = {}) {
    return Seat.findByPk(id, options);
  }

  async findByParticipantAndCohort(participantId, cohortId, options = {}) {
    return Seat.findOne({
      where: {
        participantId,
        cohortId
      },
      ...options
    });
  }

  async create(data, options = {}) {
    return Seat.create(data, options);
  }

  async update(instance, data, options = {}) {
    return instance.update(data, options);
  }

  async countReservedByCohort(cohortId, options = {}) {
    return Seat.count({
      where: {
        cohortId,
        status: {
          [Op.in]: ['locked', 'assigned', 'active']
        }
      },
      ...options
    });
  }
}

module.exports = new SeatRepository();
