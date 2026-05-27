const { Invoice, Seat } = require('../models');

class InvoiceRepository {
  async findById(id, options = {}) {
    return Invoice.findByPk(id, options);
  }

  async findByStripeInvoiceId(stripeInvoiceId, options = {}) {
    return Invoice.findOne({
      where: {
        stripeInvoiceId
      },
      include: [
        {
          model: Seat,
          as: 'seat'
        }
      ],
      ...options
    });
  }

  async findBySeatId(seatId, options = {}) {
    return Invoice.findOne({
      where: {
        seatId
      },
      order: [['createdAt', 'DESC']],
      ...options
    });
  }

  async create(data, options = {}) {
    return Invoice.create(data, options);
  }

  async update(instance, data, options = {}) {
    return instance.update(data, options);
  }
}

module.exports = new InvoiceRepository();
