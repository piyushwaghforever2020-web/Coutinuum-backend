const sendMail = require('./sendMail');
const { buildEmailCard, getEmailLogoAttachments,escapeHtml } = require('./emailTemplate');

// -------- Payment Success ----------
const sendPaymentConfirmationEmail = async ({
  participantEmail,
  participantName,
  cohortName,
  accessPassword,
  programUrl = 'https://continuumtransformation.com/download-calender'
}) => {
  await sendMail({
    to: [{ email: participantEmail, name: participantName }],
    subject: 'Payment Confirmation',
    html: buildEmailCard({
      iconType: 'success',
      title: 'Payment Confirmed',
      greeting: `Hello ${escapeHtml(participantName)},`,
      messageHtml: `Your payment for <strong>${escapeHtml(cohortName)}</strong> has been successfully confirmed.`,
      ...(accessPassword && {
        passwordBox: {
          password: accessPassword,
          hint: 'Use this password to download the upcoming cohort file.'
        }
      }),
      buttonLabel: 'Continue To Your Program',
      buttonUrl: programUrl,
      footer: "Didn't expect this? Ignore it."
    }),
    attachments: getEmailLogoAttachments()
  });
};

// -------- Payment Failed ----------
const sendPaymentFailedEmail = async ({
  participantEmail,
  participantName,
  cohortName,
  retryUrl = '#'
}) => {
  await sendMail({
    to: [{ email: participantEmail, name: participantName }],
    subject: 'Payment Failed',
    html: buildEmailCard({
      iconType: 'error',
      title: 'Payment Failed',
      greeting: `Hello ${escapeHtml(participantName)},`,
      messageHtml: `Your payment for <strong>${escapeHtml(cohortName)}</strong> could not be processed. Please try again.`,
      buttonLabel: 'Retry Payment',
      buttonUrl: retryUrl,
      footer: 'If you are facing issues, please contact support.'
    }),
    attachments: getEmailLogoAttachments()
  });
};

module.exports = {
  sendPaymentConfirmationEmail,
  sendPaymentFailedEmail
};
