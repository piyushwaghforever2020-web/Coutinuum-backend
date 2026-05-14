const PAYMENT_STATUSES = Object.freeze(['pending', 'paid', 'failed', 'refunded']);
const PARTICIPANT_PAYMENT_STATUSES = Object.freeze([
  'incomplete',
  'paid',
  'failed',
  'refunded'
]);
const REGISTRATION_STATUSES = Object.freeze(['complete', 'incomplete']);
const COHORT_STATUSES = Object.freeze(['active', 'full', 'closed']);
const FINAL_COHORT_STATUSES = Object.freeze(['full', 'closed','open', 'draft','archived', 'active', 'inactive']);
const STRIPE_EVENTS = Object.freeze({
  CHECKOUT_SESSION_COMPLETED: 'checkout.session.completed',
  CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED: 'checkout.session.async_payment_failed',
  PAYMENT_INTENT_PAYMENT_FAILED: 'payment_intent.payment_failed'
});

const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  INTERNAL_SERVER_ERROR: 500
});

module.exports = {
  PAYMENT_STATUSES,
  PARTICIPANT_PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  COHORT_STATUSES,
  FINAL_COHORT_STATUSES,
  STRIPE_EVENTS,
  HTTP_STATUS
};
