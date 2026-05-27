const { StripeCustomer } = require('../models');

class StripeCustomerRepository {
  async findByEmail(email, options = {}) {
    return StripeCustomer.findOne({
      where: {
        email
      },
      ...options
    });
  }

  async create(data, options = {}) {
    return StripeCustomer.create(data, options);
  }
}

module.exports = new StripeCustomerRepository();
