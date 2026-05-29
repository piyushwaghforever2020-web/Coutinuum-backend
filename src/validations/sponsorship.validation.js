const Joi = require('joi');

const answersSchema = Joi.alternatives().try(
  Joi.object().unknown(true),
  Joi.array().items(Joi.any()),
  Joi.string().trim().allow(''),
  Joi.number(),
  Joi.boolean(),
  Joi.valid(null)
);

const sponsorshipIdParam = Joi.object({
  id: Joi.number().integer().positive().required()
});

const seatParam = Joi.object({
  id: Joi.number().integer().positive().required(),
  seat_id: Joi.number().integer().positive().required()
});

const createBlockSponsorship = {
  body: Joi.object({
    employer_name: Joi.string().trim().max(150).required(),
    employer_email: Joi.string().email().required(),
    company_name: Joi.string().trim().max(150).allow('', null),
    cohort_id: Joi.number().integer().positive().required(),
    program_id: Joi.number().integer().positive().optional().allow(null, ''),
    programm_id: Joi.number().integer().positive().optional().allow(null, ''),
    total_seats: Joi.number().integer().min(1).max(500).required()
  })
};

const getEmployerDashboard = {
  params: sponsorshipIdParam
};

const assignSeat = {
  params: seatParam,
  body: Joi.object({
    participant_name: Joi.string().trim().max(150).required(),
    participant_email: Joi.string().email().required(),
    phone: Joi.string().trim().max(50).allow('', null),
    company: Joi.string().trim().max(150).allow('', null),
    role: Joi.string().trim().max(150).allow('', null),
    answers: answersSchema.optional()
  })
};

const resendParticipantLogin = {
  params: seatParam
};

module.exports = {
  createBlockSponsorship,
  getEmployerDashboard,
  assignSeat,
  resendParticipantLogin
};
