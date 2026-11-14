// Team Chat · Supabase Edge Function "teamchat" · โดย ลุงพี
// deploy:  npx supabase functions deploy teamchat --no-verify-jwt   (ตรวจสิทธิ์เองในโค้ด: Telegram initData หรือรหัสทีม)
//
// เส้นทาง
//   POST /op/<ชื่อ>    คำสั่งเขียนทั้งหมด (กติกาเดียวกับโหมดตัวอย่างใน web/app.js)
//        hello · send · edit · delete · pin · card · room_create · room_update · room_delete
//        folder_create · use_folder · member_role · setting
//   POST /upload       อัปไฟล์ขึ้นโฟลเดอร์ Drive ของห้อง (multipart: file, channel_id)
//   GET  /file?id=     ส่งไฟล์จาก Drive กลับมาแสดง (เฉพาะไฟล์ที่อยู่ในแชท)
//   POST /tg-webhook   รับข้อความจากกลุ่ม Telegram เข้าห้องแชท (setWebhook + secret_token)
//
// secrets (npx supabase secrets set ...):
//   TELEGRAM_BOT_TOKEN · TELEGRAM_CHAT_ID · TELEGRAM_WEBHOOK_SECRET · TELEGRAM_APP_LINK (ไม่บังคับ)
//   TELEGRAM_CHANNEL (ห้องที่รับข้อความจากกลุ่ม ค่าเริ่ม general) · ALLOWED_TG_IDS (ไม่บังคับ คั่นด้วย ,)
//   ADMIN_IDS (ผู้ดูแลเริ่มต้น เช่น tg:123456789 คั่นด้วย ,) · TEAM_PIN (เปิดจากเบราว์เซอร์ — ไม่ตั้ง = ปิดทางนี้)
//   GOOGLE_CLIENT_ID · GOOGLE_CLIENT_SECRET · GOOGLE_REFRESH_TOKEN · DRIVE_FOLDER_ID (โฟลเดอร์หลักใน Drive บริษัท)
//   MAX_UPLOAD_MB (ค่าเริ่ม 20)
import { createClient } from 'npm:@supabase/supabase-js@2.49.4';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const db = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const BOT = env('TELEGRAM_BOT_TOKEN');
const MAX_MB = Number(env('MAX_UPLOAD_MB', '20'));
const KINDS = ['text', 'file', 'report', 'approval', 'checklist', 'workorder', 'appointment'];
const KIND_LABEL: Record<string, string> = { report: '🏗️ รายงานหน้างาน', approval: '✅ ขออนุมัติ', checklist: '☑️ เช็กลิสต์', workorder: '🛠️ ใบงาน', appointment: '📅 นัดหมาย', file: '📎' };

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'content-type, x-tg-init-data, x-team-pin, x-team-name, authorization, apikey',
  'access-control-allow-methods': 'GET, POST, OPTIONS',
};
const json = (b: unknown, status = 200) => new Response(JSON.stringify(b), { status, headers: { ...CORS, 'content-type': 'application/json; charset=utf-8' } });
class Fail extends Error { constructor(msg: string, public status = 400) { super(msg); } }
const need = (c: unknown, msg: string, status = 400) => { if (!c) throw new Fail(msg, status); };
const q = async <T>(p: PromiseLike<{ data: T; error: { message: string } | null }>) => { const r = await p; if (r.error) throw new Fail(r.error.message, 500); return r.data; };
const now = () => new Date().toISOString();

