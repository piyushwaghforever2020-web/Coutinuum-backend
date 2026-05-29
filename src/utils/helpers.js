const sendMail = require('./sendMail');
const { buildEmailCard, getEmailLogoAttachments, escapeHtml } = require('./emailTemplate');
const env = require('../config/env');

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
      messageHtml: `Click the button below to access your account. This link expires in ${env.magicLink.expiresDays} day${env.magicLink.expiresDays === 1 ? '' : 's'}.`,
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

// -------- Sponsorship registration acknowledgement (manual payment) ----------
const sendEmployerSponsorshipRegistrationAckEmail = async ({
  employerEmail,
  employerName,
  cohortName,
  totalSeats
}) => {
  await sendMail({
    to: [{ email: employerEmail, name: employerName }],
    subject: 'Sponsorship Request Received',
    html: buildEmailCard({
      iconType: 'success',
      title: 'Sponsorship Request Received',
      greeting: `Hello ${escapeHtml(employerName)},`,
      messageHtml: `Thank you for your sponsorship request for <strong>${escapeHtml(cohortName)}</strong> covering <strong>${escapeHtml(String(totalSeats))}</strong> seat(s). Our sales team will contact you shortly to complete payment. Once payment is confirmed, you will receive an email with access to your sponsorship dashboard to assign seats to participants.`,
      footer: 'If you did not submit this request, please contact support.'
    }),
    attachments: getEmailLogoAttachments()
  });
};

// -------- Sponsorship registration notification (admin) ----------
const formatSponsorshipAmount = (amount, currency = 'usd') => {
  const code = String(currency || 'usd').toUpperCase();

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code
    }).format(Number(amount));
  } catch {
    return `${amount} ${code}`;
  }
};

const formatEmployerMessageHtml = (message) => {
  const normalized = String(message).replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  return escapeHtml(normalized).replace(/\n/g, '<br>');
};

const sendSponsorshipRegistrationNotification = async ({
  adminEmail,
  employerEmail,
  employerName,
  companyName,
  cohortName,
  totalSeats,
  amount,
  currency,
  message
}) => {
  if (!adminEmail) {
    console.warn('[Sponsorship] Admin notification skipped: no admin email configured.');
    return;
  }

  const messageBlock = message
    ? `<p><strong>Employer message:</strong><br>${formatEmployerMessageHtml(message)}</p>`
    : '';

  const companyLine = companyName
    ? `<li><strong>Company:</strong> ${escapeHtml(companyName)}</li>`
    : '';

  const formattedAmount = formatSponsorshipAmount(amount, currency);

  await sendMail({
    to: [{ email: adminEmail, name: 'Continuum Admin' }],
    subject: `New block sponsorship: ${String(cohortName).replace(/[\r\n]+/g, ' ').trim()}`,
    html: buildEmailCard({
      iconType: 'success',
      title: 'New Block Sponsorship Request',
      greeting: 'Hello Admin,',
      messageHtml: `
        <p>A new block sponsorship registration was submitted.</p>
        <ul style="text-align:left;margin:16px 0;padding-left:20px;">
          <li><strong>Employer:</strong> ${escapeHtml(employerName)} (${escapeHtml(employerEmail)})</li>
          ${companyLine}
          <li><strong>Cohort:</strong> ${escapeHtml(cohortName)}</li>
          <li><strong>Seats:</strong> ${escapeHtml(String(totalSeats))}</li>
          <li><strong>Amount:</strong> ${escapeHtml(formattedAmount)}</li>
        </ul>
        ${messageBlock}
        <p>Please follow up with the sales team and mark the sponsorship as paid in the admin panel once payment is received.</p>
      `,
      footer: 'This is an automated notification from Continuum.'
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
  sendEmployerSponsorshipRegistrationAckEmail,
  sendParticipantLoginCredentialsEmail,
  sendSponsorshipRegistrationNotification
};
