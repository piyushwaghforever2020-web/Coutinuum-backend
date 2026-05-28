const { MagicLinkToken } = require('../models');

const create = async (data, options = {}) =>
  MagicLinkToken.create(data, options);

const findByToken = async (hashedToken, options = {}) =>
  MagicLinkToken.findOne({
    where: { token: hashedToken },
    ...options
  });

const markUsed = async (tokenRecord, options = {}) =>
  tokenRecord.update({ usedAt: new Date() }, options);

const deleteExpiredTokens = async () => {
  const { Op } = require('sequelize');

  return MagicLinkToken.destroy({
    where: {
      expiresAt: { [Op.lt]: new Date() }
    }
  });
};

module.exports = {
  create,
  findByToken,
  markUsed,
  deleteExpiredTokens
};
