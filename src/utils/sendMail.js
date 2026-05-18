const env = require('../config/env');
const ApiError = require('./apiError');
const { HTTP_STATUS } = require('../constants/app.constants');
const nodemailer = require('nodemailer');

const RECIPIENT_TYPES = new Set(['to', 'cc', 'bcc']);

const normalizeRecipient = (recipient, fallbackType = 'to') => {
  if (typeof recipient === 'string') {
    return recipient
      .split(/[;,]/)
      .map((email) => ({
        email: email.trim(),
        type: fallbackType
      }));
  }

  const type = String(recipient?.type || fallbackType).toLowerCase();

  return {
    email:
      typeof recipient?.email === 'string'
        ? recipient.email.trim()
        : typeof recipient?.address === 'string'
          ? recipient.address.trim()
          : '',
    name: typeof recipient?.name === 'string' ? recipient.name.trim() : undefined,
    type: RECIPIENT_TYPES.has(type) ? type : fallbackType
  };
};

const normalizeRecipientList = (input, fallbackType = 'to') => {
  if (input === undefined || input === null) return [];

  const items = Array.isArray(input) ? input : [input];

  return items
    .flatMap((recipient) => normalizeRecipient(recipient, fallbackType))
    .filter((recipient) => recipient.email.length > 0);
};

const formatRecipient = (recipient) => {
  if (!recipient.name) return recipient.email;

  return `"${recipient.name.replace(/"/g, '\\"')}" <${recipient.email}>`;
};

const groupRecipients = (payload) => {
  const primaryRecipients = payload?.to ?? payload?.recipients ?? payload?.email;
  const recipients = [
    ...normalizeRecipientList(primaryRecipients, 'to'),
    ...normalizeRecipientList(payload?.cc, 'cc'),
    ...normalizeRecipientList(payload?.bcc, 'bcc')
  ];

  return {
    to: recipients.filter((recipient) => recipient.type === 'to'),
    cc: recipients.filter((recipient) => recipient.type === 'cc'),
    bcc: recipients.filter((recipient) => recipient.type === 'bcc')
  };
};

// const mapResult = (result) => ({
//   email: result.email,
//   status: result.status,
//   reject_reason: result.reject_reason || null,
//   queued_reason: result.queued_reason || null,
//   id: result._id || null
// });

// const sendMail = async (payload) => {
//   let mailchimp = null;

//   console.log('[sendMail] ▶ sendMail called');

//   try {
//     mailchimp = require('@mailchimp/mailchimp_transactional');
//     console.log('[sendMail] ✅ @mailchimp/mailchimp_transactional package loaded');
//   } catch (error) {
//     console.error('[sendMail] ❌ Failed to load mailchimp package:', error.message);
//     throw new ApiError(
//       HTTP_STATUS.INTERNAL_SERVER_ERROR,
//       'Mailchimp package is not installed. Run npm install @mailchimp/mailchimp_transactional.'
//     );
//   }

//   const apiKey = env.mailchimp.transactionalApiKey;
//   console.log('[sendMail] 🔑 API Key present:', !!apiKey);
//   console.log('[sendMail] 🔑 API Key (first 8 chars):', apiKey ? apiKey.substring(0, 8) + '...' : 'MISSING');

//   if (!apiKey) {
//     console.error('[sendMail] ❌ Mailchimp Transactional API key is missing in .env (MAILCHIMP_TRANSACTIONAL_API_KEY)');
//     throw new ApiError(
//       HTTP_STATUS.INTERNAL_SERVER_ERROR,
//       'Mailchimp Transactional API key is not configured.'
//     );
//   }

//   const client = mailchimp(apiKey);
//   const fromEmail = payload.from_email || env.mailchimp.defaultFromEmail;
//   const fromName = payload.from_name || env.mailchimp.defaultFromName;

//   console.log('[sendMail] 📧 From Email:', fromEmail);
//   console.log('[sendMail] 👤 From Name:', fromName);
//   console.log('[sendMail] 📬 Subject:', payload.subject);
//   console.log('[sendMail] 👥 Recipients:', JSON.stringify(payload.to));
//   console.log('[sendMail] 📝 Has HTML body:', !!payload.html);
//   console.log('[sendMail] 📝 Has Text body:', !!payload.text);

//   if (!fromEmail) {
//     console.error('[sendMail] ❌ No sender email provided in payload or env');
//     throw new ApiError(
//       HTTP_STATUS.BAD_REQUEST,
//       'A sender email is required. Provide from_email in the request or MAILCHIMP_DEFAULT_FROM_EMAIL in env.'
//     );
//   }

//   // NOTE: Force async=false so Mailchimp sends synchronously and returns delivery results.
//   // When async=true, Mailchimp queues the message and returns empty results immediately.
//   const isAsync = payload.async === true ? true : false;
//   console.log('[sendMail] ⚙️  Async mode:', isAsync, '(false = synchronous, results will be populated)');

//   const messagePayload = {
//     message: {
//       from_email: fromEmail,
//       ...(fromName ? { from_name: fromName } : {}),
//       subject: payload.subject,
//       ...(payload.html ? { html: payload.html } : {}),
//       ...(payload.text ? { text: payload.text } : {}),
//       ...(payload.reply_to ? { headers: { 'Reply-To': payload.reply_to } } : {}),
//       ...(payload.tags?.length ? { tags: payload.tags } : {}),
//       important: payload.important,
//       track_opens: payload.track_opens ?? true,
//       track_clicks: payload.track_clicks ?? true,
//       to: payload.to.map(normalizeRecipient)
//     },
//     async: isAsync
//   };

