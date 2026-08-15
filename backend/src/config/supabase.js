const { createClient } = require('@supabase/supabase-js');
const env = require('./env');

// Service role key bypasses RLS — only for backend / cron jobs.
const supabase = createClient(
  env.SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

module.exports = supabase;
