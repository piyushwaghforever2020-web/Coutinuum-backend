const contactUsRepository = require('../repositories/contactUs.repository');
const { buildPaginationMeta, getPagination } = require('../utils/pagination');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const normalizeEmail = (email) => String(email).trim().toLowerCase();
const firstDefined = (...values) => values.find((value) => value !== undefined);
const normalizeOptionalString = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const trimmed = String(value).trim();
  return trimmed || null;
};

const mapContactUs = (contact) => ({
  id: contact.id,
  first_name: contact.fistName,
  last_name: contact.lastName,
  email: contact.email,
  selected_topic: contact.selectedTopic,
  message: contact.message,
});

class ContactUsService {
  async getContactUsList(query = {}) {
    const { page, limit, offset } = getPagination(query.page, query.limit);
    const { rows, count } = await contactUsRepository.findAll({
      filters: { search: query.search },
      limit,
      offset
    });

    return {
      items: rows.map(mapContactUs),
      pagination: buildPaginationMeta(count, page, limit)
    };
  }

  async getContactUsById(id) {
    const contact = await contactUsRepository.findById(id);

    if (!contact) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Contact submission not found.');
    }

    return mapContactUs(contact);
  }

  async createContactUs(payload) {
    const firstName = firstDefined(payload.first_name, payload.fist_name, payload.firstName);
    const lastName = firstDefined(payload.last_name, payload.lastName);
    const selectedTopic = firstDefined(payload.selected_topic, payload.selectedTopic);

    const contact = await contactUsRepository.create({
      fistName: normalizeOptionalString(firstName),
      lastName: normalizeOptionalString(lastName),
      email: normalizeEmail(payload.email),
      selectedTopic: normalizeOptionalString(selectedTopic),
      message: normalizeOptionalString(payload.message)
    });

    return mapContactUs(contact);
  }

  async updateContactUs(id, payload) {
    const contact = await contactUsRepository.findById(id);

    if (!contact) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Contact submission not found.');
    }

    const firstName = firstDefined(payload.first_name, payload.fist_name, payload.firstName);
    const lastName = firstDefined(payload.last_name, payload.lastName);
    const selectedTopic = firstDefined(payload.selected_topic, payload.selectedTopic);
    const updateData = {
      ...(firstName !== undefined && { fistName: normalizeOptionalString(firstName) }),
      ...(lastName !== undefined && { lastName: normalizeOptionalString(lastName) }),
      ...(payload.email !== undefined && { email: normalizeEmail(payload.email) }),
      ...(selectedTopic !== undefined && { selectedTopic: normalizeOptionalString(selectedTopic) }),
      ...(payload.message !== undefined && { message: normalizeOptionalString(payload.message) })
    };

    const updated = await contactUsRepository.update(contact, updateData);

    return mapContactUs(updated);
  }

  async deleteContactUs(id) {
    const contact = await contactUsRepository.findById(id);

    if (!contact) {
      throw new ApiError(HTTP_STATUS.NOT_FOUND, 'Contact submission not found.');
    }

    await contactUsRepository.delete(contact);

    return {
      id,
      deleted: true
    };
  }
}

module.exports = new ContactUsService();
