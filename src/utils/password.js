const crypto = require('crypto');

const PASSWORD_CHARSET =
  'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';

const generateTemporaryPassword = (length = 12) => {
  const bytes = crypto.randomBytes(length);
  let password = '';

  for (let index = 0; index < length; index += 1) {
    password += PASSWORD_CHARSET[bytes[index] % PASSWORD_CHARSET.length];
  }

  return password;
};

module.exports = {
  generateTemporaryPassword
};
