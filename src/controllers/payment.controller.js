const paymentService = require('../services/payment.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');

const getPayments = asyncHandler(async (req, res) => {
  const data = await paymentService.getPayments(req.query);
  return sendSuccess(res, 'Payments fetched successfully.', data);
});

const getPaymentById = asyncHandler(async (req, res) => {
  const data = await paymentService.getPaymentById(req.params.id);
  return sendSuccess(res, 'Payment fetched successfully.', data);
});

const refundPayment = asyncHandler(async (req, res) => {
  const data = await paymentService.refundPayment(req.params.id);
  return sendSuccess(res, 'Payment refunded successfully.', data);
});

module.exports = {
  getPayments,
  getPaymentById,
  refundPayment
};
