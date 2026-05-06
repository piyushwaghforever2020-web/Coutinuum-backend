const getParticipantPaymentStatus = (paymentStatus) =>
  paymentStatus === 'pending' ? 'incomplete' : paymentStatus;

const normalizeParticipantPaymentStatusInput = (paymentStatus) => {
  if (!paymentStatus) {
    return paymentStatus;
  }

  if (paymentStatus === 'incomplete') {
    return 'pending';
  }

  if (paymentStatus === 'refund') {
    return 'refunded';
  }

  return paymentStatus;
};

const getRegistrationStatusFromPaymentStatus = (paymentStatus) =>
  paymentStatus === 'paid' ? 'complete' : 'incomplete';

module.exports = {
  getParticipantPaymentStatus,
  normalizeParticipantPaymentStatusInput,
  getRegistrationStatusFromPaymentStatus
};
