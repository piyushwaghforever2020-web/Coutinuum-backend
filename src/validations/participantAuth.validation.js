const Joi = require('joi');

const login = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().min(8).max(100).required(),
    cohort_id: Joi.number().integer().positive().optional()
  })
};

const changePassword = {
  body: Joi.object({
    current_password: Joi.string().min(8).max(100).required(),
    new_password: Joi.string().min(8).max(100).required()
  })
};

const setPassword = {
  body: Joi.object({
    token: Joi.string().trim().required(),
    new_password: Joi.string().min(8).max(100).required()
  })
};

module.exports = {
  login,
  changePassword,
  setPassword
};
