const Joi = require('joi');

const graphFilterQuery = Joi.object({
  filter: Joi.string().valid('weekly', 'monthly', 'yearly').default('monthly')
});

const getDashboard = {
  query: Joi.object({
    cohort_id: Joi.number().integer().positive().optional(),
    filter: Joi.string().valid('weekly', 'monthly', 'yearly').default('monthly')
  })
};

const getRegistrationCompletionGraph = {
  query: graphFilterQuery
};

const getPaymentStatusGraph = {
  query: graphFilterQuery
};

const getCohortFillProgressGraph = {
  query: Joi.object({
    cohort_id: Joi.number().integer().positive().required()
  })
};

module.exports = {
  getDashboard,
  getRegistrationCompletionGraph,
  getPaymentStatusGraph,
  getCohortFillProgressGraph
};
