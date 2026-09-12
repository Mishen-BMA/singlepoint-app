require('dotenv').config();
const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not configured');
}

const connectionParts = connectionString.match(
  /^postgresql:\/\/([^:]+):(.+)@([^:/]+):(\d+)\/([^?]+)$/
);

if (!connectionParts) {
  throw new Error('DATABASE_URL has an invalid PostgreSQL format');
}

const [, user, rawPassword, host, port, database] = connectionParts;
let password;

try {
  password = decodeURIComponent(rawPassword);
} catch (error) {
  password = rawPassword;
}

const pool = new Pool({
  user,
  password,
  host,
  port: Number(port),
  database,
  ssl: { rejectUnauthorized: false }
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

module.exports = pool;