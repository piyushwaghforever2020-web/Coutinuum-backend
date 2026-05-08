const fs = require('fs/promises');
const path = require('path');
const mysql = require('mysql2/promise');
const env = require('../src/config/env');
const sequelize = require('../src/database/connection');
const seedAdmin = require('./seed-admin');

const escapeIdentifier = (value) => `\`${String(value).replace(/`/g, '``')}\``;

const buildSslOptions = () =>
  env.db.ssl
    ? {
        ssl: {
          require: true,
          rejectUnauthorized: false
        }
      }
    : {};

const ensureMigrationTable = async (connection) => {
  await connection.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
      filename VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_schema_migrations_filename (filename)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
};

const applyIncrementalMigrations = async (connection) => {
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

  await ensureMigrationTable(connection);

  for (const filename of migrationFiles) {
    const [rows] = await connection.query(
      'SELECT id FROM schema_migrations WHERE filename = ? LIMIT 1',
      [filename]
    );

    if (rows.length) {
      continue;
    }

    const migrationPath = path.join(migrationsDir, filename);
    const migrationSql = await fs.readFile(migrationPath, 'utf8');

    await connection.beginTransaction();

    try {
      await connection.query(migrationSql);
      await connection.query('INSERT INTO schema_migrations (filename) VALUES (?)', [filename]);
      await connection.commit();
      console.log(`Applied migration: ${filename}`);
    } catch (error) {
      await connection.rollback();
      throw error;
    }
  }
};

const migrate = async (options = {}) => {
  const { closeConnection = true } = options;
  const schemaPath = path.join(__dirname, '..', 'database', 'schema.sql');
  const schemaSql = await fs.readFile(schemaPath, 'utf8');

  const connection = await mysql.createConnection({
    host: env.db.host,
    port: env.db.port,
    user: env.db.user,
    password: env.db.password,
    multipleStatements: true,
    ...buildSslOptions()
  });

  try {
    const databaseName = escapeIdentifier(env.db.name);

    await connection.query(
      `CREATE DATABASE IF NOT EXISTS ${databaseName} CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE ${databaseName}`);
    await connection.query(schemaSql);
    await applyIncrementalMigrations(connection);

    console.log(`Database schema applied successfully for ${env.db.name}.`);
  } finally {
    await connection.end();
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
