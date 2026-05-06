const Joi = require('joi');
const { PAYMENT_STATUSES } = require('../constants/app.constants');

const paymentId = {
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};

const listPayments = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('', null),
    status: Joi.string().valid(...PAYMENT_STATUSES).empty(''),
    cohort: Joi.number().integer().positive().empty('')
  })
};

module.exports = {
  paymentId,
  listPayments
};
