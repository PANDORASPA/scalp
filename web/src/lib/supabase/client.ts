import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { getSupabaseServerEnv } from '@/lib/config/supabase'

export function getSupabaseAdminClient() {
  const env = getSupabaseServerEnv()

  return createClient(env.url, env.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}
