const { Op } = require('sequelize');
const {
  LabEnquiry,
  LabEnquiryCohortInterest,
  SpeakerEnquiry,
  WaitlistSubmission,
  WaitlistReferralSource,
  EmailListSubscription
} = require('../models');

class EnquiryRepository {
  buildSearchCondition(search, fields) {
    if (!search) {
      return {};
    }

    return {
      [Op.or]: fields.map((field) => ({
        [field]: {
          [Op.like]: `%${search}%`
        }
      }))
    };
  }

  async findLabEnquiries({ search, limit, offset }) {
    return LabEnquiry.findAndCountAll({
      where: this.buildSearchCondition(search, ['name', 'email', 'roleTitle', 'company', 'urgencyNotes']),
      include: [
        {
          model: LabEnquiryCohortInterest,
          as: 'cohortInterests',
          attributes: ['id', 'interestName'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });
  }

  async createLabEnquiry(data, options = {}) {
    return LabEnquiry.create(data, options);
  }

  async createLabEnquiryInterests(rows, options = {}) {
    if (!rows.length) {
      return [];
    }

    return LabEnquiryCohortInterest.bulkCreate(rows, options);
  }

  async createSpeakerEnquiry(data, options = {}) {
    return SpeakerEnquiry.create(data, options);
  }

  async findSpeakerEnquiries({ search, limit, offset }) {
    return SpeakerEnquiry.findAndCountAll({
      where: this.buildSearchCondition(search, [
        'name',
        'email',
        'organization',
        'eventDateOrTimeframe',
        'eventType',
        'audienceSize',
        'winDescription'
      ]),
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }

  async createWaitlistSubmission(data, options = {}) {
    return WaitlistSubmission.create(data, options);
  }

  async findWaitlistSubmissions({ search, limit, offset }) {
    return WaitlistSubmission.findAndCountAll({
      where: this.buildSearchCondition(search, ['name', 'email']),
      include: [
        {
          model: WaitlistReferralSource,
          as: 'referralSources',
          attributes: ['id', 'sourceName'],
          required: false
        }
      ],
      order: [['createdAt', 'DESC']],
      limit,
      offset,
      distinct: true
    });
  }

  async createWaitlistReferralSources(rows, options = {}) {
    if (!rows.length) {
      return [];
    }

    return WaitlistReferralSource.bulkCreate(rows, options);
  }

  async createEmailListSubscription(data, options = {}) {
    return EmailListSubscription.create(data, options);
  }

  async findEmailListSubscriptions({ search, limit, offset }) {
    return EmailListSubscription.findAndCountAll({
      where: this.buildSearchCondition(search, ['name', 'email']),
      order: [['createdAt', 'DESC']],
      limit,
      offset
    });
  }
}

module.exports = new EnquiryRepository();
