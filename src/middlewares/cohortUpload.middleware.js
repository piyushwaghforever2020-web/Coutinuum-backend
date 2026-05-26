const fs = require('fs');
const path = require('path');
const multer = require('multer');
const ApiError = require('../utils/apiError');
const { HTTP_STATUS } = require('../constants/app.constants');

const uploadDir = path.join(process.cwd(), 'uploads', 'cohorts');
fs.mkdirSync(uploadDir, { recursive: true });

const sanitizeName = (name) =>
  String(name)
    .toLowerCase()
    .replace(/[^a-z0-9.-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '').toLowerCase();
    const base = path.basename(file.originalname || 'file', ext);
    cb(null, `${Date.now()}-${sanitizeName(base)}${ext}`);
  }
});

const imageMimes = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/jpg']);
const pdfMimes = new Set(['application/pdf']);

const fileFilter = (_req, file, cb) => {
  if (file.fieldname === 'image' && imageMimes.has(file.mimetype)) {
    return cb(null, true);
  }

  if (file.fieldname === 'overview_pdf' && pdfMimes.has(file.mimetype)) {
    return cb(null, true);
  }

  return cb(new ApiError(HTTP_STATUS.BAD_REQUEST, `Invalid file type for ${file.fieldname}.`));
};

const uploadCohortAssets = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024
  }
}).fields([
  { name: 'image', maxCount: 1 },
  { name: 'overview_pdf', maxCount: 1 }
]);

const maybeParseJsonField = (value) => {
  if (typeof value !== 'string') {
    return value;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return value;
  }

  const startsLikeJson =
    (trimmed.startsWith('[') && trimmed.endsWith(']')) ||
    (trimmed.startsWith('{') && trimmed.endsWith('}'));

  if (!startsLikeJson) {
    return value;
  }

  try {
    return JSON.parse(trimmed);
  } catch (_e) {
    return value;
  }
};

const normalizeCohortMultipartBody = (req, _res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }

  const keysToParse = [
    'what_leaders_build',
    'who_its_for',
    'case_study',
    'refund_deferral_policy',
    'leave_with',
    'investment_tiers',
    'programs'
  ];

  keysToParse.forEach((key) => {
    if (req.body[key] !== undefined) {
      req.body[key] = maybeParseJsonField(req.body[key]);
    }
  });

  if (req.files?.image?.[0]) {
    req.body.image = `/uploads/cohorts/${req.files.image[0].filename}`;
  }

  if (req.files?.overview_pdf?.[0]) {
    req.body.overview_pdf = `/uploads/cohorts/${req.files.overview_pdf[0].filename}`;
  }

  next();
};

module.exports = {
  uploadCohortAssets,
  normalizeCohortMultipartBody
};
