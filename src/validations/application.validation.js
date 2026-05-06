const Joi = require('joi');

const answersSchema = Joi.alternatives().try(
  Joi.object().unknown(true),
  Joi.array().items(Joi.any()),
  Joi.string().trim().allow(''),
  Joi.number(),
  Joi.boolean(),
  Joi.valid(null)
);

const submitApplication = {
  body: Joi.object({
    name: Joi.string().trim().max(150).required(),
    program_id: Joi.number().integer().positive().optional(),
    programm_id: Joi.number().integer().positive().optional(),
    email: Joi.string().email().required(),
    phone: Joi.string().trim().max(50).allow('', null),
    company: Joi.string().trim().max(150).allow('', null),
    role: Joi.string().trim().max(150).allow('', null),
    cohort_id: Joi.number().integer().positive().required(),
    answers: answersSchema.optional(),
    agree_email: Joi.boolean().optional(),
    agree_sms: Joi.boolean().optional(),
    employer_funded: Joi.boolean().optional()
  })
};

const createCheckoutSession = {
  body: Joi.object({
    email: Joi.string().email().required(),
    cohort_id: Joi.number().integer().positive().required(),
    success_url: Joi.string().uri().optional(),
    cancel_url: Joi.string().uri().optional()
  })
};

const downloadUpcomingCohortFile = {
  body: Joi.object({
    password: Joi.string().min(8).max(100).required()
  })
};

module.exports = {
  submitApplication,
  createCheckoutSession,
  downloadUpcomingCohortFile
};
