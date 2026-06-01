const getParticipantPaymentStatus = (paymentStatus) =>
  paymentStatus === 'pending' ? 'pending' : paymentStatus;

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

const getRegistrationStatusFromPaymentStatus = (paymentStatus) => {
  if (paymentStatus === 'paid') {
    return 'complete';
  }

  // Registration status stays binary; paymentStatus carries refunded/failed detail.
  return 'incomplete';
};

module.exports = {
  getParticipantPaymentStatus,
  normalizeParticipantPaymentStatusInput,
  getRegistrationStatusFromPaymentStatus
};
