const Stripe = require('stripe');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');
const stripeCustomerRepository = require('../repositories/stripeCustomer.repository');

const toPositiveMinorUnitAmount = (amount) => {
  const numericAmount = Number(amount);
  const minorUnitAmount = Math.round(numericAmount * 100);

  if (!Number.isFinite(numericAmount) || minorUnitAmount <= 0) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'Invoice amount must be greater than zero.');
  }

  return minorUnitAmount;
};

class StripeService {
  constructor() {
    this.client = null;
  }

  getClient() {
    if (!env.stripe.secretKey) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Stripe is not configured. Please set STRIPE_SECRET_KEY.'
      );
    }

    if (!this.client) {
      this.client = new Stripe(env.stripe.secretKey);
    }

    return this.client;
  }

  async createCheckoutSession(payload) {
    const stripe = this.getClient();

    return stripe.checkout.sessions.create({
      mode: 'payment',
      success_url: payload.successUrl,
      cancel_url: payload.cancelUrl,
      expires_at: Math.floor(Date.now() / 1000) + 30 * 60,
      customer_email: payload.customerEmail,
      metadata: {
        participant_id: String(payload.participantId),
        cohort_id: String(payload.cohortId)
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: payload.currency,
            unit_amount: payload.unitAmount,
            product_data: {
              name: payload.productName,
              description: payload.productDescription || undefined
            }
          }
        }
      ]
    });
  }

  async retrieveCheckoutSession(sessionId) {
    const stripe = this.getClient();
    return stripe.checkout.sessions.retrieve(sessionId);
  }

  async expireCheckoutSession(sessionId) {
    const stripe = this.getClient();
    return stripe.checkout.sessions.expire(sessionId);
  }

  async retrieveCheckoutSessionByPaymentIntent(paymentIntentId) {
    const stripe = this.getClient();
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1
    });
    return sessions.data[0] || null;
  }

  async refundPaymentIntent(paymentIntentId, { idempotencyKey } = {}) {
    const stripe = this.getClient();
    return stripe.refunds.create(
      {
        payment_intent: paymentIntentId
      },
      idempotencyKey
        ? {
            idempotencyKey
          }
        : undefined
    );
  }

  async findOrCreateManagerCustomer({ email, name }) {
    const stripe = this.getClient();
    const normalizedEmail = String(email).trim().toLowerCase();

    const existing = await stripeCustomerRepository.findByEmail(normalizedEmail);
    if (existing) {
      return existing.stripeCustomerId;
    }

    const customer = await stripe.customers.create({
      email: normalizedEmail,
      name: name || undefined,
      metadata: {
        source: 'continuum_employer_funded'
      }
    });

    await stripeCustomerRepository.create({
      email: normalizedEmail,
      name: name || null,
      stripeCustomerId: customer.id
    });

    return customer.id;
  }

  async createAndSendEmployerInvoice({
    managerEmail,
    managerName,
    amount,
    currency,
    cohortName,
    metadata
  }) {
    const stripe = this.getClient();
    const invoiceAmount = toPositiveMinorUnitAmount(amount);
    
    const customerId = await this.findOrCreateManagerCustomer({
      email: managerEmail,
      name: managerName
    });

    const draftInvoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: env.stripe.invoiceDueDays,
      metadata,
      auto_advance: false
    });

    await stripe.invoiceItems.create({
      customer: customerId,
      invoice: draftInvoice.id,
      amount: invoiceAmount,
      currency,
      description: `Cohort enrollment: ${cohortName}`,
      metadata
    });

    const pricedDraftInvoice = await stripe.invoices.retrieve(draftInvoice.id);
    const draftAmountDue = Number(
      pricedDraftInvoice.amount_due ?? pricedDraftInvoice.total ?? 0
    );

    if (draftAmountDue <= 0) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Stripe invoice was created without a payable line item.'
      );
    }

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);
    const finalizedAmountDue = Number(
      finalizedInvoice.amount_due ?? finalizedInvoice.total ?? 0
    );

    if (finalizedAmountDue <= 0) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Stripe invoice finalized with a zero amount.'
      );
    }

    const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);

    return {
      customerId,
      invoiceId: sentInvoice.id,
      status: 'invoice_requested',
      stripeStatus: sentInvoice.status || null,
      hostedInvoiceUrl: sentInvoice.hosted_invoice_url || null,
      invoicePdfUrl: sentInvoice.invoice_pdf || null,
      invoiceNumber: sentInvoice.number || null,
      amountDue: Number(sentInvoice.amount_due ?? finalizedAmountDue) / 100
    };
  }

  constructWebhookEvent(payload, signature) {
    if (!env.stripe.secretKey || !env.stripe.webhookSecret) {
      throw new ApiError(
        HTTP_STATUS.INTERNAL_SERVER_ERROR,
        'Stripe webhook is not configured. Please set STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET.'
      );
    }

    const stripe = this.getClient();
    return stripe.webhooks.constructEvent(payload, signature, env.stripe.webhookSecret);
  }
}

module.exports = new StripeService();
