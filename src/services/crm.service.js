const { HTTP_STATUS } = require('../constants/app.constants');

class CrmService {
  /**
   * Updates a contact's tags in the CRM (Stub for future HubSpot/ActiveCampaign integration)
   * @param {Object} payload 
   * @param {string} payload.email - Participant's email
   * @param {string[]} payload.tags - Array of tags to apply
   */
  async update({ email, tags }) {
    if (!email || !tags || !Array.isArray(tags)) {
      console.warn('[CRM Integration] Invalid payload for CRM update', { email, tags });
      return false;
    }
    
    // TODO: Replace with actual CRM API call (e.g. HubSpot, ActiveCampaign, Mailchimp)
    console.log(`[CRM Integration] Mock update for ${email} with tags: [${tags.join(', ')}]`);
    return true;
  }
}

module.exports = new CrmService();
