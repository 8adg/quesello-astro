import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://yihizwspxnxlfowvitoe.supabase.co'
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlpaGl6d3NweG54bGZvd3ZpdG9lIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjkwNDU5MywiZXhwIjoyMDg4NDgwNTkzfQ.DFeL-VwIMCuY92_yev5xp3kVwS5g7SUsLfRfNWeH0gs'

export const supabase = createClient(supabaseUrl, supabaseKey, {
  global: {
    fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
  }
});

export const supabaseAdmin = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false
  },
  global: {
    fetch: (url, options) => fetch(url, { ...options, cache: 'no-store' })
  }
});