// ───────── ตรวจตัวตน ─────────
const enc = new TextEncoder();
async function hmac(key: Uint8Array, msg: string) {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
const hex = (b: Uint8Array) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

type User = { id: string; name: string };
async function whoAmI(req: Request): Promise<User | null> {
  const init = req.headers.get('x-tg-init-data');
  if (init && BOT) {
    // https://core.telegram.org/bots/webapps#validating-data-received-via-the-mini-app
    const p = new URLSearchParams(init);
    const hash = p.get('hash'); p.delete('hash');
    const check = [...p.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('\n');
    const secret = await hmac(enc.encode('WebAppData'), BOT);
    if (!hash || hex(await hmac(secret, check)) !== hash) return null;
    if (Date.now() / 1000 - Number(p.get('auth_date') || 0) > 86400) return null;
    const u = JSON.parse(p.get('user') || '{}');
    const allow = env('ALLOWED_TG_IDS').split(',').map((s) => s.trim()).filter(Boolean);
    if (allow.length && !allow.includes(String(u.id))) return null;
    return { id: 'tg:' + u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Telegram' };
  }
  const pin = env('TEAM_PIN');
  if (pin && req.headers.get('x-team-pin') === pin) {
    const name = decodeURIComponent(req.headers.get('x-team-name') || '').trim().slice(0, 40);
    if (name) return { id: 'web:' + name, name };
  }
  return null;
}

// ───────── กติกาสิทธิ์ (ชุดเดียวกับ web/app.js makeRules) ─────────
type Member = { user_id: string; name: string; role: string; approver: boolean };
async function member(id: string): Promise<Member> {
  const r = await q(db.from('tc_members').select('*').eq('user_id', id).maybeSingle());
  return (r as Member) || { user_id: id, name: '', role: 'member', approver: false };
}
async function rulesFor(u: User) {
  const m = await member(u.id);
  const isAdmin = m.role === 'admin';
  return {
    isAdmin,
    canEditRoom: (ch: any) => isAdmin || ch.created_by === u.id,
    async canApprove() {
      const s = await q(db.from('tc_settings').select('value').eq('key', 'approve_policy').maybeSingle()) as any;
      const p = s?.value || 'admin';
      return p === 'all' || isAdmin || (p === 'approvers' && !!m.approver);
    },
    canEditMsg: (x: any) => x.author_id === u.id && x.kind === 'text' && !x.deleted_at,
    canDeleteMsg: (x: any) => !x.deleted_at && (x.author_id === u.id || isAdmin),
    canSetStatus: (x: any) => isAdmin || x.author_id === u.id || (x.data?.assignee || '') === u.name,
  };
}

// ───────── Google Drive (OAuth refresh token ของบัญชีบริษัทที่เป็นเจ้าของโฟลเดอร์หลัก) ─────────
let gTok = { v: '', exp: 0 };
async function googleToken() {
  if (gTok.v && Date.now() < gTok.exp - 60e3) return gTok.v;
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    body: new URLSearchParams({ client_id: env('GOOGLE_CLIENT_ID'), client_secret: env('GOOGLE_CLIENT_SECRET'), refresh_token: env('GOOGLE_REFRESH_TOKEN'), grant_type: 'refresh_token' }),
  });
  const j = await r.json();
  if (!r.ok) throw new Fail('Google token: ' + (j.error_description || j.error), 502);
  gTok = { v: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return gTok.v;
}
async function driveCreateFolder(name: string) {
  const r = await fetch('https://www.googleapis.com/drive/v3/files?supportsAllDrives=true&fields=id,name,webViewLink', {
    method: 'POST', headers: { authorization: 'Bearer ' + (await googleToken()), 'content-type': 'application/json' },
    body: JSON.stringify({ name, mimeType: 'application/vnd.google-apps.folder', parents: env('DRIVE_FOLDER_ID') ? [env('DRIVE_FOLDER_ID')] : undefined }),
  });
  const j = await r.json();
  if (!r.ok) throw new Fail('Drive: ' + (j.error?.message || r.status), 502);
  return j as { id: string; name: string; webViewLink: string };
}
async function driveUpload(blob: Blob, name: string, mime: string, parent?: string | null) {
  const boundary = 'tc' + crypto.randomUUID();
  const meta = { name, parents: [parent || env('DRIVE_FOLDER_ID')].filter(Boolean) };
  const body = new Blob([
    `--${boundary}\r\ncontent-type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(meta)}\r\n`,
    `--${boundary}\r\ncontent-type: ${mime || 'application/octet-stream'}\r\n\r\n`, blob, `\r\n--${boundary}--`,
  ]);
  const r = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&supportsAllDrives=true&fields=id,name,mimeType,size,webViewLink', {
    method: 'POST', headers: { authorization: 'Bearer ' + (await googleToken()), 'content-type': `multipart/related; boundary=${boundary}` }, body,
  });
  const j = await r.json();
  if (!r.ok) throw new Fail('Drive: ' + (j.error?.message || r.status), 502);
  return { drive_id: j.id, name: j.name, mime: j.mimeType, size: Number(j.size || blob.size), web_link: j.webViewLink };
}
function fileIdsOf(data: unknown): string[] {
  const out: string[] = [];
  const walk = (v: any) => { if (!v || typeof v !== 'object') return; if (typeof v.drive_id === 'string') out.push(v.drive_id); Object.values(v).forEach(walk); };
  walk(data);
  return out;
}

