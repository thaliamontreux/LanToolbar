import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  DATABASE_URL: z.string().min(1),
  JWT_SECRET: z.string().min(16),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().positive().default(3000),
  ADMIN_USERNAME: z.string().min(1).default('admin'),
  ADMIN_DISPLAY_NAME: z.string().min(1).default('Admin'),
  ADMIN_PASSWORD: z.string().min(8).default('adminadmin')
});

export type Env = z.infer<typeof envSchema>;

export const env: Env = envSchema.parse(process.env);
