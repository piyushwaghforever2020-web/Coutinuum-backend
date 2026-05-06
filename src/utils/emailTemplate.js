const path = require('path');

const LOGO_CID = 'continuum-logo';
const LOGO_PATH = path.join(__dirname, '..', '..', 'public', 'logo', 'Logo.png');

const escapeHtml = (value = '') =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getEmailLogoAttachments = () => [
  {
    filename: 'Logo.png',
    path: LOGO_PATH,
    cid: LOGO_CID
  }
];


/**
 * @param {object} opts
 * @param {string}  opts.title
 * @param {string}  opts.greeting
 * @param {string}  opts.messageHtml   - raw HTML (caller is responsible for escaping values inside)
 * @param {string}  opts.buttonLabel
 * @param {string}  [opts.buttonUrl]
 * @param {string}  opts.footer
 * @param {'success'|'error'|null} [opts.iconType]  - renders checkmark or X circle
 * @param {{password: string, hint: string}|null} [opts.passwordBox]
 */
const buildEmailCard = ({
  title,
  greeting,
  messageHtml,
  buttonLabel,
  buttonUrl = '#',
  footer,
  iconType = null,
  passwordBox = null
}) => {
  const iconHtml =
  iconType === 'success'
    ? `<div style="text-align:center;margin-bottom:24px;">
         <div style="display:inline-flex;align-items:center;justify-content:center;
                     width:52px;height:52px;border-radius:50%;background:#E9F7EF;
                     font-size:26px;color:#27AE60;line-height:1;">
           &#10003;
         </div>
       </div>`
    : iconType === 'error'
    ? `<div style="text-align:center;margin-bottom:24px;">
         <div style="display:inline-flex;align-items:center;justify-content:center;
                     width:52px;height:52px;border-radius:50%;background:#FDECEA;
                     font-size:26px;color:#E74C3C;line-height:1;">
           &#10007;
         </div>
       </div>`
    : '';

  const passwordBoxHtml = passwordBox
    ? `<div style="border:1px solid #E0DDD8;border-radius:8px;padding:14px 16px;margin-bottom:24px;">
         <p style="margin:0 0 10px;font-size:11px;font-weight:700;letter-spacing:0.08em;
                   color:#333333;text-transform:uppercase;">
           Your Access Password
         </p>
         <div style="display:flex;align-items:center;justify-content:space-between;">
           <span style="color:#B8965A;font-size:14px;font-weight:600;
                        letter-spacing:0.04em;font-family:monospace;">
             ${escapeHtml(passwordBox.password)}
           </span>
           <span style="background:#491B27;color:#ffffff;padding:5px 14px;
                        border-radius:20px;font-size:12px;font-weight:600;
                        white-space:nowrap;">
             &#x2398;&nbsp;Copy
           </span>
         </div>
         <p style="margin:10px 0 0;font-size:12px;color:#888888;">
           ${escapeHtml(passwordBox.hint)}
         </p>
       </div>`
    : '';

  return `
    <div style="margin:0;padding:32px 16px;background:#FAF7F2;
                font-family:Arial,Helvetica,sans-serif;">

      <div style="max-width:480px;margin:0 auto;background:#ffffff;
                  border-radius:12px;padding:36px 28px;">

        <!-- Logo -->
        <div style="text-align:center;margin-bottom:28px;">
          <img src="cid:${LOGO_CID}" alt="Continuum Transformation"
               style="width:160px;height:auto;display:block;margin:0 auto;" />
        </div>

        <!-- Status icon -->
        ${iconHtml}

        <!-- Title — left aligned, bold -->
        <h2 style="margin:0 0 10px;color:#1A1A1A;font-size:20px;
                   font-weight:700;text-align:left;">
          ${escapeHtml(title)}
        </h2>

        <!-- Greeting — left aligned -->
        <p style="margin:0 0 6px;color:#333333;font-size:14px;text-align:left;">
          ${escapeHtml(greeting)}
        </p>

        <!-- Message — left aligned, supports inline HTML (bold etc.) -->
        <p style="margin:0 0 24px;color:#444444;font-size:14px;
                  line-height:1.7;text-align:left;">
          ${messageHtml}
        </p>

        <!-- Password box (optional) -->
        ${passwordBoxHtml}

        <!-- CTA button — full width -->
        <div style="margin-bottom:20px;">
          <a href="${buttonUrl}"
             style="display:block;padding:14px 20px;background:#491B27;
                    color:#ffffff;border-radius:6px;font-size:14px;
                    font-weight:600;text-align:center;text-decoration:none;">
            ${escapeHtml(buttonLabel)} &rarr;
          </a>
        </div>

        <!-- Footer — centered, muted -->
        <p style="margin:0;font-size:12px;color:#999999;text-align:center;">
          ${escapeHtml(footer)}
        </p>

      </div>
    </div>
  `;
};

module.exports = {
   escapeHtml,         
  buildEmailCard,
  getEmailLogoAttachments
};