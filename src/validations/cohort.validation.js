// const Joi = require('joi');
// const { COHORT_STATUSES } = require('../constants/app.constants');

// const booleanQuery = Joi.boolean()
//   .truthy('true')
//   .truthy('1')
//   .falsy('false')
//   .falsy('0')
//   .empty('');

// const priceStringToNumber = (value, helpers) => {
//   const normalized = String(value).trim().replace(/,/g, '');

//   if (!/^\d+(\.\d{1,2})?$/.test(normalized)) {
//     return helpers.error('any.invalid');
//   }

//   const parsed = Number(normalized);

//   if (!Number.isFinite(parsed) || parsed <= 0) {
//     return helpers.error('any.invalid');
//   }

//   return parsed;
// };

// const priceField = Joi.custom((value, helpers) => {
//   if (value === null || value === undefined || String(value).trim() === '') {
//     return helpers.error('any.invalid');
//   }

//   return String(value).trim(); // just return as-is, preserve $ and formatting
// });

// const refundDeferralPolicyItem = Joi.object({
//   program: Joi.string().trim().max(255).allow('', null).optional(),
//   price_per_seat: Joi.string().trim().max(255).allow('', null).optional()
// });

// // const programOverviewItem = Joi.object({
// //   heading: Joi.string().trim().max(255).required(),
// //   details: Joi.string().trim().required()
// // });


// const cohortId = {
//   params: Joi.object({
//     id: Joi.number().integer().positive().optional()
//   })
// };

// const listCohorts = {
//   query: Joi.object({
//     page: Joi.number().integer().min(1).default(1),
//     limit: Joi.number().integer().min(1).max(100).default(10),
//     is_active: booleanQuery.optional(),
//     is_draft: booleanQuery.optional(),
//   })
// };

// const createCohort = {
//   body: Joi.object({
//     name: Joi.string().trim().max(150).required(),
//     description: Joi.string().trim().allow('', null),
//     start_date: Joi.date().iso().optional(),
//     end_date: Joi.date().iso().min(Joi.ref('start_date')).allow(null),
//     price: priceField.optional(),
//     is_draft: Joi.boolean().optional(),
//     seat_limit: Joi.number().integer().optional().allow('', null),
//     refund_policy: Joi.string().trim().allow('', null),
//     refund_deferral_policy: Joi.array().items(refundDeferralPolicyItem).allow(null),
//     time_commitment: Joi.string().trim().max(500).allow('', null),
//     program_overview: Joi.string().trim().allow('', null),
//     is_active: Joi.boolean().optional(),
//     is_draft: Joi.boolean().optional(),
//     leave_with: Joi.array().items(Joi.string()).optional(),
//     format: Joi.string().trim().max(1000).allow('', null),
//     live_sessions_text: Joi.string().trim().max(500).allow('', null),
//     workshops_text: Joi.string().trim().max(500).allow('', null),
//     cohort_size_text: Joi.string().trim().max(500).allow('', null),
//     investment_tiers: Joi.array().items(Joi.object({
//       tier: Joi.string().optional().allow(null,''),
//       price:priceField.optional().allow(null,''),
//       best_for: Joi.string().allow(null,'').optional()
//     })).optional().allow(null,''),
//     scarcity_text: Joi.string().trim().allow('', null),
//     display_price: Joi.string().trim().max(255).allow('', null),
//     programs: Joi.array().items(Joi.object({
//       program_id: Joi.number().integer().positive().empty('').allow(null).optional(),
//       program_name: Joi.string().optional(),
//       program_description : Joi.string().optional()
//     })).optional()
//   })
// };

