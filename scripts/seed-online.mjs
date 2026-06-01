import { config } from 'dotenv';

config({ path: '.env.local' });
config({ path: '.env' });

const baseUrl = (process.env.SEED_URL || 'https://aiptpricesystem.vercel.app').replace(/\/$/, '');
const seedSecret = process.env.SEED_SECRET;

if (!seedSecret) {
  console.error('SEED_SECRET is required to seed the online database.');
  process.exit(1);
}

const response = await fetch(`${baseUrl}/api/admin/seed`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${seedSecret}`,
  },
});

const payload = await response.json().catch(() => ({}));

if (!response.ok) {
  console.error(`Seed failed with status ${response.status}`);
  console.error(payload);
  process.exit(1);
}

console.log(payload.message || 'Seed completed successfully');
console.log(JSON.stringify(payload.data || {}, null, 2));
