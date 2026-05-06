const Joi = require('joi');

const recipientSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().trim().max(255).allow('').optional(),
  type: Joi.string().valid('to', 'cc', 'bcc').default('to')
});

const sendEmail = {
  body: Joi.object({
    from_email: Joi.string().email().optional(),
    from_name: Joi.string().trim().max(255).allow('').optional(),
    reply_to: Joi.string().email().optional(),
    subject: Joi.string().trim().max(255).required(),
    html: Joi.string().min(1).optional(),
    text: Joi.string().min(1).optional(),
    to: Joi.array().items(recipientSchema).min(1).required(),
    tags: Joi.array().items(Joi.string().trim().max(100)).max(10).optional(),
    important: Joi.boolean().default(false),
    track_opens: Joi.boolean().default(true),
    track_clicks: Joi.boolean().default(true),
    async: Joi.boolean().default(false)
  }).or('html', 'text')
};

module.exports = {
  sendEmail
};
