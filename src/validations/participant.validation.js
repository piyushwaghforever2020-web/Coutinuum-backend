const Joi = require('joi');
const {
  PARTICIPANT_PAYMENT_STATUSES,
  REGISTRATION_STATUSES
} = require('../constants/app.constants');

const PARTICIPANT_PAYMENT_STATUS_INPUTS = [...PARTICIPANT_PAYMENT_STATUSES, 'refund'];

const booleanQuery = Joi.boolean()
  .truthy('true')
  .truthy('1')
  .falsy('false')
  .falsy('0')
  .empty('');

const parseCohortIds = (value, helpers) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }

  const rawValues = Array.isArray(value) ? value : [value];
  const ids = rawValues
    .flatMap((item) => String(item).split(','))
    .map((item) => item.trim())
    .filter(Boolean);

  if (!ids.length) {
    return undefined;
  }

  const parsedIds = ids.map((item) => Number(item));

  if (parsedIds.some((item) => !Number.isInteger(item) || item <= 0)) {
    return helpers.error('any.invalid');
  }

  return [...new Set(parsedIds)];
};

const participantId = {
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};

const listParticipants = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('', null),
    cohort: Joi.number().integer().positive().empty(''),
    cohort_ids: Joi.alternatives()
      .try(
        Joi.string().allow('', null),
        Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number()))
      )
      .custom(parseCohortIds)
      .optional(),
    payment_status: Joi.string().valid(...PARTICIPANT_PAYMENT_STATUS_INPUTS).empty(''),
    registration_status: Joi.string().valid(...REGISTRATION_STATUSES).empty(''),
    is_active: booleanQuery.optional()
  })
};

const exportParticipants = {
  query: Joi.object({
    search: Joi.string().trim().allow('', null),
    cohort: Joi.number().integer().positive().empty(''),
    cohort_ids: Joi.alternatives()
      .try(
        Joi.string().allow('', null),
        Joi.array().items(Joi.alternatives().try(Joi.string(), Joi.number()))
      )
      .custom(parseCohortIds)
      .optional(),
    payment_status: Joi.string().valid(...PARTICIPANT_PAYMENT_STATUS_INPUTS).empty(''),
    registration_status: Joi.string().valid(...REGISTRATION_STATUSES).empty(''),
    is_active: booleanQuery.optional()
  })
};

const updateParticipantStatus = {
  params: participantId.params,
  body: Joi.object({
    payment_status: Joi.string().valid(...PARTICIPANT_PAYMENT_STATUS_INPUTS),
    registration_status: Joi.string().valid(...REGISTRATION_STATUSES)
  })
    .min(1)
    .required()
};

const updateParticipantActiveStatus = {
  params: participantId.params,
  body: Joi.object({
    is_active: Joi.boolean().required()
  })
};

module.exports = {
  participantId,
  listParticipants,
  exportParticipants,
  updateParticipantStatus,
  updateParticipantActiveStatus
};
