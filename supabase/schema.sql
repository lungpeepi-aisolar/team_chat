-- Team Chat (ทีมแชท) · โครงฐานข้อมูล Supabase · โดย ลุงพี
-- รันใน SQL Editor ของ project ที่จะใช้ (รันซ้ำได้ ไม่ลบข้อมูลเดิม)
-- ทุกตารางขึ้นต้น tc_ จึงวางรวมกับ project เดิมได้โดยไม่ชนกัน

-- ห้องแชท (ลบ = ใส่ deleted_at · ไฟล์ใน Drive ไม่ถูกลบ)
create table if not exists public.tc_channels (
  id               text primary key,
  name             text not null,
  icon             text default '💬',
  notify           boolean default true,      -- แจ้งเข้ากลุ่ม Telegram
  created_by       text,
  created_by_name  text,
  drive_folder_id  text,                      -- โฟลเดอร์ที่ไฟล์ของห้องนี้จะเข้าไปเก็บ
  sort             int default 0,
  created_at       timestamptz default now(),
  deleted_at       timestamptz
);

-- โฟลเดอร์ย่อยใน Google Drive บริษัท ที่สร้างผ่าน Team Chat · ชื่อ "[ชื่องาน] - [ผู้สร้าง]"
create table if not exists public.tc_folders (
  id               bigint generated always as identity primary key,
  channel_id       text references public.tc_channels(id),
  name             text not null,
  drive_id         text not null unique,
  web_link         text,
  created_by       text,
  created_by_name  text,
  created_at       timestamptz default now()
);

create table if not exists public.tc_messages (
  id           bigint generated always as identity primary key,
  channel_id   text not null references public.tc_channels(id),
  author_id    text not null,                 -- 'tg:<telegram id>' หรือ 'web:<ชื่อ>'
  author_name  text not null,
  kind         text not null default 'text',  -- text | file | report | approval | checklist | workorder | appointment
  body         text,
  data         jsonb default '{}'::jsonb,
  file_ids     text[] default '{}',           -- ไอดีไฟล์ Drive ในข้อความ (ใช้ตรวจสิทธิ์เปิดไฟล์)
  reply_to     bigint,
  pinned       boolean default false,
  pinned_by    text,
  source       text default 'app',            -- app | telegram
  created_at   timestamptz default now(),
  edited_at    timestamptz,
  deleted_at   timestamptz,
  deleted_by   text,
  search_text  text generated always as (lower(coalesce(body, '') || ' ' || coalesce(data::text, ''))) stored
);
create index if not exists tc_messages_channel_idx on public.tc_messages(channel_id, id desc);
create index if not exists tc_messages_files_idx on public.tc_messages using gin(file_ids);

-- สมาชิก + บทบาท (admin = ผู้ดูแล) + สิทธิ์อนุมัติ
create table if not exists public.tc_members (
  user_id     text primary key,
  name        text not null,
  role        text not null default 'member' check (role in ('admin', 'member')),
  approver    boolean default false,
  last_seen   timestamptz default now()
);

create table if not exists public.tc_settings (
  key    text primary key,
  value  text
);

insert into public.tc_channels(id, name, icon, sort) values ('general', 'ทั่วไป', '💬', 1) on conflict (id) do nothing;
insert into public.tc_settings(key, value) values ('approve_policy', 'admin') on conflict (key) do nothing;

-- ── สิทธิ์ ──────────────────────────────────────────────
-- เขียนได้ทางเดียว: Edge Function "teamchat" (service role + ตรวจ Telegram initData / รหัสทีม + กติกาสิทธิ์)
-- อ่าน: ต้นแบบเปิดให้ anon อ่าน เพื่อใช้ Realtime ง่าย ๆ
--   ⚠ ใครมี URL หน้าเว็บ + anon key อ่านแชทได้ → ก่อนใช้งานจริงเปลี่ยนเป็น Supabase Auth + RLS ตามผู้ใช้
do $$ declare t text; begin
  foreach t in array array['tc_channels','tc_folders','tc_messages','tc_members','tc_settings'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to anon, authenticated using (true)', t || '_read', t);
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null; end;
  end loop;
end $$;
