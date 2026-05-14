const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const logger = require('morgan');
const env = require('./config/env');
const routes = require('./routes');
const stripeWebhookRoutes = require('./routes/stripeWebhook.routes');
const { errorHandler, notFoundHandler } = require('./middlewares/error.middleware');
require('./utils/crons/cohortRemindersCron.js')
require('./utils/crons/syncCohortStatusCron.js')

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: env.corsOrigin === '*' ? true : env.corsOrigin.split(',').map((value) => value.trim())
  })
);

app.use(env.apiPrefix, stripeWebhookRoutes);
app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Service is healthy.',
    data: {
      uptime: process.uptime()
    }
  });
});

app.use(env.apiPrefix, routes);
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
