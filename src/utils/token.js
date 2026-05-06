const crypto = require('crypto');

const generateTokenId = () => crypto.randomUUID();

const hashToken = (token) =>
  crypto.createHash('sha256').update(String(token)).digest('hex');

module.exports = {
  generateTokenId,
  hashToken
};
