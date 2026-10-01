// Admins remove a sign-up they haven't approved (rejected or still pending).
// The login is deleted along with its profile, so the person leaves the
// Users list; signing in again starts a fresh request.
//
// Called from the app with the admin's own token: {"id": <user id>}.
import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let id: unknown;
  try {
    ({ id } = await req.json());
  } catch {
    return json({ error: 'Expected JSON' }, 400);
  }
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Expected an id' }, 400);

  const url = Deno.env.get('SUPABASE_URL')!;
  // Ask as the caller, so the database decides whether they're an admin.
  const asCaller = createClient(url, Deno.env.get('SUPABASE_ANON_KEY')!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } },
  });
  const { data: isAdmin } = await asCaller.rpc('is_admin');
  if (isAdmin !== true) return json({ error: 'Only admins can remove accounts.' }, 403);

  const db = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: target, error } = await db.from('profiles').select('approval').eq('id', id).maybeSingle();
  if (error) return json({ error: 'Lookup failed' }, 500);
  if (!target) return json({ removed: false });
  if (target.approval === 'approved') {
    return json({ error: 'Revoke access first, then remove the account.' }, 400);
  }
  const { error: deleteError } = await db.auth.admin.deleteUser(id);
  if (deleteError) {
    console.error('remove-account:', deleteError.message);
    return json({ error: 'Couldn’t remove the account. Try again.' }, 500);
  }
  return json({ removed: true });
});
