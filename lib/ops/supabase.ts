import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { getSupabaseConfig } from './config'
import type { Database } from './database.types'

let client: ReturnType<typeof createClient<Database>> | null = null

export function getSupabaseAdmin() {
  if (client) return client

  const env = getSupabaseConfig()

  client = createClient<Database>(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })

  return client
}
