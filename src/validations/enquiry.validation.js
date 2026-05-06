const Joi = require('joi');

const labCohortInterestValues = [
  'Leading in Flat, AI-Enabled Organizations',
  'AI Automation for Enterprise Transformation Leaders',
  'Leading Complex Projects',
  'Enterprise Transformation Lab'
];

const waitlistReferralValues = ['Social Media', 'Friend/Referral', 'Website', 'Other'];

const speakerEventTypeValues = ['keynote', 'panel', 'fireside_chat', 'executive_session', 'other'];

const listEnquiries = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('', null)
  })
};

const createLabEnquiry = {
  body: Joi.object({
    name: Joi.string().trim().max(150).required(),
    email: Joi.string().email().required(),
    role_title: Joi.string().trim().max(150).allow('', null),
    company: Joi.string().trim().max(150).allow('', null),
    urgency_notes: Joi.string().trim().allow('', null),
    cohort_interests: Joi.array()
  })
};

const createSpeakerEnquiry = {
  body: Joi.object({
    name: Joi.string().trim().max(150).required(),
    email: Joi.string().email().required(),
    organization: Joi.string().trim().max(150).required(),
    event_date_or_timeframe: Joi.string().trim().max(120).required(),
    event_type: Joi.string()
      .trim()
      .valid(...speakerEventTypeValues)
      .required(),
    audience_size: Joi.string().trim().max(150).required(),
    win_description: Joi.string().trim().required()
  })
};

const createWaitlistSubmission = {
  body: Joi.object({
    name: Joi.string().trim().max(150).required(),
    email: Joi.string().email().required(),
    referral_sources: Joi.array()
      .items(Joi.string().valid(...waitlistReferralValues))
      .unique()
      .default([])
  })
};

const createEmailListSubscription = {
  body: Joi.object({
    name: Joi.string().trim().max(150).required(),
    email: Joi.string().email().required(),
    send_new_podcast_episodes: Joi.boolean().default(false)
  })
};

module.exports = {
  listEnquiries,
  createLabEnquiry,
  createSpeakerEnquiry,
  createWaitlistSubmission,
  createEmailListSubscription
};
