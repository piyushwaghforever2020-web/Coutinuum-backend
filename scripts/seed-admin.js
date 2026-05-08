const bcrypt = require('bcrypt');
const env = require('../src/config/env');
const sequelize = require('../src/database/connection');
const adminRepository = require('../src/repositories/admin.repository');

const seedAdmin = async (options = {}) => {
  const { closeConnection = true } = options;

  try {
    await sequelize.authenticate();

    const hashedPassword = await bcrypt.hash(
      env.defaultAdminPassword,
      env.bcryptSaltRounds
    );

    await adminRepository.upsert({
      email: env.defaultAdminEmail,
      password: hashedPassword
    });

    console.log(`Default admin seeded for ${env.defaultAdminEmail}.`);
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
};

if (require.main === module) {
  seedAdmin().catch((error) => {
    console.error('Failed to seed admin:', error);
    process.exitCode = 1;
  });
}

module.exports = seedAdmin;