// const updateCohort = {
//   params: cohortId.params,
//   body: Joi.object({
//     name: Joi.string().trim().max(150),
//     description: Joi.string().trim().allow('', null),
//     start_date: Joi.date().iso(),
//     end_date: Joi.date().iso().allow(null),
//     price: priceField,
//        seat_limit: Joi.number().integer().optional().allow('', null),
//     refund_policy: Joi.string().trim().allow('', null),
//     refund_deferral_policy: Joi.array().items(refundDeferralPolicyItem).allow(null),
//     time_commitment: Joi.string().trim().max(500).allow('', null),
//     program_overview: Joi.string().trim().allow('', null),
//     format: Joi.string().trim().max(1000).allow('', null),
//     status: Joi.string().valid(...COHORT_STATUSES),
//     is_active: Joi.boolean(),
//     is_draft: Joi.boolean().optional(),
//     leave_with: Joi.array().items(Joi.string()).optional(),
//     live_sessions_text: Joi.string().trim().max(500).allow('', null),
//     workshops_text: Joi.string().trim().max(500).allow('', null),
//     cohort_size_text: Joi.string().trim().max(500).allow('', null),
//     investment_tiers: Joi.array().items(Joi.object({
//       tier: Joi.string().optional(),
//       price: priceField.optional(),
//       best_for: Joi.string().allow('').optional()
//     })).optional().allow('', null),
//     scarcity_text: Joi.string().trim().allow('', null),
//     display_price: Joi.string().trim().max(255).allow('', null),
//     programs: Joi.array().items(Joi.object({
//       program_id: Joi.number().integer().positive().empty('').allow(null).optional(),
//       program_name: Joi.string().optional(),
//       program_description : Joi.string().optional()
//     })).optional()
//   })
//     .min(1)
//     .required()
// };

// const updateCohortActiveStatus = {
//   params: cohortId.params,
//   body: Joi.object({
//     is_active: Joi.boolean().required()
//   })
// };

// module.exports = {
//   listCohorts,
//   cohortId,
//   createCohort,
//   updateCohort,
//   updateCohortActiveStatus
// };

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

const refundDeferralPolicyItem = Joi.object({
  program: Joi.string().trim().max(255).allow('', null).optional(),
  price_per_seat: Joi.string().trim().max(255).allow('', null).optional()
});

// const programOverviewItem = Joi.object({
//   heading: Joi.string().trim().max(255).required(),
//   details: Joi.string().trim().required()
// });


const cohortId = {
  params: Joi.object({
    id: Joi.number().integer().positive().optional()
  })
};

const listCohorts = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    is_active: booleanQuery.optional(),
    is_draft: booleanQuery.optional(),
  })
};

const createCohort = {
  body: Joi.object({
    name: Joi.string().trim().max(150).required(),
    description: Joi.string().trim().allow('', null),
    start_date: Joi.date().iso().optional(),
    end_date: Joi.date().iso().min(Joi.ref('start_date')).allow(null),
    price: priceField.optional(),
    is_draft: Joi.boolean().optional(),
    seat_limit: Joi.number().integer().optional().allow('', null),
    refund_policy: Joi.string().trim().allow('', null),
    refund_deferral_policy: Joi.array().items(refundDeferralPolicyItem).allow(null),
    time_commitment: Joi.string().trim().max(500).allow('', null),
    program_overview: Joi.string().trim().allow('', null),
    is_active: Joi.boolean().optional(),
    is_draft: Joi.boolean().optional(),
    leave_with: Joi.array().items(Joi.string()).optional(),
    format: Joi.string().trim().max(1000).allow('', null),
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
    image: Joi.string().trim().allow('', null),
    what_leaders_build: Joi.array().items(Joi.string().trim()).allow(null),
    who_its_for: Joi.array().items(Joi.string().trim()).allow(null),
    case_study: Joi.object().allow(null),
    overview_pdf: Joi.string().trim().allow('', null),
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
       seat_limit: Joi.number().integer().optional().allow('', null),
    refund_policy: Joi.string().trim().allow('', null),
    refund_deferral_policy: Joi.array().items(refundDeferralPolicyItem).allow(null),
    time_commitment: Joi.string().trim().max(500).allow('', null),
    program_overview: Joi.string().trim().allow('', null),
    format: Joi.string().trim().max(1000).allow('', null),
    status: Joi.string().valid(...COHORT_STATUSES),
    is_active: Joi.boolean(),
    is_draft: Joi.boolean().optional(),
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
    image: Joi.string().trim().allow('', null),
    what_leaders_build: Joi.array().items(Joi.string().trim()).allow(null),
    who_its_for: Joi.array().items(Joi.string().trim()).allow(null),
    case_study: Joi.object().allow(null),
    overview_pdf: Joi.string().trim().allow('', null),
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

