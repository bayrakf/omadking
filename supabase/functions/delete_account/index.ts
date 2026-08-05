/**
 * Deletes the caller's account. Nothing else.
 *
 * This is the one endpoint in the project that holds the service-role key, so
 * the shape of it matters more than the length. It takes **no parameters**.
 * The user id comes from verifying the caller's own token, never from the
 * request body — an endpoint that accepts an id is an endpoint that deletes
 * other people's accounts the first time someone tries.
 *
 * The sync_state row goes with the user through ON DELETE CASCADE, so there is
 * no second delete to forget or get wrong.
 */

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const URL_ = Deno.env.get('SUPABASE_URL') ?? '';
const ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ error: 'METHOD' }, 405);
  if (!URL_ || !ANON || !SERVICE) return json({ error: 'NOT_CONFIGURED' }, 503);

  const header = req.headers.get('Authorization') ?? '';
  const token = header.replace(/^Bearer\s+/i, '');
  if (!token) return json({ error: 'UNAUTHENTICATED' }, 401);

  // Verified with the public key, so a forged or expired token gets nothing.
  const { data, error } = await createClient(URL_, ANON).auth.getUser(token);
  if (error || !data?.user) return json({ error: 'UNAUTHENTICATED' }, 401);

  const { error: deleteError } = await createClient(URL_, SERVICE).auth.admin.deleteUser(data.user.id);
  if (deleteError) {
    console.error('delete_account failed', deleteError.message);
    return json({ error: 'FAILED' }, 500);
  }

  return json({ deleted: true });
});
