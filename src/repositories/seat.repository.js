const { Op } = require('sequelize');
const { Seat, Sponsorship, Participant } = require('../models');

const RESERVED_SEAT_STATUSES = ['locked', 'assigned', 'active'];
const USED_SEAT_STATUSES = ['assigned', 'active'];

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

  async findSelfPayByParticipantAndCohort(participantId, cohortId, options = {}) {
    return Seat.findOne({
      where: {
        participantId,
        cohortId,
        sponsorshipId: null
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

  async bulkCreate(rows, options = {}) {
    return Seat.bulkCreate(rows, options);
  }

  async findBySponsorshipAndId(sponsorshipId, id, options = {}) {
    return Seat.findOne({
      where: {
        sponsorshipId,
        id
      },
      ...options
    });
  }

  async findAllBySponsorship(sponsorshipId, options = {}) {
    return Seat.findAll({
      where: {
        sponsorshipId
      },
      include: [
        {
          model: Participant,
          as: 'participant',
          required: false
        }
      ],
      order: [['id', 'ASC']],
      ...options
    });
  }

  async findAllByEmployerAndCohort(employerUserId, cohortId, options = {}) {
    return Seat.findAll({
      where: {
        cohortId
      },
      include: [
        {
          model: Sponsorship,
          as: 'sponsorship',
          attributes: ['id', 'status', 'employerUserId', 'cohortId'],
          where: {
            employerUserId,
            cohortId
          },
          required: true
        },
        {
          model: Participant,
          as: 'participant',
          required: false
        }
      ],
      order: [['id', 'ASC']],
      ...options
    });
  }

  async findByEmployerCohortAndId(employerUserId, cohortId, id, options = {}) {
    return Seat.findOne({
      where: {
        id,
        cohortId
      },
      include: [
        {
          model: Sponsorship,
          as: 'sponsorship',
          where: {
            employerUserId,
            cohortId
          },
          required: true
        }
      ],
      ...options
    });
  }

  async countReservedByCohort(cohortId, options = {}) {
    return Seat.count({
      where: {
        cohortId,
        status: {
          [Op.in]: RESERVED_SEAT_STATUSES
        }
      },
      ...options
    });
  }

  async countReservedByCohortAndProgram(cohortId, programId, options = {}) {
    return Seat.count({
      where: {
        cohortId,
        programId,
        status: {
          [Op.in]: RESERVED_SEAT_STATUSES
        }
      },
      ...options
    });
  }

  async countEffectiveReservedByCohort(cohortId, { now = new Date() } = {}, options = {}) {
    return Seat.count({
      where: {
        cohortId,
        [Op.or]: [
          {
            status: {
              [Op.in]: ['assigned', 'active']
            }
          },
          {
            status: 'locked',
            [Op.or]: [
              {
                holdExpiresAt: null
              },
              {
                holdExpiresAt: {
                  [Op.gt]: now
                }
              }
            ]
          }
        ]
      },
      ...options
    });
  }

  async countEffectiveReservedCapacityByCohort(
    cohortId,
    { now = new Date() } = {},
    options = {}
  ) {
    const reservedSeats = await this.countEffectiveReservedByCohort(
      cohortId,
      { now },
      options
    );

    const paidParticipants = await Participant.count({
      where: {
        cohortId,
        paymentStatus: 'paid'
      },
      ...options
    });

    const participantSeatRows = await Seat.count({
      where: {
        cohortId,
        participantId: {
          [Op.ne]: null
        },
        status: {
          [Op.in]: ['assigned', 'active']
        }
      },
      ...options
    });

    // Legacy paid participants may not have seat rows yet; locked self-pay holds
    // must stay unpaid until activation so this adjustment does not double-count.
    return reservedSeats + Math.max(0, paidParticipants - participantSeatRows);
  }

  async countEffectiveReservedByCohortAndProgram(
    cohortId,
    programId,
    { now = new Date() } = {},
    options = {}
  ) {
    return Seat.count({
      where: {
        cohortId,
        programId,
        [Op.or]: [
          {
            status: {
              [Op.in]: ['assigned', 'active']
            }
          },
          {
            status: 'locked',
            [Op.or]: [
              {
                holdExpiresAt: null
              },
              {
                holdExpiresAt: {
                  [Op.gt]: now
                }
              }
            ]
          }
        ]
      },
      ...options
    });
  }

  async countEffectiveReservedCapacityByCohortAndProgram(
    cohortId,
    programId,
    { now = new Date() } = {},
    options = {}
  ) {
    const reservedSeats = await this.countEffectiveReservedByCohortAndProgram(
      cohortId,
      programId,
      { now },
      options
    );

    const paidParticipants = await Participant.count({
      where: {
        cohortId,
        programId,
        paymentStatus: 'paid'
      },
      ...options
    });

    const participantSeatRows = await Seat.count({
      where: {
        cohortId,
        programId,
        participantId: {
          [Op.ne]: null
        },
        status: {
          [Op.in]: ['assigned', 'active']
        }
      },
      ...options
    });

    // Legacy paid participants may not have seat rows yet; locked self-pay holds
    // must stay unpaid until activation so this adjustment does not double-count.
    return reservedSeats + Math.max(0, paidParticipants - participantSeatRows);
  }

  async findExpiredSelfPayHolds({ now = new Date(), limit = 100 } = {}, options = {}) {
    return Seat.findAll({
      where: {
        sponsorshipId: null,
        participantId: {
          [Op.ne]: null
        },
        status: 'locked',
        holdExpiresAt: {
          [Op.lte]: now
        }
      },
      order: [['holdExpiresAt', 'ASC']],
      limit,
      ...options
    });
  }

  async releaseExpiredHold(seat, options = {}) {
    return seat.update(
      {
        status: 'released',
        holdExpiresAt: null
      },
      options
    );
  }

  async countReservedByCohortExcludingUnpaidSponsorship(cohortId, options = {}) {
    return Seat.count({
      where: {
        cohortId,
        status: {
          [Op.in]: RESERVED_SEAT_STATUSES
        },
        [Op.or]: [
          {
            sponsorshipId: null
          },
          {
            '$sponsorship.status$': 'paid'
          }
        ]
      },
      include: [
        {
          model: Sponsorship,
          as: 'sponsorship',
          attributes: [],
          required: false
        }
      ],
      ...options
    });
  }

  async countReservedByCohortAndProgramExcludingUnpaidSponsorship(cohortId, programId, options = {}) {
    return Seat.count({
      where: {
        cohortId,
        programId,
        status: {
          [Op.in]: RESERVED_SEAT_STATUSES
        },
        [Op.or]: [
          {
            sponsorshipId: null
          },
          {
            '$sponsorship.status$': 'paid'
          }
        ]
      },
      include: [
        {
          model: Sponsorship,
          as: 'sponsorship',
          attributes: [],
          required: false
        }
      ],
      ...options
    });
  }

  async countUsedBySponsorship(sponsorshipId, options = {}) {
    return Seat.count({
      where: {
        sponsorshipId,
        status: {
          [Op.in]: USED_SEAT_STATUSES
        }
      },
      ...options
    });
  }
}

module.exports = new SeatRepository();
