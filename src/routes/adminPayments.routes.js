const express = require('express');
const paymentController = require('../controllers/payment.controller');
const validate = require('../middlewares/validate.middleware');
const paymentValidation = require('../validations/payment.validation');

const router = express.Router();

router.get('/payments', validate(paymentValidation.listPayments), paymentController.getPayments);
router.get('/payments/:id', validate(paymentValidation.paymentId), paymentController.getPaymentById);
router.post(
  '/payments/:id/refund',
  validate(paymentValidation.paymentId),
  paymentController.refundPayment
);

module.exports = router;
