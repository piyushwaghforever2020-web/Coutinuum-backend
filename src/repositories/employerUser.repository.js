const { EmployerUser, Sponsorship, Cohort } = require('../models');

class EmployerUserRepository {
  async findById(id, options = {}) {
    return EmployerUser.findByPk(id, options);
  }

  async findByEmail(email, options = {}) {
    return EmployerUser.findOne({
      where: {
        email: String(email).trim().toLowerCase()
      },
      ...options
    });
  }

  async create(data, options = {}) {
    return EmployerUser.create(data, options);
  }

  async findAllCohortsByEmployerUserId(employerUserId, options = {}) {
    return EmployerUser.findByPk(employerUserId, {
      include: [
        {
          model: Sponsorship,
          as: 'sponsorships',
        }
      ],
      ...options
    });
  }

  async update(instance, data, options = {}) {
    return instance.update(data, options);
  }

  async findOrCreateByEmail({ email, name, companyName, stripeCustomerId }, options = {}) {
    const normalizedEmail = String(email).trim().toLowerCase();
    const existing = await this.findByEmail(normalizedEmail, options);

    if (existing) {
      const updates = {};
      if (name && existing.name !== name) {
        updates.name = name;
      }
      if (companyName && existing.companyName !== companyName) {
        updates.companyName = companyName;
      }
      if (stripeCustomerId && existing.stripeCustomerId !== stripeCustomerId) {
        updates.stripeCustomerId = stripeCustomerId;
      }

      if (Object.keys(updates).length) {
        return this.update(existing, updates, options);
      }

      return existing;
    }

    return this.create(
      {
        email: normalizedEmail,
        name: name || normalizedEmail,
        companyName: companyName || null,
        stripeCustomerId: stripeCustomerId || null
      },
      options
    );
  }
}

module.exports = new EmployerUserRepository();
