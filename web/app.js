// Team Chat · Telegram Mini App + Supabase + Google Drive · โดย ลุงพี
// config.js ว่าง = "โหมดตัวอย่าง" (เก็บในเครื่อง · เปิด 2 แท็บคุยกันได้) · ใส่ค่า Supabase = ใช้งานจริง
// การเขียนทุกอย่างผ่าน api.op(ชื่อ, ข้อมูล) — โหมดตัวอย่างทำในเครื่อง · ของจริงส่งไป Edge Function /op/<ชื่อ> (กติกาเดียวกัน)
(() => {
  'use strict';
  const VERSION = '0.1.0';
  const CFG = window.TC_CONFIG || {};
  const TG = window.Telegram && Telegram.WebApp && Telegram.WebApp.initData ? Telegram.WebApp : null;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const ICONS = ['💬', '🏗️', '☀️', '🔌', '🏭', '🏠', '🏫', '📋', '🚚', '🛠️', '💡', '⚡'];
  const KIND_LABEL = { report: '🏗️ รายงานหน้างาน', approval: '✅ ขออนุมัติ', checklist: '☑️ เช็กลิสต์', workorder: '🛠️ ใบงาน', appointment: '📅 นัดหมาย', file: '📎 ไฟล์' };
  const nowIso = () => new Date().toISOString();
  const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60e3).toISOString().slice(0, 10); };

  // ───────────── กติกาสิทธิ์ (ชุดเดียวกับ Edge Function) ─────────────
  function makeRules(getMembers, getSettings) {
    const mem = (id) => getMembers().find((m) => m.user_id === id) || { role: 'member' };
    const R = {
      isAdmin: (u) => mem(u.id).role === 'admin',
      canEditRoom: (u, ch) => R.isAdmin(u) || ch.created_by === u.id,
      canApprove(u) {
        const p = getSettings().approve_policy || 'admin';
        return p === 'all' || R.isAdmin(u) || (p === 'approvers' && !!mem(u.id).approver);
      },
      canEditMsg: (u, m) => m.author_id === u.id && m.kind === 'text' && !m.deleted_at,
      canDeleteMsg: (u, m) => !m.deleted_at && (m.author_id === u.id || R.isAdmin(u)),
      canSetStatus: (u, m) => R.isAdmin(u) || m.author_id === u.id || (m.data?.assignee || '') === u.name,
    };
    return R;
  }
  // ข้อความที่ใช้ค้นหา (ไม่รวมข้อมูลรูป/ไอดีไฟล์)
  function textParts(m) {
    const out = [m.body || ''];
    const walk = (v, k) => {
      if (v == null || ['local_url', 'drive_id', 'web_link', 'mime', 'at', 'status_at', 'size'].includes(k)) return;
      if (typeof v === 'object') Object.entries(v).forEach(([kk, vv]) => walk(vv, kk)); else out.push(String(v));
    };
    walk(m.data);
    return out.filter(Boolean);
  }
  const textOf = (m) => textParts(m).join(' ').toLowerCase();

  // ───────────── ผู้ใช้ ─────────────
  let me = null; // {id, name, pin?, role?}
  function loadMe() {
    if (TG && TG.initDataUnsafe && TG.initDataUnsafe.user) {
      const u = TG.initDataUnsafe.user;
      return { id: 'tg:' + u.id, name: [u.first_name, u.last_name].filter(Boolean).join(' ') || u.username || 'Telegram' };
    }
    // ชื่อผูกกับแท็บ (sessionStorage) ก่อน → เปิด 2 แท็บเป็น 2 คนได้ · สำรองไว้ใน localStorage
    try { const s = sessionStorage.getItem('tc_me'); if (s) return JSON.parse(s); } catch {}
    return store.get('tc_me', null);
  }
  function saveMe(v) {
    try { v ? sessionStorage.setItem('tc_me', JSON.stringify(v)) : sessionStorage.removeItem('tc_me'); } catch {}
    store.set('tc_me', v);
  }

  // ───────────── Backend: โหมดตัวอย่าง (ทำตามกติกาเดียวกับเซิร์ฟเวอร์) ─────────────
  function DemoBackend() {
    const KEY = 'tc_demo2';
    const bc = 'BroadcastChannel' in window ? new BroadcastChannel('tc_demo2') : null;
    let listener = null;
    let db = store.get(KEY, null) || seed();
    const rules = makeRules(() => db.members, () => db.settings);

    function seed() {
      const t = Date.now() - 3 * 3600e3;
      const at = (min) => new Date(t + min * 60e3).toISOString();
      const boss = 'web:หัวหน้าช่าง', oat = 'tg:1';
      const msg = (id, ch, author, name, kind, body, data, min, extra = {}) => ({ id, channel_id: ch, author_id: author, author_name: name, kind, body, data, reply_to: null, pinned: false, source: 'app', created_at: at(min), edited_at: null, deleted_at: null, ...extra });
      const d = {
        seq: 100,
        settings: { approve_policy: 'admin' },
        members: [
          { user_id: boss, name: 'หัวหน้าช่าง', role: 'admin', approver: true },
          { user_id: oat, name: 'น้องโอ๊ต', role: 'member', approver: false },
        ],
        channels: [
          { id: 'general', name: 'ทั่วไป', icon: '💬', notify: true, created_by: boss, created_by_name: 'หัวหน้าช่าง', drive_folder_id: null, sort: 1, created_at: at(0), deleted_at: null },
          { id: 'r1', name: 'ไซต์ A – หลังคาโกดัง', icon: '🏗️', notify: true, created_by: boss, created_by_name: 'หัวหน้าช่าง', drive_folder_id: 'demo-folder-1', sort: 2, created_at: at(1), deleted_at: null },
          { id: 'r2', name: 'ไซต์ B – โรงเรียน', icon: '🏫', notify: true, created_by: oat, created_by_name: 'น้องโอ๊ต', drive_folder_id: null, sort: 3, created_at: at(2), deleted_at: null },
        ],
        folders: [
          { id: 'f1', channel_id: 'r1', name: 'ติดตั้งโซลาร์ หลังคาโกดัง - หัวหน้าช่าง', drive_id: 'demo-folder-1', web_link: null, created_by: boss, created_by_name: 'หัวหน้าช่าง', created_at: at(1) },
        ],
        messages: [
          msg(1, 'general', boss, 'หัวหน้าช่าง', 'text', 'สวัสดีทีม 👋 นี่คือตัวอย่าง Team Chat\nลองสร้างห้อง แนบรูป กด ➕ ส่งการ์ด หรือชี้ที่ข้อความเพื่อตอบกลับ/แก้/ลบ/ปักหมุด', {}, 3, { pinned: true, pinned_by: 'หัวหน้าช่าง' }),
          msg(2, 'general', oat, 'น้องโอ๊ต', 'text', 'รับทราบครับ (ข้อความนี้ส่งมาจากกลุ่ม Telegram)', {}, 4, { source: 'telegram', reply_to: 1 }),
          msg(3, 'r1', boss, 'หัวหน้าช่าง', 'report', '', { date: today(), tech: 'น้องโอ๊ต, พี่เอก', site: 'ไซต์ A – หลังคาโกดัง', pct: 65, note: 'ติดตั้งราง + แผงแถว 1–4 เสร็จ เหลือเดินสาย DC', photos: [] }, 10),
          msg(4, 'r1', oat, 'น้องโอ๊ต', 'approval', '', { title: 'ขอเบิกสาย PV 4 mm² 2 ม้วน', detail: 'ใช้เดินสาย string 3–4', status: 'pending' }, 12),
          msg(5, 'r1', boss, 'หัวหน้าช่าง', 'checklist', '', { title: 'ตรวจก่อนจ่ายไฟ', items: [
            { t: 'วัด Voc ทุก string', done: true, by: 'น้องโอ๊ต', at: at(20) }, { t: 'ขันแน่นขั้วต่อ MC4', done: false }, { t: 'ติดป้ายเตือนตู้ DC', done: false }] }, 14),
          msg(6, 'r1', boss, 'หัวหน้าช่าง', 'workorder', '', { title: 'เดินสาย DC string 3–4', assignee: 'น้องโอ๊ต', location: 'หลังคาโกดัง ฝั่งทิศใต้', due: today(), detail: 'ใช้สาย 4 mm² · ร้อยท่อ HDPE', status: 'doing', status_by: 'น้องโอ๊ต' }, 16),
          msg(7, 'r2', oat, 'น้องโอ๊ต', 'appointment', '', { title: 'สำรวจหลังคา', date: today(), time: '14:00', place: 'อาคาร 2 โรงเรียน', attendees: 'น้องโอ๊ต, หัวหน้าช่าง', going: ['น้องโอ๊ต'] }, 18),
        ],
      };
      store.set(KEY, d);
      return d;
    }
    function save() {
      try { localStorage.setItem(KEY, JSON.stringify(db)); }
      catch { throw new Error('พื้นที่โหมดตัวอย่างเต็ม (~5MB) — ไปที่ ⚙️ แล้วกดล้างข้อมูลตัวอย่าง'); }
    }
    function emit(table, type, row) { listener && listener(table, type, row); bc && bc.postMessage({ table, type, row }); }
    if (bc) bc.onmessage = (e) => { db = store.get(KEY, db); listener && listener(e.data.table, e.data.type, e.data.row); };
    const need = (c, m) => { if (!c) throw new Error(m); };
    const put = (table, row, type = 'UPDATE') => { save(); emit(table, type, row); return row; };
    const msgById = (id) => { const m = db.messages.find((x) => x.id === id); need(m, 'ไม่พบข้อความ'); return m; };
    const roomById = (id) => { const c = db.channels.find((x) => x.id === id && !x.deleted_at); need(c, 'ไม่พบห้อง'); return c; };

    const ops = {
      hello(u, { role }) {
        let m = db.members.find((x) => x.user_id === u.id);
        if (!m) { m = { user_id: u.id, name: u.name, role: role || 'member', approver: false }; db.members.push(m); return put('tc_members', m, 'INSERT'); }
        m.name = u.name; if (role) m.role = role;
        return put('tc_members', m);
      },
      send(u, b) {
        roomById(b.channel_id);
        need(['text', 'file', 'report', 'approval', 'checklist', 'workorder', 'appointment'].includes(b.kind), 'ชนิดข้อความไม่ถูกต้อง');
        need(b.kind !== 'text' || String(b.body || '').trim(), 'ข้อความว่าง');
        const row = { id: ++db.seq, channel_id: b.channel_id, author_id: u.id, author_name: u.name, kind: b.kind, body: b.body || '', data: b.data || {}, reply_to: b.reply_to || null, pinned: false, source: 'app', created_at: nowIso(), edited_at: null, deleted_at: null };
        db.messages.push(row);
        return put('tc_messages', row, 'INSERT');
      },
      edit(u, { id, body }) {
        const m = msgById(id); need(rules.canEditMsg(u, m), 'แก้ได้เฉพาะข้อความตัวอักษรของตัวเอง'); need(String(body || '').trim(), 'ข้อความว่าง');
        m.body = body; m.edited_at = nowIso(); return put('tc_messages', m);
      },
      delete(u, { id }) {
        const m = msgById(id); need(rules.canDeleteMsg(u, m), 'ลบได้เฉพาะข้อความของตัวเอง (ผู้ดูแลลบได้ทุกข้อความ)');
        Object.assign(m, { deleted_at: nowIso(), deleted_by: u.name, body: '', data: {}, pinned: false }); return put('tc_messages', m);
      },
      pin(u, { id, pinned }) {
        const m = msgById(id); need(!m.deleted_at, 'ข้อความถูกลบแล้ว');
        m.pinned = !!pinned; m.pinned_by = pinned ? u.name : null; return put('tc_messages', m);
      },
      card(u, { id, action, value }) {
        const m = msgById(id); need(!m.deleted_at, 'ข้อความถูกลบแล้ว');
        const d = (m.data = { ...m.data });
        if (action === 'approve') {
          need(m.kind === 'approval', 'ไม่ใช่การ์ดขออนุมัติ'); need(rules.canApprove(u), 'คุณไม่มีสิทธิ์อนุมัติ (ผู้ดูแลตั้งได้ที่ ⚙️ สิทธิ์)');
          need(d.status === 'pending', 'การ์ดนี้ตัดสินแล้ว'); need(['approved', 'rejected'].includes(value), 'สถานะไม่ถูกต้อง');
          Object.assign(d, { status: value, by: u.name, at: nowIso() });
        } else if (action === 'check') {
          need(m.kind === 'checklist', 'ไม่ใช่เช็กลิสต์'); d.items = (d.items || []).map((x) => ({ ...x }));
          const it = d.items[value]; need(it, 'ไม่พบรายการ');
          it.done = !it.done; it.by = it.done ? u.name : null; it.at = it.done ? nowIso() : null;
        } else if (action === 'status') {
          need(m.kind === 'workorder', 'ไม่ใช่ใบงาน'); need(rules.canSetStatus(u, m), 'เปลี่ยนสถานะได้เฉพาะผู้สร้าง ช่างที่รับงาน หรือผู้ดูแล');
          need(['open', 'doing', 'done'].includes(value), 'สถานะไม่ถูกต้อง');
          Object.assign(d, { status: value, status_by: u.name, status_at: nowIso() });
        } else if (action === 'rsvp') {
          need(m.kind === 'appointment', 'ไม่ใช่นัดหมาย');
          const s = new Set(d.going || []); s.has(u.name) ? s.delete(u.name) : s.add(u.name); d.going = [...s];
        } else throw new Error('คำสั่งไม่ถูกต้อง');
        return put('tc_messages', m);
      },
      room_create(u, { name, icon, notify }) {
        need(String(name || '').trim(), 'ใส่ชื่อห้อง');
        const row = { id: 'r' + ++db.seq, name: name.trim(), icon: icon || '💬', notify: notify !== false, created_by: u.id, created_by_name: u.name, drive_folder_id: null, sort: db.channels.length + 1, created_at: nowIso(), deleted_at: null };
        db.channels.push(row); return put('tc_channels', row, 'INSERT');
      },
      room_update(u, { id, ...p }) {
        const c = roomById(id); need(rules.canEditRoom(u, c), 'แก้ไขห้องได้เฉพาะผู้สร้างห้องหรือผู้ดูแล');
        for (const k of ['name', 'icon', 'notify']) if (k in p) c[k] = p[k];
        need(String(c.name).trim(), 'ใส่ชื่อห้อง'); return put('tc_channels', c);
      },
      room_delete(u, { id }) {
        const c = roomById(id); need(id !== 'general', 'ห้อง "ทั่วไป" ลบไม่ได้'); need(rules.canEditRoom(u, c), 'ลบห้องได้เฉพาะผู้สร้างห้องหรือผู้ดูแล');
        c.deleted_at = nowIso(); return put('tc_channels', c);
      },
      folder_create(u, { channel_id, job }) {
        const c = roomById(channel_id); need(String(job || '').trim(), 'ใส่ชื่องาน');
        const f = { id: 'f' + ++db.seq, channel_id, name: `${job.trim()} - ${u.name}`, drive_id: 'demo-folder-' + db.seq, web_link: null, created_by: u.id, created_by_name: u.name, created_at: nowIso() };
        db.folders.push(f); c.drive_folder_id = f.drive_id;
        save(); emit('tc_channels', 'UPDATE', c); return put('tc_folders', f, 'INSERT');
      },
      use_folder(u, { channel_id, drive_id }) {
        const c = roomById(channel_id); need(db.folders.some((f) => f.drive_id === drive_id && f.channel_id === channel_id), 'ไม่พบโฟลเดอร์');
        c.drive_folder_id = drive_id; return put('tc_channels', c);
      },
      member_role(u, { user_id, role, approver }) {
        need(rules.isAdmin(u), 'เฉพาะผู้ดูแลเท่านั้น');
        const m = db.members.find((x) => x.user_id === user_id); need(m, 'ไม่พบสมาชิก');
        if (role) {
          need(['admin', 'member'].includes(role), 'บทบาทไม่ถูกต้อง');
          need(role === 'admin' || m.role !== 'admin' || db.members.filter((x) => x.role === 'admin').length > 1, 'ต้องมีผู้ดูแลอย่างน้อย 1 คน');
          m.role = role;
        }
        if (approver !== undefined) m.approver = !!approver;
        return put('tc_members', m);
      },
      drive_share(u) {
        need(rules.isAdmin(u), 'เฉพาะผู้ดูแลเท่านั้น');
        return { owner: 'peerapong@proinventive.co.th (ตัวอย่าง)', link: null, results: [{ target: 'proinventive.co.th', ok: true }] };
      },
      setting(u, { key, value }) {
        need(rules.isAdmin(u), 'เฉพาะผู้ดูแลเท่านั้น');
        need(key === 'approve_policy' && ['admin', 'approvers', 'all'].includes(value), 'ค่าตั้งไม่ถูกต้อง');
        db.settings[key] = value; return put('tc_settings', { key, value });
      },
    };

    return {
      mode: 'demo',
      async load() { return { channels: db.channels.filter((c) => !c.deleted_at), folders: db.folders, members: db.members, settings: db.settings }; },
      async list(ch) { return db.messages.filter((m) => m.channel_id === ch); },
      async search(q, ch) {
        const s = q.toLowerCase();
        return db.messages.filter((m) => !m.deleted_at && (!ch || m.channel_id === ch) && db.channels.some((c) => c.id === m.channel_id && !c.deleted_at) && textOf(m).includes(s)).slice(-100);
      },
      subscribe(fn) { listener = fn; },
      async op(name, payload) { if (!ops[name]) throw new Error('ไม่รู้จักคำสั่ง ' + name); return ops[name](me, payload || {}); },
      async upload(file, onPct) { // จำลอง Google Drive: เก็บเป็น dataURL ในเครื่อง
        if (file.size > 1.5 * 1024 * 1024) throw new Error(`${file.name}: โหมดตัวอย่างแนบได้ไม่เกิน 1.5MB (ของจริงขึ้น Drive ได้ใหญ่กว่านี้)`);
        for (let p = 20; p <= 100; p += 20) { onPct(p); await new Promise((r) => setTimeout(r, 80)); }
        const url = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(file); });
        return { drive_id: 'demo-' + Date.now() + Math.random().toString(36).slice(2, 6), name: file.name, mime: file.type, size: file.size, local_url: url };
      },
      fileUrl: (f) => f.local_url,
      reset() { localStorage.removeItem(KEY); location.reload(); },
    };
  }

  // ───────────── Backend: Supabase + Edge Function ─────────────
  function SupaBackend() {
    const sb = supabase.createClient(CFG.supabaseUrl, CFG.anonKey);
    const fn = CFG.functionUrl || CFG.supabaseUrl.replace(/\/$/, '') + '/functions/v1/teamchat';
    const auth = () => (TG ? { 'x-tg-init-data': TG.initData } : { 'x-team-name': encodeURIComponent(me.name), 'x-team-pin': me.pin || '' });
    const chk = (r) => { if (r.error) throw new Error(r.error.message); return r.data; };
    return {
      mode: 'supabase',
      async load() {
        const [c, f, m, s] = await Promise.all([
          sb.from('tc_channels').select('*').is('deleted_at', null).order('sort'),
          sb.from('tc_folders').select('*').order('created_at'),
          sb.from('tc_members').select('*'),
          sb.from('tc_settings').select('*'),
        ]);
        return { channels: chk(c), folders: chk(f), members: chk(m), settings: Object.fromEntries(chk(s).map((r) => [r.key, r.value])) };
      },
      async list(ch) { return chk(await sb.from('tc_messages').select('*').eq('channel_id', ch).order('id', { ascending: false }).limit(300)).reverse(); },
      async search(q, ch) {
        const s = q.replace(/[%,()*\\]/g, ' ').trim(); if (!s) return [];
        let x = sb.from('tc_messages').select('*').is('deleted_at', null).ilike('search_text', `%${s}%`).order('id', { ascending: false }).limit(100);
        if (ch) x = x.eq('channel_id', ch);
        return chk(await x).reverse();
      },
      subscribe(fn2) {
        sb.channel('tc').on('postgres_changes', { event: '*', schema: 'public' }, (p) => { if (p.table.startsWith('tc_')) fn2(p.table, p.eventType, p.new); }).subscribe();
      },
      async op(name, payload) {
        let r;
        try { r = await fetch(fn + '/op/' + name, { method: 'POST', headers: { 'content-type': 'application/json', ...auth() }, body: JSON.stringify(payload || {}) }); }
        catch { throw new Error('ติดต่อเซิร์ฟเวอร์ Team Chat ไม่ได้ (Edge Function ยังไม่ได้อัป หรือเน็ตหลุด)'); }
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || 'เซิร์ฟเวอร์ตอบ ' + r.status);
        return j;
      },
      upload(file, onPct, channelId) { // ส่งไฟล์ให้ Edge Function → อัปขึ้นโฟลเดอร์ Drive ของห้อง
        return new Promise((res, rej) => {
          const fd = new FormData(); fd.append('file', file, file.name); fd.append('channel_id', channelId);
          const x = new XMLHttpRequest(); x.open('POST', fn + '/upload');
          Object.entries(auth()).forEach(([k, v]) => x.setRequestHeader(k, v));
          x.upload.onprogress = (e) => e.lengthComputable && onPct(Math.round((e.loaded / e.total) * 100));
          x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText); } catch {} x.status < 300 ? res(j) : rej(new Error(j.error || 'อัปโหลดไม่สำเร็จ ' + x.status)); };
          x.onerror = () => rej(new Error('เชื่อมต่อไม่ได้'));
          x.send(fd);
        });
      },
      fileUrl: (f) => fn + '/file?id=' + encodeURIComponent(f.drive_id),
    };
  }

  const api = CFG.supabaseUrl && CFG.anonKey ? SupaBackend() : DemoBackend();

  // ───────────── สถานะหน้าจอ ─────────────
  const S = {
    channels: [], folders: [], members: [], settings: {},
    current: store.get('tc_channel', 'general'), view: 'room', rows: [],
    reply: null, editing: null, highlight: null, unread: {}, mute: store.get('tc_mute', {}),
  };
  const rules = makeRules(() => S.members, () => S.settings);
  const room = () => S.channels.find((c) => c.id === S.current);

  const fmtTime = (iso) => new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
  const fmtDay = (iso) => new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
  const fmtDate = (ymd) => (ymd ? new Date(ymd + 'T00:00').toLocaleDateString('th-TH', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) : '');
  const fmtSize = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const fileIcon = (mime = '') => (mime.includes('pdf') ? '📕' : mime.includes('sheet') || mime.includes('excel') ? '📗' : mime.includes('word') ? '📘' : mime.startsWith('video') ? '🎬' : '📄');
  const hi = (s, q) => (q ? esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/[&<>"']/g, (c) => esc(c)), 'gi'), (x) => `<mark>${x}</mark>`) : esc(s));

  function toast(t, ms = 2800) { const el = $('toast'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (el.hidden = true), ms); }
  async function run(name, payload) { try { return await api.op(name, payload); } catch (e) { toast(e.message, 4500); throw e; } }
  const sheet = (id, show) => { $(id).hidden = !show; };

  function snippet(m) {
    if (!m) return 'ข้อความเดิม';
    if (m.deleted_at) return 'ข้อความถูกลบ';
    if (m.kind === 'text') return m.body.slice(0, 80);
    const d = m.data || {};
    return `${KIND_LABEL[m.kind] || ''} ${d.title || d.site || d.name || ''}`.trim();
  }

  // ───────────── วาดแถบซ้าย/หัว ─────────────
  function renderChannels() {
    $('channels').innerHTML = S.channels.map((c) => `<button class="ch ${S.view === 'room' && c.id === S.current ? 'active' : ''}" data-ch="${esc(c.id)}"><span>${esc(c.icon)}</span><span>${esc(c.name)}</span>${S.mute[c.id] ? '<span class="lock">🔕</span>' : ''}${S.unread[c.id] ? `<span class="unread">${S.unread[c.id]}</span>` : ''}</button>`).join('');
    document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', S.view === b.dataset.view));
    renderHeader();
  }
  function renderHeader() {
    const inRoom = S.view === 'room' || S.view === 'search' || S.view === 'pins';
    $('roomActions').hidden = !inRoom;
    $('composer').hidden = S.view !== 'room';
    $('searchBar').hidden = S.view !== 'search';
    if (S.view === 'folders') { $('chIcon').textContent = '📁'; $('chName').textContent = 'โฟลเดอร์เอกสาร'; $('chSub').textContent = 'Google Drive บริษัท · สร้างผ่าน Team Chat'; return; }
    if (S.view === 'settings') { $('chIcon').textContent = '⚙️'; $('chName').textContent = 'สิทธิ์และการตั้งค่า'; $('chSub').textContent = ''; return; }
    const c = room(); if (!c) return;
    const f = S.folders.find((x) => x.drive_id === c.drive_folder_id);
    $('chIcon').textContent = c.icon; $('chName').textContent = c.name;
    $('chSub').textContent = [c.created_by_name ? 'สร้างโดย ' + c.created_by_name : '', f ? '📁 ' + f.name : ''].filter(Boolean).join(' · ');
    const pins = S.rows.filter((m) => m.pinned && !m.deleted_at).length;
    $('pinCount').textContent = pins || '';
    $('btnBell').textContent = S.mute[c.id] ? '🔕' : '🔔';
    $('btnBell').title = S.mute[c.id] ? 'ปิดแจ้งเตือนห้องนี้อยู่ (กดเพื่อเปิด)' : 'แจ้งเตือนห้องนี้ (กดเพื่อปิด)';
  }
  function renderMe() {
    const role = rules.isAdmin(me) ? 'ผู้ดูแล' : 'สมาชิก';
    $('meBox').innerHTML = me ? `ใช้งานในชื่อ <b>${esc(me.name)}</b> · ${role}${TG ? ' · Telegram' : ' <button id="btnLogout">เปลี่ยนชื่อ</button>'}` : '';
  }

  // ───────────── วาดข้อความ/การ์ด ─────────────
  function fileHtml(f, small) {
    const url = api.fileUrl(f);
    if ((f.mime || '').startsWith('image/')) return `<img class="img" src="${esc(url)}" alt="${esc(f.name)}" loading="lazy" data-img="${esc(url)}">`;
    if (small) return '';
    const open = f.web_link || url;
    return `<a class="file" href="${esc(open)}" target="_blank" rel="noopener"><span class="ico">${fileIcon(f.mime)}</span><span><b>${esc(f.name)}</b><small>${fmtSize(f.size || 0)} · ${api.mode === 'demo' ? 'เก็บในเครื่อง (ตัวอย่าง)' : 'Google Drive'}</small></span></a>`;
  }
  const kv = (pairs) => `<div class="kv">${pairs.filter(([, v]) => v).map(([k, v]) => `<span>${k}</span><b>${esc(v)}</b>`).join('')}</div>`;
  function gcalLink(d) {
    if (!d.date) return '';
    const pad = (n) => String(n).padStart(2, '0');
    const f = (x) => `${x.getFullYear()}${pad(x.getMonth() + 1)}${pad(x.getDate())}T${pad(x.getHours())}${pad(x.getMinutes())}00`;
    const st = new Date(`${d.date}T${d.time || '09:00'}`), en = new Date(st.getTime() + 3600e3);
    return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action: 'TEMPLATE', text: d.title || 'นัดหมาย', dates: `${f(st)}/${f(en)}`, location: d.place || '', details: d.attendees ? 'ผู้เข้าร่วม: ' + d.attendees : '' });
  }

  function cardHtml(m) {
    const d = m.data || {};
    if (m.kind === 'report') {
      const photos = d.photos || (d.photo ? [d.photo] : []);
      return `<div class="card"><h4>🏗️ รายงานหน้างาน</h4><div><b>${esc(d.site)}</b></div>
        ${kv([['วันที่', fmtDate(d.date)], ['ช่าง', d.tech]])}
        <div class="progress"><i style="width:${Math.min(100, Math.max(0, +d.pct || 0))}%"></i></div>
        <div>ความคืบหน้า <b>${esc(d.pct)}%</b></div>${d.note ? `<div class="body">${esc(d.note)}</div>` : ''}
        ${photos.length ? `<div class="photos">${photos.map((p) => fileHtml(p, true)).join('')}</div>` : ''}</div>`;
    }
    if (m.kind === 'approval') {
      const st = d.status || 'pending';
      const label = { pending: '⏳ รออนุมัติ', approved: '✔ อนุมัติแล้ว', rejected: '✖ ไม่อนุมัติ' }[st];
      const can = rules.canApprove(me);
      return `<div class="card"><h4>✅ ขออนุมัติ</h4><div><b>${esc(d.title)}</b></div>${d.detail ? `<div class="body">${esc(d.detail)}</div>` : ''}
        <div style="margin-top:6px"><span class="status ${st}">${label}</span>${d.by ? ` <small style="color:var(--hint)">โดย ${esc(d.by)}</small>` : ''}</div>
        ${st === 'pending' ? (can ? `<div class="actions"><button class="btn-ok" data-card-act="approve" data-v="approved" data-id="${m.id}">อนุมัติ</button><button class="btn-bad" data-card-act="approve" data-v="rejected" data-id="${m.id}">ไม่อนุมัติ</button></div>` : '<small style="color:var(--hint)">รอผู้มีสิทธิ์อนุมัติ</small>') : ''}</div>`;
    }
    if (m.kind === 'checklist') {
      const items = d.items || [], done = items.filter((x) => x.done).length;
      return `<div class="card"><h4>☑️ ${esc(d.title || 'เช็กลิสต์')}</h4>
        <div class="progress"><i style="width:${items.length ? (done / items.length) * 100 : 0}%"></i></div><small style="color:var(--hint)">เสร็จ ${done}/${items.length}</small>
        ${items.map((x, i) => `<label class="cl-item ${x.done ? 'done' : ''}"><input type="checkbox" ${x.done ? 'checked' : ''} data-card-act="check" data-v="${i}" data-id="${m.id}"><span><span class="t">${esc(x.t)}</span>${x.done ? `<small>✔ ${esc(x.by)} · ${fmtTime(x.at)}</small>` : ''}</span></label>`).join('')}</div>`;
    }
    if (m.kind === 'workorder') {
      const st = d.status || 'open';
      const label = { open: '📋 รอดำเนินการ', doing: '🔧 กำลังทำ', done: '✔ เสร็จแล้ว' }[st];
      const next = { open: ['doing', 'เริ่มงาน'], doing: ['done', 'ปิดงาน (เสร็จ)'], done: ['open', 'เปิดงานใหม่'] }[st];
      return `<div class="card"><h4>🛠️ ใบงาน</h4><div><b>${esc(d.title)}</b></div>
        ${kv([['ช่างที่รับงาน', d.assignee], ['สถานที่', d.location], ['กำหนดเสร็จ', fmtDate(d.due)]])}${d.detail ? `<div class="body">${esc(d.detail)}</div>` : ''}
        <div style="margin-top:6px"><span class="status ${st}">${label}</span>${d.status_by ? ` <small style="color:var(--hint)">โดย ${esc(d.status_by)}</small>` : ''}</div>
        ${rules.canSetStatus(me, m) ? `<div class="actions"><button class="${st === 'doing' ? 'btn-ok' : 'neutral'}" data-card-act="status" data-v="${next[0]}" data-id="${m.id}">${next[1]}</button></div>` : ''}</div>`;
    }
    if (m.kind === 'appointment') {
      const going = d.going || [], iGo = going.includes(me.name);
      return `<div class="card"><h4>📅 นัดหมาย</h4><div><b>${esc(d.title)}</b></div>
        ${kv([['วันที่', fmtDate(d.date)], ['เวลา', d.time ? d.time + ' น.' : ''], ['สถานที่', d.place], ['ผู้เข้าร่วม', d.attendees]])}
        <small style="color:var(--hint)">ตอบรับแล้ว ${going.length} คน${going.length ? ': ' + esc(going.join(', ')) : ''}</small>
        <div class="actions"><button class="${iGo ? 'btn-bad' : 'btn-ok'}" data-card-act="rsvp" data-id="${m.id}">${iGo ? 'ยกเลิกเข้าร่วม' : 'เข้าร่วม ✓'}</button><a href="${esc(gcalLink(d))}" target="_blank" rel="noopener">📅 ลง Google Calendar</a></div></div>`;
    }
    return '';
  }

  function msgHtml(m, byId) {
    const mine = me && m.author_id === me.id;
    let inner;
    if (m.deleted_at) inner = `<div class="deleted">🗑 ข้อความถูกลบ${m.deleted_by ? ' โดย ' + esc(m.deleted_by) : ''}</div>`;
    else if (m.kind === 'file') inner = fileHtml(m.data || {}) + (m.body ? `<div class="body">${esc(m.body)}</div>` : '');
    else if (KIND_LABEL[m.kind]) inner = cardHtml(m);
    else inner = `<div class="body">${esc(m.body)}</div>`;
    const p = m.reply_to ? byId.get(m.reply_to) : null;
    const quote = m.reply_to ? `<div class="quote" data-jump="${m.reply_to}"><b>↩ ${esc(p ? p.author_name : '')}</b>${esc(snippet(p))}</div>` : '';
    const acts = m.deleted_at ? '' : `<div class="msg-act">
        <button data-act="reply" data-id="${m.id}">↩ ตอบกลับ</button>
        <button data-act="pin" data-id="${m.id}">${m.pinned ? '📌 เลิกปัก' : '📌 ปักหมุด'}</button>
        ${rules.canEditMsg(me, m) ? `<button data-act="edit" data-id="${m.id}">✏️ แก้ไข</button>` : ''}
        ${rules.canDeleteMsg(me, m) ? `<button data-act="delete" data-id="${m.id}">🗑 ลบ</button>` : ''}</div>`;
    return `<div class="m ${mine ? 'mine' : ''} ${S.highlight === m.id ? 'hl' : ''}" id="m${m.id}"><div class="bubble">
      ${m.pinned ? `<div class="pin-mark">📌 ปักหมุด${m.pinned_by ? ' โดย ' + esc(m.pinned_by) : ''}</div>` : ''}
      ${mine ? '' : `<div class="who">${esc(m.author_name)}${m.source === 'telegram' ? '<span class="src">via Telegram</span>' : ''}</div>`}
      ${quote}${inner}<div class="meta">${m.edited_at && !m.deleted_at ? 'แก้ไขแล้ว · ' : ''}${fmtTime(m.created_at)}</div></div>${acts}</div>`;
  }

  function renderMsgs(stick) {
    const box = $('msgs');
    const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 80;
    const top = box.scrollTop;
    if (!S.rows.length) { box.innerHTML = '<div class="empty">ยังไม่มีข้อความในห้องนี้</div>'; renderHeader(); return; }
    const byId = new Map(S.rows.map((m) => [m.id, m]));
    let html = '', lastDay = '';
    for (const m of S.rows) { const d = fmtDay(m.created_at); if (d !== lastDay) { html += `<div class="day"><span>${d}</span></div>`; lastDay = d; } html += msgHtml(m, byId); }
    box.innerHTML = html;
    box.scrollTop = stick || atBottom ? box.scrollHeight : top;
    renderHeader();
  }

  // ───────────── แผง: โฟลเดอร์ · ตั้งค่า · ค้นหา · ปักหมุด ─────────────
  function showPanel(html) { $('msgs').hidden = true; $('panel').hidden = false; $('panel').innerHTML = html; }
  function hidePanel() { $('panel').hidden = true; $('msgs').hidden = false; }

  function renderFolders() {
    const byRoom = S.channels.map((c) => ({ c, fs: S.folders.filter((f) => f.channel_id === c.id) })).filter((x) => x.fs.length);
    const root = CFG.driveRootUrl ? `<a href="${esc(CFG.driveRootUrl)}" target="_blank" rel="noopener">เปิดโฟลเดอร์หลักใน Drive ↗</a>` : '';
    showPanel(`<div class="box"><p class="hint" style="margin:0">โฟลเดอร์ย่อยใน Google Drive บริษัท ที่สร้างผ่าน Team Chat · ตั้งชื่อแบบ <b>[ชื่องาน] - [ผู้สร้าง]</b> · ${api.mode === 'demo' ? 'โหมดตัวอย่าง: ยังไม่ได้สร้างใน Drive จริง' : root}</p></div>
      ${byRoom.length ? byRoom.map(({ c, fs }) => `<div class="box"><h3>${esc(c.icon)} ${esc(c.name)}</h3>${fs.map((f) => `<div class="list-row"><span style="font-size:22px">📁</span><div class="grow"><b>${esc(f.name)}</b><small>สร้าง ${fmtDay(f.created_at)}${c.drive_folder_id === f.drive_id ? ' · ● ใช้เก็บไฟล์ของห้องนี้' : ''}</small></div>${f.web_link ? `<a href="${esc(f.web_link)}" target="_blank" rel="noopener">เปิด ↗</a>` : '<small>(ตัวอย่าง)</small>'}<button class="mini" data-ch="${esc(c.id)}">ไปที่ห้อง</button></div>`).join('')}</div>`).join('')
        : '<div class="empty">ยังไม่มีโฟลเดอร์ — เข้าห้องแล้วกด 📁 ด้านบนเพื่อสร้าง</div>'}`);
  }

  function renderSettings() {
    const admin = rules.isAdmin(me), pol = S.settings.approve_policy || 'admin';
    const dis = admin ? '' : 'disabled';
    showPanel(`<div class="box"><h3>สิทธิ์ของคุณ</h3>${esc(me.name)} · <b>${admin ? 'ผู้ดูแล (admin)' : 'สมาชิก'}</b>
        <p class="hint">ผู้ดูแล: แก้/ลบได้ทุกห้อง · ลบข้อความใดก็ได้ · ตั้งสิทธิ์ · ผู้สร้างห้อง: แก้/ลบห้องของตัวเอง</p></div>
      <div class="box"><h3>ใครอนุมัติการ์ด "ขออนุมัติ" ได้</h3>
        <select id="selPolicy" ${dis}><option value="admin" ${pol === 'admin' ? 'selected' : ''}>ผู้ดูแลเท่านั้น</option><option value="approvers" ${pol === 'approvers' ? 'selected' : ''}>ผู้ดูแล + ผู้ที่ติ๊ก "อนุมัติได้"</option><option value="all" ${pol === 'all' ? 'selected' : ''}>ทุกคน</option></select>
        ${admin ? '' : '<p class="hint">เฉพาะผู้ดูแลเปลี่ยนได้</p>'}</div>
      <div class="box"><h3>สมาชิก (${S.members.length})</h3>${S.members.map((m) => `<div class="list-row"><div class="grow"><b>${esc(m.name)}</b><small>${esc(m.user_id.startsWith('tg:') ? 'Telegram' : 'เบราว์เซอร์')}</small></div>
          <label class="chk"><input type="checkbox" data-approver="${esc(m.user_id)}" ${m.approver ? 'checked' : ''} ${dis}> อนุมัติได้</label>
          <select data-role="${esc(m.user_id)}" style="width:auto" ${dis}><option value="member" ${m.role !== 'admin' ? 'selected' : ''}>สมาชิก</option><option value="admin" ${m.role === 'admin' ? 'selected' : ''}>ผู้ดูแล</option></select></div>`).join('')}</div>
      <div class="box"><h3>การแจ้งเตือน</h3><p class="hint">🔔 ที่หัวห้อง = เปิด/ปิดแจ้งเตือนบนเครื่องนี้ทีละห้อง · ⋯ ตั้งค่าห้อง = แจ้งเข้ากลุ่ม Telegram หรือไม่</p>
        <button class="mini" id="btnNotifPerm">อนุญาตแจ้งเตือนเบราว์เซอร์ (${typeof Notification === 'undefined' ? 'ไม่รองรับ' : { granted: 'อนุญาตแล้ว', denied: 'ถูกปิด', default: 'ยังไม่ตั้ง' }[Notification.permission]})</button></div>
      ${admin ? `<div class="box"><h3>Google Drive</h3><p class="hint">แชร์โฟลเดอร์ Team Chat ให้ทุกคนในบริษัทเปิดไฟล์จากแชทได้ (โฟลเดอร์ย่อยของทุกห้องได้สิทธิ์ตามเอง)</p>
        <button class="mini" id="btnDriveShare">แชร์โฟลเดอร์ให้ทีม + ดูเจ้าของ</button><div id="driveShareOut" class="hint" style="margin-top:6px"></div></div>` : ''}
      ${api.mode === 'demo' ? '<div class="box"><h3>โหมดตัวอย่าง</h3><button class="danger" id="btnReset">ล้างข้อมูลตัวอย่าง</button></div>' : ''}`);
  }

  let lastQ = '';
  async function renderSearch() {
    const q = $('q').value.trim(); lastQ = q;
    if (!q) { showPanel('<div class="empty">พิมพ์คำที่ต้องการค้นหา (ข้อความ ชื่อไฟล์ หัวข้อการ์ด)</div>'); return; }
    let res = [];
    try { res = await api.search(q, $('qAll').checked ? null : S.current); } catch (e) { toast(e.message); }
    if (q !== lastQ) return;
    const name = (id) => { const c = S.channels.find((x) => x.id === id); return c ? c.icon + ' ' + c.name : id; };
    showPanel(`<div class="box"><b>พบ ${res.length} รายการ</b>${res.map((m) => `<div class="list-row res" data-goto="${m.id}" data-gch="${esc(m.channel_id)}"><div class="grow"><small>${esc(name(m.channel_id))} · ${esc(m.author_name)} · ${fmtDay(m.created_at)} ${fmtTime(m.created_at)}</small>${hi(resultText(m, q), q)}</div></div>`).join('')}</div>`);
  }
  function resultText(m, q) {
    if (m.kind === 'text') return m.body;
    const s = snippet(m) + (m.kind === 'file' ? ' ' + (m.data?.name || '') : '');
    const hit = textParts(m).find((p) => p.toLowerCase().includes(q.toLowerCase()));
    return hit && !s.toLowerCase().includes(q.toLowerCase()) ? `${s} · …${hit.slice(0, 80)}` : s;
  }
  function renderPins() {
    const pins = S.rows.filter((m) => m.pinned && !m.deleted_at);
    showPanel(`<div class="box"><b>📌 ปักหมุดในห้องนี้ (${pins.length})</b>${pins.map((m) => `<div class="list-row res" data-goto="${m.id}" data-gch="${esc(m.channel_id)}"><div class="grow"><small>${esc(m.author_name)} · ${fmtDay(m.created_at)}${m.pinned_by ? ' · ปักโดย ' + esc(m.pinned_by) : ''}</small>${esc(snippet(m))}</div></div>`).join('') || '<p class="hint">ยังไม่มี — ชี้ที่ข้อความแล้วกด 📌 ปักหมุด</p>'}</div>`);
  }

  function setView(v) {
    S.view = v; $('side').classList.remove('open');
    if (v === 'room') hidePanel(); else if (v === 'folders') renderFolders(); else if (v === 'settings') renderSettings();
    else if (v === 'search') { renderSearch(); setTimeout(() => $('q').focus(), 30); } else if (v === 'pins') renderPins();
    renderChannels();
  }

  async function openChannel(id, jumpTo) {
    if (!S.channels.some((c) => c.id === id)) id = S.channels[0]?.id;
    S.current = id; store.set('tc_channel', id); S.unread[id] = 0;
    clearCtx(); setView('room');
    try { S.rows = await api.list(id); } catch (e) { S.rows = []; toast('โหลดข้อความไม่ได้: ' + e.message); }
    renderMsgs(true);
    if (jumpTo) jump(jumpTo);
  }
  function jump(id) {
    S.highlight = id; renderMsgs(false);
    const el = $('m' + id);
    if (el) el.scrollIntoView({ block: 'center', behavior: 'smooth' }); else toast('ข้อความนั้นเก่าเกินกว่าที่โหลดไว้');
    setTimeout(() => { if (S.highlight === id) { S.highlight = null; $('m' + id)?.classList.remove('hl'); } }, 2200);
  }

  // ───────────── เปลี่ยนแปลงสด ─────────────
  function upsert(arr, row, key = 'id') { const i = arr.findIndex((x) => x[key] === row[key]); if (i >= 0) arr[i] = row; else arr.push(row); }
  function onChange(table, type, row) {
    if (!row) return;
    if (table === 'tc_messages') {
      if (row.channel_id !== S.current) {
        if (type === 'INSERT' && row.author_id !== me?.id) { S.unread[row.channel_id] = (S.unread[row.channel_id] || 0) + 1; renderChannels(); notifyLocal(row); }
        return;
      }
      upsert(S.rows, row);
      if (S.view === 'room') renderMsgs(type === 'INSERT' && row.author_id === me?.id); else if (S.view === 'pins') renderPins();
      if (type === 'INSERT' && row.author_id !== me?.id) { notifyLocal(row); TG?.HapticFeedback?.notificationOccurred('success'); }
    } else if (table === 'tc_channels') {
      if (row.deleted_at) {
        S.channels = S.channels.filter((c) => c.id !== row.id);
        if (S.current === row.id) { toast('ห้องนี้ถูกลบแล้ว'); openChannel('general'); }
      } else { upsert(S.channels, row); S.channels.sort((a, b) => (a.sort || 0) - (b.sort || 0)); }
      renderChannels(); if (S.view === 'folders') renderFolders();
      if (!$('folderSheet').hidden) renderFolderSheet();
    } else if (table === 'tc_folders') {
      upsert(S.folders, row); if (S.view === 'folders') renderFolders(); if (!$('folderSheet').hidden) renderFolderSheet(); renderHeader();
    } else if (table === 'tc_members') {
      upsert(S.members, row, 'user_id'); renderMe(); if (S.view === 'settings') renderSettings(); else if (S.view === 'room') renderMsgs(false);
    } else if (table === 'tc_settings') {
      S.settings[row.key] = row.value; if (S.view === 'settings') renderSettings(); else if (S.view === 'room') renderMsgs(false);
    }
  }
  function notifyLocal(row) {
    if (S.mute[row.channel_id] || !document.hidden || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
    const c = S.channels.find((x) => x.id === row.channel_id);
    try { new Notification(`${row.author_name} · ${c ? c.name : ''}`, { body: snippet(row), icon: 'icon.png', tag: 'tc' + row.channel_id }); } catch {}
  }

  // ───────────── ส่ง/อัปโหลด ─────────────
  function setCtx(text) { $('ctxText').textContent = text; $('ctxBar').hidden = false; $('txt').focus(); }
  function clearCtx() { S.reply = null; if (S.editing) { S.editing = null; $('txt').value = ''; } $('ctxBar').hidden = true; }

  async function send(msg) {
    const row = await run('send', { channel_id: S.current, ...msg });
    if (row && row.id && !S.rows.some((r) => r.id === row.id)) onChange('tc_messages', 'INSERT', row);
    return row;
  }
  async function uploadOne(file) {
    const c = room(), f = S.folders.find((x) => x.drive_id === c?.drive_folder_id);
    $('uploadBar').hidden = false;
    $('uploadText').textContent = `กำลังอัปโหลด ${file.name} → ${f ? '📁 ' + f.name : 'Google Drive (โฟลเดอร์หลัก)'}`;
    $('uploadPct').style.width = '0';
    try { return await api.upload(file, (p) => ($('uploadPct').style.width = p + '%'), S.current); }
    finally { $('uploadBar').hidden = true; }
  }

  // ───────────── ฟอร์มการ์ด ─────────────
  const CARD_FORMS = {
    report: () => `<h3>🏗️ รายงานหน้างาน</h3>
      <div class="two"><label>วันที่<input name="date" type="date" value="${today()}" required></label><label>ช่าง<input name="tech" value="${esc(me.name)}" placeholder="ชื่อช่าง (หลายคนคั่นด้วย ,)" list="dlMembers"></label></div>
      <label>ชื่อไซต์<input name="site" required value="${esc(room()?.name || '')}"></label>
      <label>ความคืบหน้า <output id="pctOut">50</output>%<input name="pct" type="range" min="0" max="100" step="5" value="50"></label>
      <label>หมายเหตุ<textarea name="note" rows="2" placeholder="ติดตั้งแผงแถว 1–3 เสร็จ"></textarea></label>
      <label>รูปหน้างาน (เลือกได้หลายรูป)<input name="photos" type="file" accept="image/*" multiple></label>`,
    approval: () => `<h3>✅ ขออนุมัติ</h3>
      <label>เรื่อง<input name="title" required placeholder="เช่น ขอเบิกสาย PV 4 mm² 2 ม้วน"></label>
      <label>รายละเอียด<textarea name="detail" rows="2"></textarea></label>
      <p class="hint">ผู้อนุมัติได้: ${{ admin: 'ผู้ดูแลเท่านั้น', approvers: 'ผู้ดูแล + ผู้ที่ได้สิทธิ์อนุมัติ', all: 'ทุกคน' }[S.settings.approve_policy || 'admin']}</p>`,
    checklist: () => `<h3>☑️ เช็กลิสต์</h3>
      <label>หัวข้อ<input name="title" required placeholder="เช่น ตรวจก่อนจ่ายไฟ"></label>
      <label>รายการ (1 บรรทัด = 1 ข้อ)<textarea name="items" rows="5" required placeholder="วัด Voc ทุก string&#10;ขันแน่นขั้วต่อ MC4&#10;ติดป้ายเตือนตู้ DC"></textarea></label>`,
    workorder: () => `<h3>🛠️ ใบงาน</h3>
      <label>งาน<input name="title" required placeholder="เช่น เดินสาย DC string 3–4"></label>
      <div class="two"><label>ช่างที่รับงาน<input name="assignee" required list="dlMembers" placeholder="เลือก/พิมพ์ชื่อ"></label><label>กำหนดเสร็จ<input name="due" type="date" value="${today()}"></label></div>
      <label>สถานที่<input name="location" value="${esc(room()?.name || '')}"></label>
      <label>รายละเอียด<textarea name="detail" rows="2"></textarea></label>`,
    appointment: () => `<h3>📅 นัดหมาย</h3>
      <label>เรื่อง<input name="title" required placeholder="เช่น สำรวจหลังคา"></label>
      <div class="two"><label>วันที่<input name="date" type="date" value="${today()}" required></label><label>เวลา<input name="time" type="time" value="09:00"></label></div>
      <label>สถานที่<input name="place"></label>
      <label>ผู้เข้าร่วม<input name="attendees" placeholder="ชื่อ คั่นด้วย ,"></label>`,
  };
  function openCardForm(type) {
    const f = $('fCard'); f.dataset.type = type;
    f.innerHTML = CARD_FORMS[type]() + `<datalist id="dlMembers">${S.members.map((m) => `<option value="${esc(m.name)}">`).join('')}</datalist>
      <div class="row"><button type="button" class="ghost" data-close>ยกเลิก</button><button class="primary">ส่ง</button></div>`;
    const pct = f.elements.pct; if (pct) pct.oninput = () => ($('pctOut').textContent = pct.value);
    sheet('cardMenu', false); sheet('cardForm', true);
    setTimeout(() => f.querySelector('input:not([type=date]):not([type=range])')?.focus(), 30);
  }
  async function submitCard(e) {
    e.preventDefault();
    const f = e.target, el = f.elements, type = f.dataset.type, btn = e.submitter || f.querySelector('.primary');
    const v = (n) => (el[n]?.value || '').trim();
    btn.disabled = true;
    try {
      let data;
      if (type === 'report') {
        data = { date: v('date'), tech: v('tech'), site: v('site'), pct: +el.pct.value, note: v('note'), photos: [] };
        for (const file of [...el.photos.files]) data.photos.push(await uploadOne(file));
      } else if (type === 'approval') data = { title: v('title'), detail: v('detail'), status: 'pending' };
      else if (type === 'checklist') {
        const items = v('items').split('\n').map((s) => s.trim()).filter(Boolean).map((t) => ({ t, done: false }));
        if (!items.length) throw new Error('ใส่รายการอย่างน้อย 1 ข้อ');
        data = { title: v('title'), items };
      } else if (type === 'workorder') data = { title: v('title'), assignee: v('assignee'), due: v('due'), location: v('location'), detail: v('detail'), status: 'open' };
      else if (type === 'appointment') data = { title: v('title'), date: v('date'), time: v('time'), place: v('place'), attendees: v('attendees'), going: [] };
      await send({ kind: type, data });
      sheet('cardForm', false);
    } catch (err) { toast(err.message, 4500); } finally { btn.disabled = false; }
  }

  // ───────────── ห้อง / โฟลเดอร์ ─────────────
  let roomEditId = null, roomIcon = '💬';
  function openRoomForm(c) {
    roomEditId = c ? c.id : null; roomIcon = c ? c.icon : '🏗️';
    const f = $('fRoom');
    $('roomFormTitle').textContent = c ? 'ตั้งค่าห้อง' : 'ห้องใหม่';
    f.elements.name.value = c ? c.name : '';
    f.elements.notify.checked = c ? c.notify !== false : true;
    f.elements.folder.checked = !c;
    $('roomFolderRow').hidden = !!c;
    $('btnRoomDelete').hidden = !c || c.id === 'general';
    $('emojiPick').innerHTML = ICONS.map((i) => `<button type="button" data-icon="${i}" class="${i === roomIcon ? 'sel' : ''}">${i}</button>`).join('');
    sheet('roomForm', true); setTimeout(() => f.elements.name.focus(), 30);
  }
  async function submitRoom(e) {
    e.preventDefault();
    const el = e.target.elements, name = el.name.value.trim();
    try {
      if (roomEditId) { await run('room_update', { id: roomEditId, name, icon: roomIcon, notify: el.notify.checked }); toast('บันทึกแล้ว'); }
      else {
        const c = await run('room_create', { name, icon: roomIcon, notify: el.notify.checked });
        onChange('tc_channels', 'INSERT', c);
        if (el.folder.checked) { const f = await run('folder_create', { channel_id: c.id, job: name }); onChange('tc_folders', 'INSERT', f); }
        openChannel(c.id);
      }
      sheet('roomForm', false);
    } catch {}
  }
  function renderFolderSheet() {
    const c = room(); if (!c) return;
    const fs = S.folders.filter((f) => f.channel_id === c.id);
    $('folderList').innerHTML = fs.length ? fs.map((f) => `<div class="list-row"><input type="radio" name="useFolder" data-usefolder="${esc(f.drive_id)}" ${c.drive_folder_id === f.drive_id ? 'checked' : ''} style="width:auto"><div class="grow"><b>${esc(f.name)}</b><small>สร้าง ${fmtDay(f.created_at)} โดย ${esc(f.created_by_name)}</small></div>${f.web_link ? `<a href="${esc(f.web_link)}" target="_blank" rel="noopener">เปิด ↗</a>` : '<small>(ตัวอย่าง)</small>'}</div>`).join('')
      : '<p class="hint">ห้องนี้ยังไม่มีโฟลเดอร์ — ไฟล์จะเข้าโฟลเดอร์หลักของ Team Chat</p>';
    const job = $('fFolder').elements.job.value.trim();
    $('folderPreview').textContent = `${job || '[ชื่องาน]'} - ${me.name}`;
  }

  // ───────────── events ─────────────
  function bind() {
    const txt = $('txt');
    const grow = () => { txt.style.height = 'auto'; txt.style.height = Math.min(140, txt.scrollHeight) + 'px'; };
    txt.addEventListener('input', grow);
    txt.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('btnSend').click(); }
      if (e.key === 'Escape') clearCtx();
    });
    $('btnSend').onclick = async () => {
      const t = txt.value.trim(); if (!t) return;
      try {
        if (S.editing) { await run('edit', { id: S.editing.id, body: t }); S.editing = null; txt.value = ''; clearCtx(); }
        else { const reply_to = S.reply?.id || null; txt.value = ''; grow(); clearCtx(); try { await send({ kind: 'text', body: t, reply_to }); } catch { txt.value = t; } }
        grow();
      } catch {}
    };
    $('ctxCancel').onclick = clearCtx;
    $('btnAttach').onclick = () => $('file').click();
    $('file').onchange = async (e) => {
      for (const f of [...e.target.files]) { try { const info = await uploadOne(f); await send({ kind: 'file', body: '', data: info, reply_to: S.reply?.id || null }); } catch (err) { toast(err.message, 4500); } }
      clearCtx(); e.target.value = '';
    };
    $('btnCards').onclick = () => sheet('cardMenu', true);
    $('btnMenu').onclick = () => $('side').classList.toggle('open');
    $('btnNewRoom').onclick = () => openRoomForm(null);
    $('btnRoomMenu').onclick = () => { const c = room(); if (rules.canEditRoom(me, c)) openRoomForm(c); else toast('แก้ไขห้องได้เฉพาะผู้สร้างห้อง (' + (c.created_by_name || '-') + ') หรือผู้ดูแล'); };
    $('btnRoomDelete').onclick = async () => {
      const c = room(); if (!confirm(`ลบห้อง "${c.name}"?\nข้อความจะถูกซ่อน ไฟล์ใน Google Drive ยังอยู่ครบ`)) return;
      try { await run('room_delete', { id: c.id }); sheet('roomForm', false); } catch {}
    };
    $('btnFolder').onclick = () => { $('fFolder').elements.job.value = ''; renderFolderSheet(); sheet('folderSheet', true); };
    $('fFolder').elements.job.oninput = renderFolderSheet;
    $('fFolder').onsubmit = async (e) => {
      e.preventDefault(); const job = e.target.elements.job.value.trim(); if (!job) { toast('ใส่ชื่องานก่อน'); return; }
      try { const f = await run('folder_create', { channel_id: S.current, job }); onChange('tc_folders', 'INSERT', f); e.target.elements.job.value = ''; renderFolderSheet(); toast('สร้างโฟลเดอร์ "' + f.name + '" แล้ว'); } catch {}
    };
    $('btnBell').onclick = async () => {
      const id = S.current; S.mute[id] = !S.mute[id]; if (!S.mute[id]) delete S.mute[id]; store.set('tc_mute', S.mute);
      if (!S.mute[id] && typeof Notification !== 'undefined' && Notification.permission === 'default') await Notification.requestPermission();
      toast(S.mute[id] ? '🔕 ปิดแจ้งเตือนห้องนี้บนเครื่องนี้' : '🔔 เปิดแจ้งเตือนห้องนี้'); renderChannels();
    };
    $('btnSearch').onclick = () => setView(S.view === 'search' ? 'room' : 'search');
    $('btnSearchClose').onclick = () => setView('room');
    let qT; $('q').oninput = () => { clearTimeout(qT); qT = setTimeout(renderSearch, 250); };
    $('qAll').onchange = renderSearch;
    $('btnPins').onclick = () => setView(S.view === 'pins' ? 'room' : 'pins');
    $('fCard').onsubmit = submitCard;
    $('fRoom').onsubmit = submitRoom;

    document.addEventListener('click', async (e) => {
      if (e.target.classList.contains('sheet')) { e.target.hidden = true; return; }
      if (e.target.closest('#viewer')) { $('viewer').hidden = true; return; }
      const t = e.target.closest('[data-ch],[data-view],[data-card],[data-close],[data-act],[data-card-act],[data-img],[data-jump],[data-goto],[data-icon],[data-usefolder],#btnLogout,#btnReset,#btnNotifPerm');
      if (!t) { const b = e.target.closest('.bubble'); if (b) { const m = b.parentElement; document.querySelectorAll('.m.act').forEach((x) => x !== m && x.classList.remove('act')); m.classList.toggle('act'); } return; }
      const id = t.dataset.id ? +t.dataset.id : null;
      if (t.dataset.ch) openChannel(t.dataset.ch);
      else if (t.dataset.view) setView(t.dataset.view);
      else if (t.dataset.card) openCardForm(t.dataset.card);
      else if (t.hasAttribute('data-close')) t.closest('.sheet').hidden = true;
      else if (t.dataset.icon) { roomIcon = t.dataset.icon; $('emojiPick').querySelectorAll('button').forEach((b) => b.classList.toggle('sel', b === t)); }
      else if (t.dataset.cardAct) { e.preventDefault(); run('card', { id, action: t.dataset.cardAct, value: t.dataset.cardAct === 'check' ? +t.dataset.v : t.dataset.v }).catch(() => {}); }
      else if (t.dataset.act) {
        const m = S.rows.find((x) => x.id === id); if (!m) return;
        if (t.dataset.act === 'reply') { S.editing = null; S.reply = m; setCtx(`↩ ตอบกลับ ${m.author_name}: ${snippet(m)}`); }
        else if (t.dataset.act === 'edit') { S.reply = null; S.editing = m; $('txt').value = m.body; setCtx('✏️ กำลังแก้ไขข้อความ (Esc = ยกเลิก)'); }
        else if (t.dataset.act === 'delete') { if (confirm('ลบข้อความนี้?')) run('delete', { id }).catch(() => {}); }
        else if (t.dataset.act === 'pin') run('pin', { id, pinned: !m.pinned }).then(() => toast(m.pinned ? 'เลิกปักหมุดแล้ว' : '📌 ปักหมุดแล้ว')).catch(() => {});
      }
      else if (t.dataset.img) { $('viewerImg').src = t.dataset.img; $('viewer').hidden = false; }
      else if (t.dataset.jump) jump(+t.dataset.jump);
      else if (t.dataset.goto) { const ch = t.dataset.gch; if (ch === S.current && S.rows.some((r) => r.id === +t.dataset.goto)) { setView('room'); jump(+t.dataset.goto); } else openChannel(ch, +t.dataset.goto); }
      else if (t.dataset.usefolder) run('use_folder', { channel_id: S.current, drive_id: t.dataset.usefolder }).then((c) => { onChange('tc_channels', 'UPDATE', c); toast('ไฟล์ของห้องนี้จะเก็บในโฟลเดอร์ที่เลือก'); }).catch(() => {});
      else if (t.id === 'btnLogout') { saveMe(null); location.reload(); }
      else if (t.id === 'btnReset' && confirm('ล้างข้อมูลตัวอย่างทั้งหมดในเครื่องนี้?')) api.reset();
      else if (t.id === 'btnNotifPerm' && typeof Notification !== 'undefined') { await Notification.requestPermission(); renderSettings(); }
      else if (t.id === 'btnDriveShare') {
        const out = $('driveShareOut'); out.textContent = 'กำลังแชร์…'; t.disabled = true;
        try {
          const r = await run('drive_share', {});
          out.innerHTML = `เจ้าของโฟลเดอร์: <b>${esc(r.owner)}</b><br>` + r.results.map((x) => `${x.ok ? '✔' : '✖'} ${esc(x.target)}${x.error ? ' — ' + esc(x.error) : ''}`).join('<br>')
            + (r.link ? `<br><a href="${esc(r.link)}" target="_blank" rel="noopener">เปิดโฟลเดอร์ ↗</a>` : '');
        } catch (err) { out.textContent = '✖ ' + err.message; } finally { t.disabled = false; }
      }
    });
    document.addEventListener('change', (e) => {
      const t = e.target;
      if (t.id === 'selPolicy') run('setting', { key: 'approve_policy', value: t.value }).then(() => toast('บันทึกสิทธิ์อนุมัติแล้ว')).catch(() => renderSettings());
      else if (t.dataset.role) run('member_role', { user_id: t.dataset.role, role: t.value }).then((m) => { onChange('tc_members', 'UPDATE', m); toast('เปลี่ยนบทบาทแล้ว'); }).catch(() => renderSettings());
      else if (t.dataset.approver) run('member_role', { user_id: t.dataset.approver, approver: t.checked }).then((m) => onChange('tc_members', 'UPDATE', m)).catch(() => renderSettings());
    });
    $('fLogin').onsubmit = (e) => {
      e.preventDefault(); const f = e.target.elements; const name = f.name.value.trim(); if (!name) return;
      me = { id: 'web:' + name, name, pin: f.pin.value, role: api.mode === 'demo' ? f.role.value : undefined };
      saveMe(me); sheet('loginForm', false); start();
    };
  }

  async function start() {
    try { const m = await api.op('hello', { role: me.role }); if (m && m.user_id) upsert(S.members, m, 'user_id'); }
    catch (e) { toast('เข้าใช้ไม่ได้: ' + e.message, 6000); if (api.mode !== 'demo' && !TG) { saveMe(null); sheet('loginForm', true); return; } }
    try { Object.assign(S, await api.load()); }
    catch (e) { toast('เชื่อมต่อ Supabase ไม่ได้: ' + e.message, 6000); S.channels = [{ id: 'general', name: 'ทั่วไป', icon: '💬' }]; }
    renderMe();
    api.subscribe(onChange);
    openChannel(S.current);
  }

  // ───────────── boot ─────────────
  $('ver').textContent = VERSION;
  $('modeBadge').textContent = api.mode === 'demo' ? 'โหมดตัวอย่าง (เก็บในเครื่อง)' : 'เชื่อม Supabase + Drive';
  if (TG) { TG.ready(); TG.expand(); document.documentElement.dataset.theme = TG.colorScheme; }
  bind();
  me = loadMe();
  if (me) start();
  else {
    $('pinRow').hidden = api.mode === 'demo';
    $('roleRow').hidden = api.mode !== 'demo';
    if (api.mode === 'demo') $('loginHint').textContent = 'โหมดตัวอย่าง — ข้อมูลเก็บในเบราว์เซอร์นี้ · เปิดอีกแท็บด้วยชื่ออื่น/บทบาทอื่นเพื่อลองคุยกันและลองสิทธิ์';
    sheet('loginForm', true); setTimeout(() => $('fLogin').elements.name.focus(), 50);
  }
})();
