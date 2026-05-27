const Joi = require('joi');

const answersSchema = Joi.alternatives().try(
  Joi.object().unknown(true),
  Joi.array().items(Joi.any()),
  Joi.string().trim().allow(''),
  Joi.number(),
  Joi.boolean(),
  Joi.valid(null)
);

const registerCohort = {
  body: Joi.object({
    name: Joi.string().trim().max(150).required(),
    program_id: Joi.number().integer().positive().optional().allow(null, ''),
    programm_id: Joi.number().integer().positive().optional().allow(null, ''),
    email: Joi.string().email().required(),
    phone: Joi.string().trim().max(50).allow('', null),
    company: Joi.string().trim().max(150).allow('', null),
    role: Joi.string().trim().max(150).allow('', null),
    cohort_id: Joi.number().integer().positive().required(),
    answers: answersSchema.optional(),
    agree_email: Joi.boolean().optional(),
    agree_sms: Joi.boolean().optional(),
    payment_type: Joi.string().valid('self_pay', 'employer_funded').required(),
    manager_name: Joi.string().trim().allow('', null).optional(),
    manager_email: Joi.string().email().allow('', null).optional(),
    billing_phone: Joi.string().trim().allow('', null).optional(),
    billing_address: Joi.string().trim().allow('', null).optional(),
    billing_city: Joi.string().trim().allow('', null).optional(),
    billing_zip_code: Joi.string().trim().allow('', null).optional()
  })
};

module.exports = {
  registerCohort
};
