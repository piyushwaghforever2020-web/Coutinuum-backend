const Joi = require('joi');

const login = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
};

module.exports = {
  login
};
