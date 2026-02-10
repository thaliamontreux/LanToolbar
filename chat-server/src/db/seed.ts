import argon2 from 'argon2';
import { env } from '../config/env.js';
import { pool } from './index.js';

async function main() {
  const passwordHash = await argon2.hash(env.ADMIN_PASSWORD);

  const res = await pool.query(
    `
    INSERT INTO users (username, display_name, password_hash, role)
    VALUES ($1, $2, $3, 'admin')
    ON CONFLICT (username)
    DO UPDATE SET display_name = EXCLUDED.display_name
    RETURNING id, username, display_name, role;
  `,
    [env.ADMIN_USERNAME, env.ADMIN_DISPLAY_NAME, passwordHash]
  );

  // eslint-disable-next-line no-console
  console.log('Seeded admin user:', res.rows[0]);
  await pool.end();
}

main().catch(async (err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  try {
    await pool.end();
  } catch {
    // ignore
  }
  process.exit(1);
});
