const { Op } = require('sequelize');
const { Sponsorship, EmployerUser, Cohort, Program, Seat, Invoice, Participant } = require('../models');

const listIncludes = [
  {
    model: EmployerUser,
    as: 'employer',
    attributes: ['id', 'name', 'email', 'companyName']
  },
  {
    model: Cohort,
    as: 'cohort',
    attributes: ['id', 'name', 'status']
  },
  {
    model: Program,
    as: 'program',
    attributes: ['id', 'name'],
    required: false
  }
];


class SponsorshipRepository {
  async findPlainById(id, options = {}) {
    return Sponsorship.findByPk(id, options);
  }

  async findById(id, options = {}) {
    return Sponsorship.findByPk(id, {
      include: [
        {
          model: EmployerUser,
          as: 'employer'
        },
        {
          model: Cohort,
          as: 'cohort'
        },
        {
          model: Program,
          as: 'program'
        },
        {
          model: Invoice,
          as: 'invoice'
        },
        {
          model: Seat,
          as: 'seats',
          include: [
            {
              model: Participant,
              as: 'participant',
              required: false
            }
          ]
        }
      ],
      ...options
    });
  }

  //find all sponsership for employeer_user_id
  async findAllByEmployerUserId(employerUserId, options = {}) {
    return Sponsorship.findAll({
      where: {
        employerUserId
      },
      ...options
    });
  }

  async findByStripeInvoiceId(stripeInvoiceId, options = {}) {
    return Sponsorship.findOne({
      where: {
        stripeInvoiceId
      },
      include: [
        {
          model: EmployerUser,
          as: 'employer'
        },
        {
          model: Cohort,
          as: 'cohort'
        },
        {
          model: Program,
          as: 'program'
        },
        {
          model: Invoice,
          as: 'invoice'
        },
        {
          model: Seat,
          as: 'seats',
          include: [
            {
              model: Participant,
              as: 'participant',
              required: false
            }
          ]
        }
      ],
      ...options
    });
  }

  async findAllByEmployerAndCohort(employerUserId, cohortId, options = {}) {
    return Sponsorship.findAll({
      where: {
        employerUserId,
        cohortId
      },
      order: [['createdAt', 'ASC']],
      ...options
    });
  }

  async findAllAdmin({ filters = {}, limit, offset }) {
    const where = {};

    if (filters.category) {
      where.sponsershipCategory = filters.category;
    }

    if (filters.status) {
      where.status = filters.status;
    }

    if (filters.cohortId) {
      where.cohortId = filters.cohortId;
    }

    const include = [...listIncludes];

    if (filters.search) {
      include[0] = {
        ...include[0],
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: `%${filters.search}%` } },
            { email: { [Op.iLike]: `%${filters.search}%` } },
            { companyName: { [Op.iLike]: `%${filters.search}%` } }
          ]
        },
        required: true
      };
    }

    return Sponsorship.findAndCountAll({
      where,
      include,
      limit,
      offset,
      order: [['createdAt', 'DESC']],
      distinct: true
    });
  }

  async findPlainByStripeInvoiceId(stripeInvoiceId, options = {}) {
    return Sponsorship.findOne({
      where: {
        stripeInvoiceId
      },
      ...options
    });
  }

  async create(data, options = {}) {
    return Sponsorship.create(data, options);
  }

  async update(instance, data, options = {}) {
    return instance.update(data, options);
  }

  async destroy(instance, options = {}) {
    return instance.destroy(options);
  }
}

module.exports = new SponsorshipRepository();
