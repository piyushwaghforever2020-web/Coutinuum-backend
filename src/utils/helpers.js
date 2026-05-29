const sendMail = require('./sendMail');
const { buildEmailCard, getEmailLogoAttachments, escapeHtml } = require('./emailTemplate');

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
      buttonLabel: 'Download Cohort Calendar',
      buttonUrl: programUrl,
      footer: "Didn't expect this? Ignore it."
    }),
    attachments: getEmailLogoAttachments()
  });
};

// -------- Generic Magic Link ----------
const sendMagicLinkEmail = async ({
  email,
  name,
  magicLinkUrl
}) => {
  await sendMail({
    to: [{ email, name }],
    subject: 'Your Login Link — Continuum',
    html: buildEmailCard({
      iconType: null,
      title: 'Your Login Link',
      greeting: `Hello ${escapeHtml(name)},`,
      messageHtml: `Click the button below to access your account. This link expires in 30 minutes.`,
      buttonLabel: 'Access Your Account →',
      buttonUrl: magicLinkUrl,
      footer: 'If you did not request this link, you can safely ignore this email.'
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

// -------- Employer Invoice Sent (to manager) ----------
const sendEmployerInvoiceSentEmail = async ({
  managerEmail,
  managerName,
  participantName,
  cohortName,
  hostedInvoiceUrl
}) => {
  await sendMail({
    to: [{ email: managerEmail, name: managerName }],
    subject: 'Cohort Enrollment Invoice',
    html: buildEmailCard({
      iconType: 'success',
      title: 'Invoice Sent',
      greeting: `Hello ${escapeHtml(managerName)},`,
      messageHtml: `An invoice has been sent for <strong>${escapeHtml(participantName)}</strong>'s enrollment in <strong>${escapeHtml(cohortName)}</strong>. Please complete payment to activate the seat.`,
      buttonLabel: 'View Invoice',
      buttonUrl: hostedInvoiceUrl || '#',
      footer: 'If you did not expect this invoice, please contact support.'
    }),
    attachments: getEmailLogoAttachments()
  });
};

// -------- Employer Funding Pending (to participant) ----------
const sendEmployerFundingPendingEmail = async ({
  participantEmail,
  participantName,
  cohortName,
  managerName
}) => {
  await sendMail({
    to: [{ email: participantEmail, name: participantName }],
    subject: 'Enrollment Pending Employer Payment',
    html: buildEmailCard({
      iconType: 'success',
      title: 'Registration Received',
      greeting: `Hello ${escapeHtml(participantName)},`,
      messageHtml: `Your registration for <strong>${escapeHtml(cohortName)}</strong> is pending. An invoice has been sent to <strong>${escapeHtml(managerName)}</strong> for payment. You will receive a confirmation email once payment is complete.`,
      footer: 'If you have questions, please contact support.'
    }),
    attachments: getEmailLogoAttachments()
  });
};

// -------- Employer Payment Received (to manager) ----------
const sendEmployerPaymentReceivedEmail = async ({
  managerEmail,
  managerName,
  participantName,
  cohortName
}) => {
  await sendMail({
    to: [{ email: managerEmail, name: managerName }],
    subject: 'Payment Received — Cohort Enrollment',
    html: buildEmailCard({
      iconType: 'success',
      title: 'Payment Confirmed',
      greeting: `Hello ${escapeHtml(managerName)},`,
      messageHtml: `Payment for <strong>${escapeHtml(participantName)}</strong>'s enrollment in <strong>${escapeHtml(cohortName)}</strong> has been received. The participant seat is now active.`,
      footer: 'Thank you for your payment.'
    }),
    attachments: getEmailLogoAttachments()
  });
};

// -------- Sponsorship Invoice + Dashboard Access (to employer) ----------
const sendEmployerSponsorshipInvoiceEmail = async ({
  employerEmail,
  employerName,
  cohortName,
  totalSeats,
  hostedInvoiceUrl,
  dashboardUrl
}) => {
  await sendMail({
    to: [{ email: employerEmail, name: employerName }],
    subject: 'Sponsorship Invoice & Dashboard Access',
    html: buildEmailCard({
      iconType: 'success',
      title: 'Your Sponsorship Is Ready',
      greeting: `Hello ${escapeHtml(employerName)},`,
      messageHtml: `Your sponsorship request for <strong>${escapeHtml(cohortName)}</strong> has been created for <strong>${escapeHtml(totalSeats)}</strong> seat(s). Please pay the invoice to unlock assignment. You can also access your sponsorship dashboard using the link below.`,
      buttonLabel: 'Open Sponsorship Dashboard',
      buttonUrl: dashboardUrl || hostedInvoiceUrl || '#',
      footer: 'If needed, the invoice payment link is included in the same email thread.'
    }),
    attachments: getEmailLogoAttachments()
  });
};

// -------- Participant Credentials (sponsorship seat assignment) ----------
const sendParticipantLoginCredentialsEmail = async ({
  participantEmail,
  participantName,
  cohortName,
  temporaryPassword,
  setPasswordUrl,
  loginUrl
}) => {
  const hasSetPassword = Boolean(setPasswordUrl);
  const primaryUrl = hasSetPassword ? setPasswordUrl : (loginUrl || '#');
  const primaryLabel = hasSetPassword ? 'Set Your Password' : 'Open Participant Login';

  const followUpHtml = hasSetPassword
    ? `After setting your password, you can sign in from the participant login page.`
    : `Use your temporary password and open the participant login page to continue.`;

  await sendMail({
    to: [{ email: participantEmail, name: participantName }],
    subject: 'Your Cohort Login Credentials',
    html: buildEmailCard({
      iconType: 'success',
      title: 'Your Access Is Ready',
      greeting: `Hello ${escapeHtml(participantName)},`,
      messageHtml: `You have been assigned a seat for <strong>${escapeHtml(cohortName || 'your cohort')}</strong>. ${followUpHtml}`,
      ...(temporaryPassword && {
        passwordBox: {
          password: temporaryPassword,
          hint: 'Keep this temporary password private.'
        }
      }),
      buttonLabel: primaryLabel,
      buttonUrl: primaryUrl,
      footer: 'If you did not expect this email, please contact support.'
    }),
    attachments: getEmailLogoAttachments()
  });
};

module.exports = {
  sendPaymentConfirmationEmail,
  sendMagicLinkEmail,
  sendPaymentFailedEmail,
  sendEmployerInvoiceSentEmail,
  sendEmployerFundingPendingEmail,
  sendEmployerPaymentReceivedEmail,
  sendEmployerSponsorshipInvoiceEmail,
  sendParticipantLoginCredentialsEmail
};
