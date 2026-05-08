const { AdminSession } = require('../models');

class AdminSessionRepository {
  async create(data, options = {}) {
    return AdminSession.create(data, options);
  }

  async findActiveByTokenId(tokenId, options = {}) {
    return AdminSession.findOne({
      where: {
        tokenId,
        revokedAt: null
      },
      ...options
    });
  }

  async findByTokenId(tokenId, options = {}) {
    return AdminSession.findOne({
      where: {
        tokenId
      },
      ...options
    });
  }

  async update(instance, data, options = {}) {
    return instance.update(data, options);
  }
}

module.exports = new AdminSessionRepository();
