const Joi = require('joi');
const {
  SPONSERSHIP_CATEGORY,
  SPONSORSHIP_STATUSES
} = require('../constants/app.constants');

const sponsorshipId = {
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};

const listSponsorships = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    category: Joi.string()
      .valid(...SPONSERSHIP_CATEGORY)
      .empty(''),
    status: Joi.string()
      .valid(...SPONSORSHIP_STATUSES)
      .empty(''),
    search: Joi.string().trim().allow('', null),
    cohort: Joi.number().integer().positive().empty('')
  })
};

const updateSponsorship = {
  params: sponsorshipId.params,
  body: Joi.object({
    total_seats: Joi.number().integer().positive(),
    amount: Joi.number().positive().precision(2),
    currency: Joi.string().trim().max(10),
    invoice_due_at: Joi.date().iso().allow(null),
    sponsership_category: Joi.string().valid(...SPONSERSHIP_CATEGORY)
  }).min(1)
};

const updateActiveStatus = {
  params: sponsorshipId.params,
  body: Joi.object({
    is_active: Joi.boolean().required()
  })
};

module.exports = {
  sponsorshipId,
  listSponsorships,
  updateSponsorship,
  updateActiveStatus
};
