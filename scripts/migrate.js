const fs = require('fs/promises');
const path = require('path');
const { Client } = require('pg');
const env = require('../src/config/env');
const sequelize = require('../src/database/connection');
const seedAdmin = require('./seed-admin');

const buildSslOptions = () =>
  env.db.ssl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    : {};

const ensureMigrationTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGSERIAL PRIMARY KEY,
      filename VARCHAR(255) NOT NULL UNIQUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
};

const applyIncrementalMigrations = async (client) => {
  const migrationsDir = path.join(__dirname, '..', 'database', 'migrations');
  const entries = await fs.readdir(migrationsDir, { withFileTypes: true }).catch((error) => {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  });

  const migrationFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.sql'))
    .map((entry) => entry.name)
    .sort();

  if (!migrationFiles.length) {
    return;
  }

  await ensureMigrationTable(client);

  for (const filename of migrationFiles) {
    const { rows } = await client.query(
      'SELECT id FROM schema_migrations WHERE filename = $1 LIMIT 1',
      [filename]
    );

    if (rows.length) {
      continue;
    }

    const migrationPath = path.join(migrationsDir, filename);
    const migrationSql = await fs.readFile(migrationPath, 'utf8');

    await client.query('BEGIN');

    try {
      await client.query(migrationSql);
      await client.query('INSERT INTO schema_migrations (filename) VALUES ($1)', [filename]);
      await client.query('COMMIT');
      console.log(`Applied migration: ${filename}`);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    }
  }
};

const migrate = async (options = {}) => {
  const { closeConnection = true } = options;

  const client = new Client({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    database: env.db.name,
    ...buildSslOptions()
  });

  try {
    await client.connect();
    await applyIncrementalMigrations(client);

    console.log(`Database schema applied successfully for ${env.db.name}.`);
  } finally {
    await client.end();
  }

  try {
    await seedAdmin({ closeConnection: false });
  } finally {
    if (closeConnection) {
      await sequelize.close();
    }
  }
};

if (require.main === module) {
  migrate().catch((error) => {
    console.error('Migration failed:', error);
    process.exitCode = 1;
  });
}

module.exports = migrate;

