const { Sponsorship, EmployerUser, Cohort, Program, Seat, Invoice, Participant } = require('../models');

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
}

module.exports = new SponsorshipRepository();
