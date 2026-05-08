// ============================================================
// Server-side Supabase client. Uses the secret key, which
// bypasses RLS — only ever instantiated inside the PartyKit
// runtime (never bundled to the browser).
// ============================================================

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type * as Party from 'partykit/server'

export function createServerClient(room: Party.Room): SupabaseClient {
  const url = room.env.SUPABASE_URL as string | undefined
  const secretKey = room.env.SUPABASE_SECRET_KEY as string | undefined

  if (!url || !secretKey) {
    throw new Error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in PartyKit env')
  }

  return createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
