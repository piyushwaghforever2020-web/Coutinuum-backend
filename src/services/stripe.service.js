const Stripe = require('stripe');
const env = require('../config/env');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

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
      success_url: `${payload.successUrl}/${payload.cohortId}`,
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
