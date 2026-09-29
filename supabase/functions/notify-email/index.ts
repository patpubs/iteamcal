// Sends one in-app notification out by push and by email (Resend, PRD §11).
//
// The database calls this with {"id": <notification id>} after each new
// notification. It takes no user token: it only ever sends a notification
// that exists and hasn't been sent yet, to that notification's owner, so a
// repeated or forged call can't send anything new.
//
// {"action": "push-key"} returns the public web push key, creating the key
// pair the first time. The private half stays in the database.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const APP_URL = Deno.env.get('APP_URL') ?? 'https://iteamcal.vercel.app';
const FROM = 'Schedule & Time Cards App <schedulerapp@jkwent.app>';

const escape = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'POST only' }, 405);
  let id: unknown;
  let action: unknown;
  try {
    ({ id, action } = await req.json());
  } catch {
    return json({ error: 'Expected JSON' }, 400);
  }

  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  if (action === 'push-key') {
    const keys = await pushKeys(db);
    return keys ? json({ publicKey: keys.public_key }) : json({ error: 'Push keys unavailable' }, 500);
  }
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return json({ error: 'Expected an id' }, 400);

  // Claim it first so two calls for the same notification send one email.
  const { data: note, error } = await db
    .from('notifications')
    .update({ emailed_at: new Date().toISOString() })
    .eq('id', id)
    .is('emailed_at', null)
    .select('id, user_id, kind, title, body, link, send_push, send_email, profiles(email, display_name)')
    .maybeSingle();
  if (error) {
    console.error('notify-email: claim failed', error.message);
    return json({ error: 'Lookup failed' }, 500);
  }
  if (!note) return json({ skipped: 'already emailed or not found' });

  // Push first: it's quick, and email trouble shouldn't hold it up. Some
  // notifications skip one or the other (the weekly review is email only).
  if (note.send_push) await sendPush(db, note).catch((e) => console.error('notify-email: push failed', e));
  if (!note.send_email) return json({ sent: 'push only' });

  const profile = note.profiles as unknown as { email: string | null; display_name: string | null } | null;
  const to = profile?.email;
  const fail = async (message: string) => {
    console.error('notify-email:', message);
    await db
      .from('notifications')
      .update({ email_error: message.slice(0, 500) })
      .eq('id', note.id);
    return json({ error: message }, 502);
  };
  if (!to) return fail('No email address on file');
  const key = Deno.env.get('RESEND_API_KEY');
  if (!key) return fail('RESEND_API_KEY is not set');

  const link = `${APP_URL}${note.link ?? '/'}`;
  const name = profile?.display_name ? `Hi ${escape(profile.display_name)},` : 'Hi,';
  const html = `
    <div style="font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 480px; color: #15201D;">
      <p>${name}</p>
      <p style="font-size: 17px; font-weight: 600; margin: 16px 0 4px;">${escape(note.title)}</p>
      ${note.body ? `<p style="margin: 0 0 20px;">${escape(note.body)}</p>` : ''}
      <p><a href="${escape(link)}" style="background: #1F6F5C; color: #fff; padding: 10px 18px; border-radius: 8px; text-decoration: none; display: inline-block;">Open iTeamCal</a></p>
      <p style="color: #5B6A66; font-size: 13px; margin-top: 24px;">You're getting this because you have an iTeamCal account.</p>
    </div>`;
  const text = `${name.replace(/&[^;]+;/g, '')}\n\n${note.title}\n${note.body ?? ''}\n\nOpen iTeamCal: ${link}`;

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [to], subject: note.title, html, text }),
  });
  if (!res.ok) return fail(`Resend ${res.status}: ${await res.text()}`);
  return json({ sent: true });
});

type PushKeys = { public_key: string; private_key: string };

/** The VAPID key pair, made once and kept in public.push_keys. */
async function pushKeys(db: SupabaseClient): Promise<PushKeys | null> {
  const { data } = await db.from('push_keys').select('public_key, private_key').maybeSingle();
  if (data) return data;
  const made = webpush.generateVAPIDKeys();
  // Two first calls at once: the second insert loses and both read the winner.
  await db.from('push_keys').insert({ public_key: made.publicKey, private_key: made.privateKey });
  const { data: saved } = await db.from('push_keys').select('public_key, private_key').maybeSingle();
  return saved;
}

/** Sends the notification to every device its owner turned push on for. */
async function sendPush(
  db: SupabaseClient,
  note: { id: string; user_id: string; kind: string; title: string; body: string | null; link: string | null },
) {
  const { data: devices } = await db
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', note.user_id);
  if (!devices?.length) return;
  const keys = await pushKeys(db);
  if (!keys) return;
  const payload = JSON.stringify({
    title: note.title,
    body: note.body ?? '',
    link: note.link ?? '/',
    // Same kind replaces the older one on the lock screen instead of stacking.
    tag: note.kind,
  });
  await Promise.all(
    devices.map(async (d) => {
      try {
        await webpush.sendNotification({ endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } }, payload, {
          vapidDetails: {
            subject: 'mailto:schedulerapp@jkwent.app',
            publicKey: keys.public_key,
            privateKey: keys.private_key,
          },
          TTL: 60 * 60 * 12,
          urgency: 'high',
        });
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // The browser dropped this sign-up (uninstalled, turned off, expired).
        if (status === 404 || status === 410) await db.from('push_subscriptions').delete().eq('id', d.id);
        else console.error('notify-email: push to device failed', status, (e as Error).message);
      }
    }),
  );
}
