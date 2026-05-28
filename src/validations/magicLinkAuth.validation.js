const Joi = require('joi');

const verifyMagicLink = Joi.object({
  token: Joi.string().trim().min(10).max(256).required().messages({
    'string.empty': 'Token is required.',
    'any.required': 'Token is required.'
  })
});

module.exports = {
  verifyMagicLink
};
