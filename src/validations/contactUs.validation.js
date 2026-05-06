const Joi = require('joi');

const contactUsId = {
  params: Joi.object({
    id: Joi.number().integer().positive().required()
  })
};

const listContactUs = {
  query: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(10),
    search: Joi.string().trim().allow('', null)
  })
};

const firstName = Joi.string().trim().max(50);
const lastName = Joi.string().trim().max(100).allow('', null);
const email = Joi.string().email().max(100);
const selectedTopic = Joi.string().trim().max(200).allow('', null);

const createContactUs = {
  body: Joi.object({
    first_name: firstName,
    fist_name: firstName,
    firstName: firstName,
    last_name: lastName,
    lastName: lastName,
    email: email.required(),
    selected_topic: selectedTopic,
    selectedTopic: selectedTopic,
    message: Joi.string().trim().allow('', null)
  }).or('first_name', 'fist_name', 'firstName')
};

const updateContactUs = {
  params: contactUsId.params,
  body: Joi.object({
    first_name: firstName,
    fist_name: firstName,
    firstName: firstName,
    last_name: lastName,
    lastName: lastName,
    email: email,
    selected_topic: selectedTopic,
    selectedTopic: selectedTopic,
    message: Joi.string().trim().allow('', null)
  })
    .min(1)
    .required()
};

module.exports = {
  contactUsId,
  listContactUs,
  createContactUs,
  updateContactUs
};
