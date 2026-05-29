const magicLinkService = require('../services/magicLink.service');
const { sendSuccess } = require('../utils/apiResponse');
const asyncHandler = require('../utils/asyncHandler');
const { MAGIC_LINK_PURPOSES } = require('../constants/app.constants');

const SESSION_PURPOSES = MAGIC_LINK_PURPOSES.filter(
  (purpose) => purpose === 'login' || purpose === 'dashboard_access'
);

/**
 * POST /auth/magic-link/verify
 * Verifies a magic link token and returns a session JWT.
 *
 * Body: { token: "<raw_token_from_email_link>" }
 *
 * On success returns:
 *   - sessionToken: JWT for subsequent authenticated requests
 *   - user: { email, role, participantId, cohortId, purpose }
 *   - redirectUrl: the frontend page the user should be sent to
 */
const verifyMagicLink = asyncHandler(async (req, res) => {
  const { token } = req.body;

  const result = await magicLinkService.verifyMagicLink(token, {
    allowedPurposes: SESSION_PURPOSES
  });

  // Build redirect URL — point to the cohort the employer bought for the employee
  let redirectUrl = '/';

  if (
    result.user.role === 'employer' &&
    result.user.purpose === 'dashboard_access' &&
    result.user.sponsorshipId
  ) {
    redirectUrl = `/employer/sponsorships/${result.user.sponsorshipId}`;
  } else if (result.user.cohortId) {
    redirectUrl = `/cohort/?id=${result.user.cohortId}`;
  }

  return sendSuccess(res, 'Magic link verified successfully.', {
    session_token: result.sessionToken,
    user: {
      email: result.user.email,
      role: result.user.role,
      participant_id: result.user.participantId,
      employer_user_id: result.user.employerUserId,
      sponsorship_id: result.user.sponsorshipId,
      cohort_id: result.user.cohortId
    },
    redirect_url: redirectUrl
  });
});

module.exports = {
  verifyMagicLink
};
