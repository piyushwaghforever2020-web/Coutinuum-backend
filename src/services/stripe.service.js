const Stripe = require('stripe');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');
const stripeCustomerRepository = require('../repositories/stripeCustomer.repository');

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

  async retrieveCheckoutSessionByPaymentIntent(paymentIntentId) {
    const stripe = this.getClient();
    const sessions = await stripe.checkout.sessions.list({
      payment_intent: paymentIntentId,
      limit: 1
    });
    return sessions.data[0] || null;
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
    const customerId = await this.findOrCreateManagerCustomer({
      email: managerEmail,
      name: managerName
    });

    await stripe.invoiceItems.create({
      customer: customerId,
      amount: Math.round(amount * 100),
      currency,
      description: `Cohort enrollment: ${cohortName}`,
      metadata
    });

    const draftInvoice = await stripe.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: env.stripe.invoiceDueDays,
      metadata,
      auto_advance: false
    });

    const finalizedInvoice = await stripe.invoices.finalizeInvoice(draftInvoice.id);
    const sentInvoice = await stripe.invoices.sendInvoice(finalizedInvoice.id);

    return {
      customerId,
      invoiceId: sentInvoice.id,
      status: 'sent',
      hostedInvoiceUrl: sentInvoice.hosted_invoice_url || null,
      invoicePdfUrl: sentInvoice.invoice_pdf || null,
      invoiceNumber: sentInvoice.number || null
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
