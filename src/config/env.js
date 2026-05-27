const dotenv = require('dotenv');
const Joi = require('joi');

dotenv.config();

const envSchema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().port().default(4000),
  API_PREFIX: Joi.string().default('/api/v1'),
  CORS_ORIGIN: Joi.string().default('*'),
  DB_HOST: Joi.string().required(),
  DB_PORT: Joi.number().port().default(3306),
  DB_NAME: Joi.string().required(),
  DB_USER: Joi.string().required(),
  DB_PASSWORD: Joi.string().allow('').required(),
  DB_SSL: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_LOGGING: Joi.boolean().truthy('true').falsy('false').default(false),
  DB_SYNC: Joi.boolean().truthy('true').falsy('false').default(false),
  JWT_SECRET: Joi.string().min(16).required(),
  JWT_EXPIRES_IN: Joi.string().default('1d'),
  BCRYPT_SALT_ROUNDS: Joi.number().integer().min(8).max(15).default(10),
  DEFAULT_ADMIN_EMAIL: Joi.string().email().default('admin@continuum.com'),
  DEFAULT_ADMIN_PASSWORD: Joi.string().min(8).default('Admin@123'),
  STRIPE_SECRET_KEY: Joi.string().allow('').default(''),
  STRIPE_WEBHOOK_SECRET: Joi.string().allow('').default(''),
  STRIPE_CURRENCY: Joi.string().trim().lowercase().default('usd'),
  STRIPE_INVOICE_DUE_DAYS: Joi.number().integer().min(1).max(90).default(14),
  PAYMENT_SUCCESS_URL: Joi.string().uri().default('http://localhost:3000/payment/success'),
  PAYMENT_CANCEL_URL: Joi.string().uri().default('http://localhost:3000/payment/cancel'),
  MAILCHIMP_TRANSACTIONAL_API_KEY: Joi.string().allow('').default(''),
  MAILCHIMP_DEFAULT_FROM_EMAIL: Joi.string().email().allow('').default(''),
  MAILCHIMP_DEFAULT_FROM_NAME: Joi.string().allow('').default(''),
  SMTP_HOST: Joi.string().hostname().allow('').default(''),
  SMTP_PORT: Joi.number().port().default(587),
  SMTP_SECURE: Joi.boolean().truthy('true').falsy('false').default(false),
  SMTP_USER: Joi.string().allow('').default(''),
  SMTP_PASSWORD: Joi.string().allow('').default(''),
  SMTP_FROM_EMAIL: Joi.string().email().allow('').default('')
}).unknown();

const { error, value } = envSchema.validate(process.env, {
  abortEarly: false,
  convert: true
});

if (error) {
  throw new Error(`Environment validation error: ${error.message}`);
}

module.exports = Object.freeze({
  nodeEnv: value.NODE_ENV,
  port: value.PORT,
  apiPrefix: value.API_PREFIX,
  corsOrigin: value.CORS_ORIGIN,
  db: {
    host: value.DB_HOST,
    port: value.DB_PORT,
    name: value.DB_NAME,
    user: value.DB_USER,
    password: value.DB_PASSWORD,
    ssl: value.DB_SSL,
    logging: value.DB_LOGGING,
    sync: value.DB_SYNC
  },
  jwtSecret: value.JWT_SECRET,
  jwtExpiresIn: value.JWT_EXPIRES_IN,
  bcryptSaltRounds: value.BCRYPT_SALT_ROUNDS,
  defaultAdminEmail: value.DEFAULT_ADMIN_EMAIL,
  defaultAdminPassword: value.DEFAULT_ADMIN_PASSWORD,
  stripe: {
    secretKey: value.STRIPE_SECRET_KEY,
    webhookSecret: value.STRIPE_WEBHOOK_SECRET,
    currency: value.STRIPE_CURRENCY,
    successUrl: value.PAYMENT_SUCCESS_URL,
    cancelUrl: value.PAYMENT_CANCEL_URL,
    invoiceDueDays: value.STRIPE_INVOICE_DUE_DAYS
  },
  mailchimp: {
    transactionalApiKey: value.MAILCHIMP_TRANSACTIONAL_API_KEY,
    defaultFromEmail: value.MAILCHIMP_DEFAULT_FROM_EMAIL,
    defaultFromName: value.MAILCHIMP_DEFAULT_FROM_NAME
  },
  smtp: {
    host: value.SMTP_HOST,
    port: value.SMTP_PORT,
    secure: value.SMTP_SECURE,
    user: value.SMTP_USER,
    password: value.SMTP_PASSWORD,
    fromEmail: value.SMTP_FROM_EMAIL
  }
});
