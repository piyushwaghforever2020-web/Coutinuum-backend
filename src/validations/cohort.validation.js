const Joi = require('joi');
const { COHORT_STATUSES } = require('../constants/app.constants');

const booleanQuery = Joi.boolean()
  .truthy('true')
  .truthy('1')
  .falsy('false')
  .falsy('0')
  .empty('');

const priceStringToNumber = (value, helpers) => {
  const normalized = String(value).trim().replace(/,/g, '');

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
    return helpers.error('any.invalid');
  }

  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return helpers.error('any.invalid');
  }

  return parsed;
};

const priceField = Joi.custom((value, helpers) => {
  if (value === null || value === undefined || String(value).trim() === '') {
    return helpers.error('any.invalid');
  }

  return String(value).trim(); // just return as-is, preserve $ and formatting
});


const cohortId = {
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};

const listCohorts = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    is_active: booleanQuery.optional()
  })
};

const createCohort = {
  body: Joi.object({
    name: Joi.string().trim().max(150).required(),
    description: Joi.string().trim().allow('', null),
    start_date: Joi.date().iso().required(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).allow(null),
    price: priceField.optional(),
    seat_limit: Joi.number().integer().min(1).allow('', null),
    refund_policy: Joi.string().trim().allow('', null),
    is_active: Joi.boolean().optional(),
    leave_with: Joi.array().items(Joi.string()).optional(),
    live_sessions_text: Joi.string().trim().max(500).allow('', null),
    workshops_text: Joi.string().trim().max(500).allow('', null),
    cohort_size_text: Joi.string().trim().max(500).allow('', null),
    investment_tiers: Joi.array().items(Joi.object({
      tier: Joi.string().optional().allow(null,''),
      price:priceField.optional().allow(null,''),
      best_for: Joi.string().allow(null,'').optional()
    })).optional().allow(null,''),
    scarcity_text: Joi.string().trim().allow('', null),
    display_price: Joi.string().trim().max(255).allow('', null),
    programs: Joi.array().items(Joi.object({
      program_id: Joi.number().integer().positive().empty('').allow(null).optional(),
      program_name: Joi.string().optional(),
      program_description : Joi.string().optional()
    })).optional()
  })
};

const updateCohort = {
  params: cohortId.params,
  body: Joi.object({
    name: Joi.string().trim().max(150),
    description: Joi.string().trim().allow('', null),
    start_date: Joi.date().iso(),
    end_date: Joi.date().iso().allow(null),
    price: priceField,
    seat_limit: Joi.number().integer().min(1).allow('', null),
    refund_policy: Joi.string().trim().allow('', null),
    status: Joi.string().valid(...COHORT_STATUSES),
    is_active: Joi.boolean(),
    leave_with: Joi.array().items(Joi.string()).optional(),
    live_sessions_text: Joi.string().trim().max(500).allow('', null),
    workshops_text: Joi.string().trim().max(500).allow('', null),
    cohort_size_text: Joi.string().trim().max(500).allow('', null),
    investment_tiers: Joi.array().items(Joi.object({
      tier: Joi.string().optional(),
      price: priceField.optional(),
      best_for: Joi.string().allow('').optional()
    })).optional().allow('', null),
    scarcity_text: Joi.string().trim().allow('', null),
    display_price: Joi.string().trim().max(255).allow('', null),
    programs: Joi.array().items(Joi.object({
      program_id: Joi.number().integer().positive().empty('').allow(null).optional(),
      program_name: Joi.string().optional(),
      program_description : Joi.string().optional()
    })).optional()
  })
    .min(1)
    .required()
};

const updateCohortActiveStatus = {
  params: cohortId.params,
  body: Joi.object({
    is_active: Joi.boolean().required()
  })
};

module.exports = {
  listCohorts,
  cohortId,
  createCohort,
  updateCohort,
  updateCohortActiveStatus
};
