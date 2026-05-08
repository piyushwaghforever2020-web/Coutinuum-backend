const { HTTP_STATUS } = require('../constants/app.constants');
const { sendError } = require('../utils/apiResponse');

const notFoundHandler = (req, res) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, HTTP_STATUS.NOT_FOUND);
};

const errorHandler = (err, req, res, next) => {
  if (err.type === 'StripeSignatureVerificationError') {
    return sendError(
      res,
      'Invalid Stripe webhook signature.',
      HTTP_STATUS.BAD_REQUEST
    );
  }

  if (err.name === 'SequelizeUniqueConstraintError') {
    return sendError(
      res,
      'A record with the provided unique field already exists.',
      HTTP_STATUS.CONFLICT,
      err.errors?.map((errorItem) => errorItem.message)
    );
  }

  if (err.name === 'SequelizeValidationError') {
    return sendError(
      res,
      'Database validation failed.',
      HTTP_STATUS.BAD_REQUEST,
      err.errors?.map((errorItem) => errorItem.message)
    );
  }

  const statusCode = err.statusCode || HTTP_STATUS.INTERNAL_SERVER_ERROR;
  const message =
    statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR
      ? 'Something went wrong.'
      : err.message;

  if (statusCode === HTTP_STATUS.INTERNAL_SERVER_ERROR) {
    console.error(err);
  }

  return sendError(res, message, statusCode, err.details);
};

module.exports = {
  notFoundHandler,
  errorHandler
};