// ───────── Telegram ─────────
async function tg(method: string, body: unknown) {
  if (!BOT) return null;
  const r = await fetch(`https://api.telegram.org/bot${BOT}/${method}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  return r.json();
}
const htmlEsc = (s: string) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]!));
async function notify(m: any) {
  const chat = env('TELEGRAM_CHAT_ID');
  if (!chat || m.source === 'telegram') return;
  const ch = await q(db.from('tc_channels').select('name,icon,notify').eq('id', m.channel_id).maybeSingle()) as any;
  if (!ch || ch.notify === false) return; // ห้องที่ปิดแจ้ง Telegram
  const d = m.data || {};
  const what = m.kind === 'text' ? m.body : `${KIND_LABEL[m.kind] || ''} ${d.title || d.site || d.name || ''}`;
  const text = `<b>${htmlEsc(m.author_name)}</b> · ${htmlEsc(ch.icon)} ${htmlEsc(ch.name)}\n${htmlEsc(what).slice(0, 3500)}`;
  const link = env('TELEGRAM_APP_LINK');
  await tg('sendMessage', { chat_id: chat, text, parse_mode: 'HTML', ...(link ? { reply_markup: { inline_keyboard: [[{ text: 'เปิด Team Chat', url: link }]] } } : {}) });
}

async function fromTelegram(update: any) {
  const msg = update.message;
  if (!msg || String(msg.chat?.id) !== env('TELEGRAM_CHAT_ID')) return;
  const u = msg.from || {};
  const chId = env('TELEGRAM_CHANNEL', 'general');
  const row: any = {
    channel_id: chId, author_id: 'tg:' + u.id,
    author_name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Telegram',
    kind: 'text', body: msg.text || msg.caption || '', data: {}, source: 'telegram',
  };
  const f = msg.document || (msg.photo && msg.photo.at(-1));
  if (f) {
    const info = await tg('getFile', { file_id: f.file_id }); // บอทดาวน์โหลดได้ ≤20MB
    if (info?.ok) {
      const bin = await fetch(`https://api.telegram.org/file/bot${BOT}/${info.result.file_path}`).then((r) => r.blob());
      const ch = await q(db.from('tc_channels').select('drive_folder_id').eq('id', chId).maybeSingle()) as any;
      row.kind = 'file';
      row.data = await driveUpload(bin, msg.document?.file_name || `telegram_${msg.message_id}.jpg`, msg.document?.mime_type || 'image/jpeg', ch?.drive_folder_id);
      row.file_ids = fileIdsOf(row.data);
    }
  }
  if (row.body || row.kind === 'file') await db.from('tc_messages').insert(row);
}

// ───────── คำสั่งเขียน ─────────
const room = async (id: string) => { const c = await q(db.from('tc_channels').select('*').eq('id', id).is('deleted_at', null).maybeSingle()); need(c, 'ไม่พบห้อง', 404); return c as any; };
const msgById = async (id: number) => { const m = await q(db.from('tc_messages').select('*').eq('id', id).maybeSingle()); need(m, 'ไม่พบข้อความ', 404); return m as any; };
const updMsg = async (id: number, patch: any) => q(db.from('tc_messages').update(patch).eq('id', id).select().single());

