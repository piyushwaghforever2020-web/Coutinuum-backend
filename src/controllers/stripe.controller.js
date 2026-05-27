const applicationService = require('../services/application.service');
const stripeService = require('../services/stripe.service');
const { STRIPE_EVENTS } = require('../constants/app.constants');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const handleWebhook = asyncHandler(async (req, res) => {
  console.log('[Stripe Webhook] HIT', {
    method: req.method,
    url: req.originalUrl,
    received_at: new Date().toISOString()
  });

  const signature = req.headers['stripe-signature'];
  
  console.log('[Stripe Webhook] Request received.', {
    has_signature: Boolean(signature),
    content_length: req.headers['content-length'] || null
  });

  const event = stripeService.constructWebhookEvent(req.body, signature);
  console.log('[Stripe Webhook] Signature verified.', {
    event_id: event.id,
    event_type: event.type
  });

  if (event.type === STRIPE_EVENTS.CHECKOUT_SESSION_COMPLETED) {
    const result = await applicationService.processCompletedCheckoutSession(event.data.object);
    console.log('[Stripe Webhook] Checkout session processed.', {
      event_id: event.id,
      result
    });
  } 
  else if (event.type === STRIPE_EVENTS.PAYMENT_INTENT_SUCCEEDED) {
    const result = await applicationService.processSucceededPaymentIntent(event.data.object);
    console.log('[Stripe Webhook] Payment intent success processed.', {
      event_id: event.id,
      result
    });
  }
  else if (event.type === STRIPE_EVENTS.CHECKOUT_SESSION_ASYNC_PAYMENT_FAILED) {
    const result = await applicationService.processFailedCheckoutSession(event.data.object);
    console.log('[Stripe Webhook] Failed checkout session processed.', {
      event_id: event.id,
      result
    });
  } 
   // new one block
  else if (event.type === STRIPE_EVENTS.PAYMENT_INTENT_PAYMENT_FAILED) {
    const result = await applicationService.processFailedPaymentIntent(event.data.object);
    console.log('[Stripe Webhook] Payment intent failure processed.', {
      event_id: event.id,
      result
    });
  }
  else if (event.type === STRIPE_EVENTS.INVOICE_PAID) {
    const result = await applicationService.processPaidStripeInvoice(
      event.data.object,
      event.id
    );
    console.log('[Stripe Webhook] Invoice paid processed.', {
      event_id: event.id,
      result
    });
  }
  else if (event.type === STRIPE_EVENTS.INVOICE_PAYMENT_FAILED) {
    const result = await applicationService.processFailedStripeInvoice(
      event.data.object,
      event.id
    );
    console.log('[Stripe Webhook] Invoice payment failed processed.', {
      event_id: event.id,
      result
    });
  }
  else if (event.type === STRIPE_EVENTS.INVOICE_VOIDED) {
    const result = await applicationService.processVoidedStripeInvoice(
      event.data.object,
      event.id
    );
    console.log('[Stripe Webhook] Invoice voided processed.', {
      event_id: event.id,
      result
    });
  }
  else {
    console.log('[Stripe Webhook] Event ignored.', {
      event_id: event.id,
      event_type: event.type
    });
  }

  return sendSuccess(res, 'Webhook received successfully.', {
    received: true,
    event_type: event.type
  });
});

module.exports = {
  handleWebhook
};
