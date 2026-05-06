const express = require('express');
const enquiryController = require('../controllers/enquiry.controller');
const enquiryValidation = require('../validations/enquiry.validation');
const validate = require('../middlewares/validate.middleware');

const router = express.Router();

router.get(
  '/enquiries/lab',
  validate(enquiryValidation.listEnquiries),
  enquiryController.getLabEnquiries
);

router.post(
  '/enquiries/lab',
  validate(enquiryValidation.createLabEnquiry),
  enquiryController.createLabEnquiry
);

router.get(
  '/enquiries/speaker',
  validate(enquiryValidation.listEnquiries),
  enquiryController.getSpeakerEnquiries
);

router.post(
  '/enquiries/speaker',
  validate(enquiryValidation.createSpeakerEnquiry),
  enquiryController.createSpeakerEnquiry
);

router.get(
  '/enquiries/waitlist',
  validate(enquiryValidation.listEnquiries),
  enquiryController.getWaitlistSubmissions
);

router.post(
  '/enquiries/waitlist',
  validate(enquiryValidation.createWaitlistSubmission),
  enquiryController.createWaitlistSubmission
);

router.get(
  '/enquiries/email-list',
  validate(enquiryValidation.listEnquiries),
  enquiryController.getEmailListSubscriptions
);

router.post(
  '/enquiries/email-list',
  validate(enquiryValidation.createEmailListSubscription),
  enquiryController.createEmailListSubscription
);

module.exports = router;
