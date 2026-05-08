const { Admin } = require('../models');

class AdminRepository {
  async findByEmail(email) {
    return Admin.findOne({ where: { email } });
  }

  async findById(id) {
    return Admin.findByPk(id);
  }

  async upsert(data, options = {}) {
    return Admin.upsert(data, options);
  }
}

module.exports = new AdminRepository();
