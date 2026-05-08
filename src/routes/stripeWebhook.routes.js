const express = require('express');
const stripeController = require('../controllers/stripe.controller');

const router = express.Router();

router.post('/stripe/webhook', express.raw({ type: 'application/json' }), stripeController.handleWebhook);

module.exports = router;