const OPS: Record<string, (u: User, b: any) => Promise<unknown>> = {
  async hello(u) {
    const old = await q(db.from('tc_members').select('*').eq('user_id', u.id).maybeSingle()) as any;
    const admins = env('ADMIN_IDS').split(',').map((s) => s.trim()).filter(Boolean);
    const role = admins.includes(u.id) ? 'admin' : old?.role || 'member';
    return q(db.from('tc_members').upsert({ user_id: u.id, name: u.name, role, approver: old?.approver ?? false, last_seen: now() }).select().single());
  },
  async send(u, b) {
    await room(b.channel_id);
    need(KINDS.includes(b.kind), 'ชนิดข้อความไม่ถูกต้อง');
    need(b.kind !== 'text' || String(b.body || '').trim(), 'ข้อความว่าง');
    const row = { channel_id: b.channel_id, author_id: u.id, author_name: u.name, kind: b.kind, body: String(b.body || '').slice(0, 8000), data: b.data || {}, file_ids: fileIdsOf(b.data), reply_to: b.reply_to || null, source: 'app' };
    const m = await q(db.from('tc_messages').insert(row).select().single());
    notify(m).catch((e) => console.error('notify', e));
    return m;
  },
  async edit(u, { id, body }) {
    const m = await msgById(id); const R = await rulesFor(u);
    need(R.canEditMsg(m), 'แก้ได้เฉพาะข้อความตัวอักษรของตัวเอง', 403); need(String(body || '').trim(), 'ข้อความว่าง');
    return updMsg(id, { body: String(body).slice(0, 8000), edited_at: now() });
  },
  async delete(u, { id }) {
    const m = await msgById(id); const R = await rulesFor(u);
    need(R.canDeleteMsg(m), 'ลบได้เฉพาะข้อความของตัวเอง (ผู้ดูแลลบได้ทุกข้อความ)', 403);
    return updMsg(id, { deleted_at: now(), deleted_by: u.name, body: '', data: {}, file_ids: [], pinned: false });
  },
  async pin(u, { id, pinned }) {
    const m = await msgById(id); need(!m.deleted_at, 'ข้อความถูกลบแล้ว');
    return updMsg(id, { pinned: !!pinned, pinned_by: pinned ? u.name : null });
  },
  async card(u, { id, action, value }) {
    const m = await msgById(id); need(!m.deleted_at, 'ข้อความถูกลบแล้ว');
    const R = await rulesFor(u); const d = { ...m.data };
    if (action === 'approve') {
      need(m.kind === 'approval', 'ไม่ใช่การ์ดขออนุมัติ'); need(await R.canApprove(), 'คุณไม่มีสิทธิ์อนุมัติ', 403);
      need(d.status === 'pending', 'การ์ดนี้ตัดสินแล้ว'); need(['approved', 'rejected'].includes(value), 'สถานะไม่ถูกต้อง');
      Object.assign(d, { status: value, by: u.name, at: now() });
      tg('sendMessage', { chat_id: env('TELEGRAM_CHAT_ID'), text: `${value === 'approved' ? '✔ อนุมัติ' : '✖ ไม่อนุมัติ'}: ${d.title} (โดย ${u.name})` }).catch(() => {});
    } else if (action === 'check') {
      need(m.kind === 'checklist', 'ไม่ใช่เช็กลิสต์'); d.items = (d.items || []).map((x: any) => ({ ...x }));
      const it = d.items[value]; need(it, 'ไม่พบรายการ');
      it.done = !it.done; it.by = it.done ? u.name : null; it.at = it.done ? now() : null;
    } else if (action === 'status') {
      need(m.kind === 'workorder', 'ไม่ใช่ใบงาน'); need(R.canSetStatus(m), 'เปลี่ยนสถานะได้เฉพาะผู้สร้าง ช่างที่รับงาน หรือผู้ดูแล', 403);
      need(['open', 'doing', 'done'].includes(value), 'สถานะไม่ถูกต้อง');
      Object.assign(d, { status: value, status_by: u.name, status_at: now() });
    } else if (action === 'rsvp') {
      need(m.kind === 'appointment', 'ไม่ใช่นัดหมาย');
      const s = new Set<string>(d.going || []); s.has(u.name) ? s.delete(u.name) : s.add(u.name); d.going = [...s];
    } else throw new Fail('คำสั่งไม่ถูกต้อง');
    return updMsg(id, { data: d });
  },
  async room_create(u, { name, icon, notify }) {
    need(String(name || '').trim(), 'ใส่ชื่อห้อง');
    const { count } = await db.from('tc_channels').select('id', { count: 'exact', head: true });
    return q(db.from('tc_channels').insert({ id: 'r' + crypto.randomUUID().slice(0, 8), name: String(name).trim().slice(0, 60), icon: icon || '💬', notify: notify !== false, created_by: u.id, created_by_name: u.name, sort: (count || 0) + 1 }).select().single());
  },
  async room_update(u, { id, name, icon, notify }) {
    const c = await room(id); const R = await rulesFor(u);
    need(R.canEditRoom(c), 'แก้ไขห้องได้เฉพาะผู้สร้างห้องหรือผู้ดูแล', 403);
    const patch: any = {};
    if (name !== undefined) { need(String(name).trim(), 'ใส่ชื่อห้อง'); patch.name = String(name).trim().slice(0, 60); }
    if (icon !== undefined) patch.icon = icon;
    if (notify !== undefined) patch.notify = !!notify;
    return q(db.from('tc_channels').update(patch).eq('id', id).select().single());
  },
  async room_delete(u, { id }) {
    need(id !== 'general', 'ห้อง "ทั่วไป" ลบไม่ได้');
    const c = await room(id); const R = await rulesFor(u);
    need(R.canEditRoom(c), 'ลบห้องได้เฉพาะผู้สร้างห้องหรือผู้ดูแล', 403);
    return q(db.from('tc_channels').update({ deleted_at: now() }).eq('id', id).select().single()); // ไฟล์ใน Drive ไม่ถูกลบ
  },
  async folder_create(u, { channel_id, job }) {
    await room(channel_id); need(String(job || '').trim(), 'ใส่ชื่องาน');
    const name = `${String(job).trim().slice(0, 80)} - ${u.name}`;
    const f = await driveCreateFolder(name);
    const row = await q(db.from('tc_folders').insert({ channel_id, name, drive_id: f.id, web_link: f.webViewLink, created_by: u.id, created_by_name: u.name }).select().single());
    await db.from('tc_channels').update({ drive_folder_id: f.id }).eq('id', channel_id);
    return row;
  },
  async use_folder(_u, { channel_id, drive_id }) {
    await room(channel_id);
    const f = await q(db.from('tc_folders').select('id').eq('drive_id', drive_id).eq('channel_id', channel_id).maybeSingle());
    need(f, 'ไม่พบโฟลเดอร์', 404);
    return q(db.from('tc_channels').update({ drive_folder_id: drive_id }).eq('id', channel_id).select().single());
  },
  async member_role(u, { user_id, role, approver }) {
    const R = await rulesFor(u); need(R.isAdmin, 'เฉพาะผู้ดูแลเท่านั้น', 403);
    const m = await member(user_id); need(m.name, 'ไม่พบสมาชิก', 404);
    const patch: any = {};
    if (role) {
      need(['admin', 'member'].includes(role), 'บทบาทไม่ถูกต้อง');
      if (role !== 'admin' && m.role === 'admin') {
        const { count } = await db.from('tc_members').select('user_id', { count: 'exact', head: true }).eq('role', 'admin');
        need((count || 0) > 1, 'ต้องมีผู้ดูแลอย่างน้อย 1 คน');
      }
      patch.role = role;
    }
    if (approver !== undefined) patch.approver = !!approver;
    return q(db.from('tc_members').update(patch).eq('user_id', user_id).select().single());
  },
  async setting(u, { key, value }) {
    const R = await rulesFor(u); need(R.isAdmin, 'เฉพาะผู้ดูแลเท่านั้น', 403);
    need(key === 'approve_policy' && ['admin', 'approvers', 'all'].includes(value), 'ค่าตั้งไม่ถูกต้อง');
    return q(db.from('tc_settings').upsert({ key, value }).select().single());
  },
  // แชร์โฟลเดอร์หลัก Team Chat ให้ทีม (โฟลเดอร์ย่อย/ไฟล์ข้างในได้สิทธิ์ตามโดยอัตโนมัติ)
  // DRIVE_SHARE = "proinventive.co.th,someone@gmail.com" (ไม่มี @ = ทั้งโดเมน) · ค่าเริ่ม proinventive.co.th
  async drive_share(u) {
    const R = await rulesFor(u); need(R.isAdmin, 'เฉพาะผู้ดูแลเท่านั้น', 403);
    const id = env('DRIVE_FOLDER_ID'); need(id, 'ยังไม่ได้ตั้ง DRIVE_FOLDER_ID');
    const H = { authorization: 'Bearer ' + (await googleToken()), 'content-type': 'application/json' };
    const info = await (await fetch(`https://www.googleapis.com/drive/v3/files/${id}?supportsAllDrives=true&fields=name,webViewLink,owners(emailAddress)`, { headers: H })).json();
    const results: { target: string; ok: boolean; error?: string }[] = [];
    for (const t of env('DRIVE_SHARE', 'proinventive.co.th').split(',').map((s) => s.trim()).filter(Boolean)) {
      const body = t.includes('@') ? { type: 'user', role: 'writer', emailAddress: t } : { type: 'domain', role: 'writer', domain: t };
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}/permissions?supportsAllDrives=true&sendNotificationEmail=false`, { method: 'POST', headers: H, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      results.push({ target: t, ok: r.ok, error: r.ok ? undefined : j.error?.message });
    }
    return { owner: info.owners?.[0]?.emailAddress || '(ไม่ทราบ)', link: info.webViewLink, results };
  },
};

// ───────── router ─────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/teamchat/, '') || '/';
  try {
    if (path === '/tg-webhook') {
      need(env('TELEGRAM_WEBHOOK_SECRET') && req.headers.get('x-telegram-bot-api-secret-token') === env('TELEGRAM_WEBHOOK_SECRET'), 'forbidden', 403);
      await fromTelegram(await req.json());
      return json({ ok: true });
    }

    if (path === '/file' && req.method === 'GET') {
      const id = url.searchParams.get('id') || '';
      need(/^[\w-]{10,}$/.test(id), 'bad id');
      const hit = await q(db.from('tc_messages').select('id').contains('file_ids', [id]).limit(1)) as any[];
      need(hit.length, 'not found', 404); // ดูได้เฉพาะไฟล์ที่ส่งในแชท (ข้อความที่ลบแล้ว file_ids ว่าง)
      const r = await fetch(`https://www.googleapis.com/drive/v3/files/${id}?alt=media&supportsAllDrives=true`, { headers: { authorization: 'Bearer ' + (await googleToken()) } });
      need(r.ok, 'drive ' + r.status, r.status);
      return new Response(r.body, { headers: { ...CORS, 'content-type': r.headers.get('content-type') || 'application/octet-stream', 'cache-control': 'private, max-age=86400' } });
    }

    const me = await whoAmI(req);
    need(me, 'ไม่มีสิทธิ์ — เปิดจาก Telegram หรือใส่รหัสทีมให้ถูก', 401);

    if (path === '/upload' && req.method === 'POST') {
      const fd = await req.formData();
      const f = fd.get('file');
      need(f instanceof File, 'ไม่มีไฟล์');
      need((f as File).size <= MAX_MB * 1048576, `ไฟล์ใหญ่เกิน ${MAX_MB} MB`);
      const ch = await room(String(fd.get('channel_id') || 'general'));
      return json(await driveUpload(f as File, (f as File).name, (f as File).type, ch.drive_folder_id));
    }

    const op = path.match(/^\/op\/(\w+)$/)?.[1];
    if (op && req.method === 'POST' && OPS[op]) return json(await OPS[op](me!, await req.json().catch(() => ({}))));

    return json({ error: 'not found' }, 404);
  } catch (e) {
    if (e instanceof Fail) return json({ error: e.message }, e.status);
    console.error(e);
    return json({ error: String((e as Error).message || e) }, 500);
  }
});
