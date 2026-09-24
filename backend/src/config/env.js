require('dotenv').config();

const { z } = require('zod');

const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  FRONTEND_URL: z.string().url().default('http://localhost:5173'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE: z.string().min(1),

  JWT_SECRET: z.string().min(32),

  CLOUDINARY_URL: z.string().optional(),

  ZALO_OA_ID: z.string().optional(),
  ZALO_ACCESS_TOKEN: z.string().optional(),

  GMAIL_USER: z.string().optional(),
  GMAIL_APP_PASSWORD: z.string().optional(),

  MESSAGE_DRY_RUN: z.coerce.boolean().default(false),

  // Secret used to protect /api/v1/cron/daily. On Vercel it doubles as the
  // bearer token Vercel Cron attaches automatically (CRON_SECRET convention).
  CRON_SECRET: z.string().min(16).optional(),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  const errors = parsed.error.issues
    .map((i) => `${i.path.join('.')}: ${i.message}`)
    .join('\n');
  throw new Error(`Environment variable validation failed:\n${errors}`);
}

const env = parsed.data;

module.exports = env;
