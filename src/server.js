const env = require('./config/env');
const sequelize = require('./database/connection');
const app = require('./app');

const startServer = async () => {
  try {
    await sequelize.authenticate();
    console.log('Database connection established successfully.');

    if (env.db.sync) {
      await sequelize.sync({ alter: false });
      console.log('Database models synchronized.');
    }

    app.listen(env.port, () => {
      console.log(`Server is running on port ${env.port}.`);
    });
  } catch (error) {
    console.error('Unable to start server:', error);
    process.exit(1);
  }
};

startServer();
