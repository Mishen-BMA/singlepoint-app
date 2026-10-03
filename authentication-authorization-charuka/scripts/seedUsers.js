require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../../models/db');
const { initializeUserTable, createUser, findUserByEmail } = require('../models/userModel');

async function seed() {
  await initializeUserTable();
  const { SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, SEED_ADMIN_PASSWORD } = process.env;
  if (!SEED_ADMIN_NAME || !SEED_ADMIN_EMAIL || !SEED_ADMIN_PASSWORD || SEED_ADMIN_PASSWORD.length < 12) {
    throw new Error('Set SEED_ADMIN_NAME, SEED_ADMIN_EMAIL, and a SEED_ADMIN_PASSWORD of at least 12 characters');
  }

  const email = SEED_ADMIN_EMAIL.trim().toLowerCase();
  const existing = await findUserByEmail(email);
  if (existing) console.log(`Skipping ${email} — already exists`);
  else {
    const passwordHash = await bcrypt.hash(SEED_ADMIN_PASSWORD, 10);
    await createUser({ name: SEED_ADMIN_NAME.trim(), email, passwordHash, role: 'admin' });
    console.log(`Created admin: ${email}`);
  }

  await db.end();
}

seed().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
