require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../../models/db');
const { initializeUserTable, createUser, findUserByEmail } = require('../models/userModel');

// Change these passwords before a real demo/viva if the DB is reachable
// from outside your machine.
const SEED_USERS = [
  { name: 'K.V. Madushan Wijeywardana', email: 'admin@sallelanka.lk', password: 'AdminPass123!', role: 'admin' },
  { name: 'Chamara Perera', email: 'manager@sallelanka.lk', password: 'ManagerPass123!', role: 'manager' },
  { name: 'Tharaka Silva', email: 'staff@sallelanka.lk', password: 'StaffPass123!', role: 'staff' }
];

async function seed() {
  await initializeUserTable();

  for (const seedUser of SEED_USERS) {
    const existing = await findUserByEmail(seedUser.email);
    if (existing) {
      console.log(`Skipping ${seedUser.email} — already exists`);
      continue;
    }
    const passwordHash = await bcrypt.hash(seedUser.password, 10);
    await createUser({ ...seedUser, passwordHash });
    console.log(`Created ${seedUser.role}: ${seedUser.email}`);
  }

  await db.end();
}

seed().catch((error) => {
  console.error('Seeding failed:', error.message);
  process.exit(1);
});
