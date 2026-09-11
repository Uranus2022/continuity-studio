import { createClient } from "@supabase/supabase-js";

// These values are publishable client configuration, not service-role secrets.
// Environment variables override the defaults when present.
const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ??
  "https://grlexcphmydesdzywxsu.supabase.co";

const supabasePublishableKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  "sb_publishable_LikgwqKAP7m8-2a1E9I3Eg_0t9Pt0yr";

export const supabase = createClient(supabaseUrl, supabasePublishableKey);