//   console.log('[sendMail] 📤 Full message payload to Mailchimp:');
//   console.log(JSON.stringify(messagePayload, null, 2));

//   try {
//     const response = await client.messages.send(messagePayload);

//     console.log('[sendMail] 📥 Raw Mailchimp API response:');
//     console.log(JSON.stringify(response, null, 2));
//     console.log('[sendMail] 📊 Response type:', typeof response, '| Is Array:', Array.isArray(response));

//     // Check each recipient's delivery status
//     if (Array.isArray(response)) {
//       response.forEach((result, index) => {
//         const status = result.status;
//         const email = result.email;
//         const rejectReason = result.reject_reason;
//         console.log(`[sendMail] 📋 Recipient [${index}] ${email} → status: "${status}"${rejectReason ? ` | reject_reason: "${rejectReason}"` : ''}`);

//         if (status === 'rejected') {
//           console.warn(`[sendMail] ⚠️  Email to ${email} was REJECTED. Reason: ${rejectReason}`);
//           console.warn('[sendMail] ⚠️  Common causes: sender domain not verified in Mailchimp, invalid API key, or recipient on blocklist.');
//         } else if (status === 'invalid') {
//           console.warn(`[sendMail] ⚠️  Email to ${email} is INVALID. Check the recipient email address format.`);
//         } else if (status === 'queued') {
//           console.log(`[sendMail] 🕐  Email to ${email} is QUEUED (async mode is on or Mailchimp is throttling).`);
//         } else if (status === 'sent') {
//           console.log(`[sendMail] ✅  Email to ${email} was SENT successfully.`);
//         } else {
//           console.log(`[sendMail] ℹ️   Email to ${email} has unknown status: "${status}"`);
//         }
//       });
//     } else {
//       console.warn('[sendMail] ⚠️  Response is NOT an array — possibly an error object from Mailchimp:');
//       console.warn(JSON.stringify(response, null, 2));
//     }

//     const results = Array.isArray(response) ? response.map(mapResult) : [];
//     console.log('[sendMail] ✅ sendMail completed. Results:', JSON.stringify(results));

//     return {
//       from_email: fromEmail,
//       from_name: fromName || null,
//       subject: payload.subject,
//       recipients: payload.to,
//       results
//     };
//   } catch (error) {
//     console.error('[sendMail] ❌ Mailchimp API call failed:');
//     console.error('[sendMail]    Message:', error.message);
//     console.error('[sendMail]    Status:', error.response?.status);
//     console.error('[sendMail]    Response body:', JSON.stringify(error.response?.body || error.response?.data || null, null, 2));
//     console.error('[sendMail]    Full error:', error);
//     throw new ApiError(
//       HTTP_STATUS.BAD_REQUEST,
//       error.message || 'Failed to send email.',
//       error.response?.body || null
//     );
//   }
// };

//----------- SEND MAIL TO SMTP ---------------------

const sendMail = async (payload = {}) => {
  const recipientGroups = groupRecipients(payload);
  const recipients = [
    ...recipientGroups.to,
    ...recipientGroups.cc,
    ...recipientGroups.bcc
  ];

  if (!recipients.length) {
    throw new ApiError(HTTP_STATUS.BAD_REQUEST, 'At least one valid recipient email is required.');
  }

  const fromEmail = payload.from_email || env.smtp.fromEmail;
  const hasAuth = Boolean(env.smtp.user || env.smtp.password);

  if (!env.smtp.host) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'SMTP_HOST is not configured.');
  }

  if (!fromEmail) {
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'SMTP_FROM_EMAIL is not configured.');
  }

  if (hasAuth && (!env.smtp.user || !env.smtp.password)) {
    throw new ApiError(
      HTTP_STATUS.INTERNAL_SERVER_ERROR,
      'SMTP_USER and SMTP_PASSWORD must both be configured.'
    );
  }

  let transporter = null;
  try {
    transporter = nodemailer.createTransport({
      host: env.smtp.host,
      port: env.smtp.port,
      secure: env.smtp.secure,
      ...(hasAuth && {
        auth: {
          user: env.smtp.user,
          pass: env.smtp.password
        }
      })
    });
  } 
  catch (error) {
    console.error('[sendMail] ❌ Failed to create transporter:', error.message);
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, 'Failed to send email.');
  }

  try {
    const info = await transporter.sendMail({
      from: payload.from_name ? `"${payload.from_name}" <${fromEmail}>` : fromEmail,
      ...(recipientGroups.to.length ? { to: recipientGroups.to.map(formatRecipient) } : {}),
      ...(recipientGroups.cc.length ? { cc: recipientGroups.cc.map(formatRecipient) } : {}),
      ...(recipientGroups.bcc.length ? { bcc: recipientGroups.bcc.map(formatRecipient) } : {}),
      subject: payload.subject,
      html: payload.html,
      text: payload.text,
      ...(payload.reply_to ? { replyTo: payload.reply_to } : {}),
      ...(Array.isArray(payload.attachments) && payload.attachments.length
        ? { attachments: payload.attachments }
        : {})
    });
    console.log('[sendMail] ✅ Email sent successfully:', info);
    return info;
  } 
  catch (error) {
    console.error('[sendMail] ❌ Failed to send email:', error.message);
    throw new ApiError(HTTP_STATUS.INTERNAL_SERVER_ERROR, error.message || 'Failed to send email.');
  }
};

module.exports = sendMail;
