const { Op } = require('sequelize');
const { Cohort, Participant } = require('../models');

class DashboardRepository {
  buildDateRangeClause(dateRange) {
    if (!dateRange?.startDate || !dateRange?.endDate) {
      return undefined;
    }

    return {
      [Op.between]: [dateRange.startDate, dateRange.endDate]
    };
  }

  buildParticipantWhere({ paymentStatus, paymentStatusNot, dateRange } = {}) {
    const where = {};

    if (paymentStatus) {
      where.paymentStatus = paymentStatus;
    }

    if (paymentStatusNot) {
      where.paymentStatus = {
        [Op.ne]: paymentStatusNot
      };
    }

    const createdAt = this.buildDateRangeClause(dateRange);

    if (createdAt) {
      where.createdAt = createdAt;
    }

    return where;
  }

  async getParticipantCountByPaymentStatus(paymentStatus, dateRange) {
    return Participant.count({
      where: this.buildParticipantWhere({
        paymentStatus,
        dateRange
      })
    });
  }

  async getTotalPaidUsers() {
    return this.getParticipantCountByPaymentStatus('paid');
  }

  async getRegistrationCompletedCount(dateRange) {
    return this.getParticipantCountByPaymentStatus('paid', dateRange);
  }

  async getRegistrationIncompleteCount(dateRange) {
    return Participant.count({
      where: this.buildParticipantWhere({
        paymentStatusNot: 'paid',
        dateRange
      })
    });
  }

  async getTotalSeatLimit() {
    return Cohort.sum('seatLimit');
  }

  async getFilledSeatCount() {
    return Cohort.sum('seatsFilled');
  }

  async getCohorts() {
    return Cohort.findAll({
      order: [['startDate', 'ASC'], ['id', 'ASC']]
    });
  }

  async getPaidParticipantsByCohort(cohortId) {
    return Participant.findAll({
      where: {
        cohortId,
        paymentStatus: 'paid'
      },
      attributes: ['id', 'createdAt'],
      order: [['createdAt', 'ASC']]
    });
  }
}

module.exports = new DashboardRepository();
