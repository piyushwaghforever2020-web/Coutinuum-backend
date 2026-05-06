const { Op } = require('sequelize');
const { ContactUs } = require('../models');

class ContactUsRepository {
  buildFilters({ search } = {}) {
    if (!search) {
      return {};
    }

    return {
      [Op.or]: [
        {
          fistName: {
            [Op.like]: `%${search}%`
          }
        },
        {
          lastName: {
            [Op.like]: `%${search}%`
          }
        },
        {
          email: {
            [Op.like]: `%${search}%`
          }
        },
        {
          selectedTopic: {
            [Op.like]: `%${search}%`
          }
        },
        {
          message: {
            [Op.like]: `%${search}%`
          }
        }
      ]
    };
  }

  async findAll({ filters, limit, offset } = {}) {
    return ContactUs.findAndCountAll({
      where: this.buildFilters(filters),
      order: [['id', 'DESC']],
      limit,
      offset
    });
  }

  async findById(id, options = {}) {
    return ContactUs.findByPk(id, options);
  }

  async create(data, options = {}) {
    return ContactUs.create(data, options);
  }

  async update(instance, data, options = {}) {
    return instance.update(data, options);
  }

  async delete(instance, options = {}) {
    return instance.destroy(options);
  }
}

module.exports = new ContactUsRepository();
