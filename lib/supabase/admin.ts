import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/supabase/database.types'

export class AdminConfigurationError extends Error {
  constructor() {
    super('Supabase Admin belum dikonfigurasi.')
    this.name = 'AdminConfigurationError'
  }
}

export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new AdminConfigurationError()
  }

  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
