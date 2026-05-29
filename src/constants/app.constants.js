const PAYMENT_STATUSES = Object.freeze(['pending', 'paid', 'failed', 'refunded']);
const MAGIC_LINK_ROLES = Object.freeze(['participant', 'employer']);
const MAGIC_LINK_PURPOSES = Object.freeze([
  'login',
  'file_download',
  'dashboard_access',
  'set_password'
]);
const PAYMENT_TYPES = Object.freeze(['self_pay', 'employer_funded']);
const SEAT_STATUSES = Object.freeze(['locked', 'available', 'assigned', 'active', 'released']);
const INVOICE_STATUSES = Object.freeze([
  'invoice_requested',
  'invoice_sent',
  'created',
  'sent',
  'paid',
  'failed',
  'refunded'
]);
const PAYMENT_METHODS = Object.freeze(['checkout', 'stripe_invoice']);
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
  PAYMENT_INTENT_SUCCEEDED: 'payment_intent.succeeded',
  PAYMENT_INTENT_PAYMENT_FAILED: 'payment_intent.payment_failed',
  INVOICE_CREATED: 'invoice.created',
  INVOICE_FINALIZED: 'invoice.finalized',
  INVOICE_SENT: 'invoice.sent',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_PAYMENT_FAILED: 'invoice.payment_failed',
  INVOICE_VOIDED: 'invoice.voided'
});

const EMPLOYER_FUNDED_FLOW = 'employer_funded_individual';

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
  PAYMENT_TYPES,
  SEAT_STATUSES,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  PARTICIPANT_PAYMENT_STATUSES,
  REGISTRATION_STATUSES,
  COHORT_STATUSES,
  FINAL_COHORT_STATUSES,
  STRIPE_EVENTS,
  EMPLOYER_FUNDED_FLOW,
  HTTP_STATUS,
  MAGIC_LINK_ROLES,
  MAGIC_LINK_PURPOSES
};
