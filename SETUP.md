# Team Chat · ขั้นตอนต่อระบบจริง (ทำครั้งเดียว ตามลำดับ)

ระบบจริงของลุงพี
| ส่วน | ที่อยู่ |
|---|---|
| โค้ด | https://github.com/lungpeepi-aisolar/team_chat |
| หน้าเว็บ (Mini App) | https://team-chat.pages.dev (Cloudflare Pages · ดึงจาก GitHub อัตโนมัติทุกครั้งที่ push) |
| Supabase | project `emlwnczeckucjycwjzmd` · https://supabase.com/dashboard/project/emlwnczeckucjycwjzmd |
| Google Drive | บัญชีบริษัท peerapong@proinventive.co.th (สำรอง: lungpee.pi@gmail.com) |

> ✋ = ลุงพีทำเอง (ล็อกอิน/สร้างบอท/ค่าลับ) · 🤖 = Claude ทำให้
> ค่าลับ (bot token, client secret, refresh token) **ใส่ในหน้า Secrets ของ Supabase เองเท่านั้น** ห้ามวางในแชท

---

## ขั้นที่ 1 · GitHub + Cloudflare Pages ✋ (5 นาที)
1. ✅ repo เป็น Public แล้ว
2. ล็อกอิน github.com ด้วย `lungpeepi-aisolar` → https://github.com/lungpeepi-aisolar/team_chat/settings/access → **Add people** → พิมพ์ **`peeraponggis`** (บัญชีของ Claude ไม่ใช่ lungpeepi-aisolar) → สิทธิ์ **Write** → แล้วกดรับคำเชิญในอีเมลของ peeraponggis (ตอนนี้ Claude ยังมีแค่สิทธิ์อ่าน push ไม่ได้)
3. 🤖 Claude push โค้ด
4. Cloudflare (บัญชีของ lungpeepi): https://dash.cloudflare.com/1b74ba852ae56d2124e0680aba65944d/workers-and-pages/create/pages
   → **Import an existing Git repository** (Connect to Git) → อนุญาต GitHub `lungpeepi-aisolar` → เลือก `team_chat`
   → Project name `team-chat` · Production branch `main` · Framework preset **None** · Build command **เว้นว่าง** · Build output directory **`web`** → Save and Deploy
5. ได้ที่อยู่ `https://team-chat.pages.dev` (ถ้าชื่อซ้ำ Cloudflare จะเติมท้าย — ส่งที่อยู่จริงให้ Claude) · ต่อจากนี้ push เมื่อไรหน้าเว็บอัปเดตเอง

## ขั้นที่ 2 · Supabase ✅ เสร็จแล้ว (14 พ.ย. 2569 — ตารางครบ · anon key ใส่ใน config.js แล้ว)
1. เปิด SQL Editor: https://supabase.com/dashboard/project/emlwnczeckucjycwjzmd/sql/new
2. เปิดไฟล์ `F:\LocalAI\teamchat\supabase\schema.sql` → คัดลอกทั้งหมด → วาง → **Run** (ต้องขึ้น Success)
3. เอาคีย์ **anon public**: เปิด https://supabase.com/dashboard/project/emlwnczeckucjycwjzmd/settings/api-keys/legacy
   (เมนูซ้าย ⚙️ Project Settings → **API Keys** → แท็บ **Legacy API Keys**) → แถว **anon** `public` → กด **Copy** (ขึ้นต้น `eyJ…` ยาวมาก)
   → ส่งให้ Claude ในแชทได้ (เป็นค่าสาธารณะ) 🤖 Claude ใส่ใน `web\config.js`
   - ไม่มีแท็บ Legacy: ใช้ **Publishable key** (ขึ้นต้น `sb_publishable_`) ในหน้าเดียวกันแทนได้
   - ⚠ ห้ามส่งแถว `service_role` `secret` หรือคีย์ `sb_secret_…`

## ขั้นที่ 3 · Telegram ✋ (5 นาที)
1. ในแอป Telegram คุยกับ **@BotFather** → `/newbot` → ตั้งชื่อ เช่น `ProInventive Team Chat` และ username ลงท้าย `bot` → ได้ **token** (เก็บไว้ ใช้ขั้นที่ 5)
2. `/setprivacy` → เลือกบอท → **Disable** (ให้บอทเห็นข้อความในกลุ่ม)
3. `/newapp` → เลือกบอท → ชื่อ `Team Chat` → URL = `https://team-chat.pages.dev` (ที่อยู่จริงจากขั้นที่ 1) → short name `chat` → ได้ลิงก์ `https://t.me/<ชื่อบอท>/chat`
4. สร้างกลุ่มทีม (หรือใช้กลุ่มเดิม) → เพิ่มบอทเข้ากลุ่ม → พิมพ์อะไรก็ได้ 1 ข้อความ
5. หาไอดีกลุ่ม: เปิดในเบราว์เซอร์ `https://api.telegram.org/bot<token>/getUpdates` → ดู `"chat":{"id":-100…}` (ค่าติดลบ)
6. หาไอดีตัวเอง: คุยกับ **@userinfobot** → ได้ตัวเลข `Id` (ใช้เป็นผู้ดูแลคนแรก)

## ขั้นที่ 4 · Google Drive ✋ (10 นาที · ใช้ peerapong@proinventive.co.th)
1. https://console.cloud.google.com/projectcreate → ชื่อ `Team Chat` → Create
2. https://console.cloud.google.com/apis/library/drive.googleapis.com → **Enable**
3. https://console.cloud.google.com/auth/branding → ตั้งชื่อแอป `Team Chat` + อีเมล → Audience = **Internal** (บัญชีบริษัท: ไม่ต้องรีวิว ไม่หมดอายุ 7 วัน)
   - ถ้าต้องใช้ lungpee.pi@gmail.com: เลือก **External** แล้วกด **Publish app** (ไม่งั้นสิทธิ์หมดทุก 7 วัน)
4. https://console.cloud.google.com/auth/clients → Create client → ชนิด **Desktop app** → ได้ **Client ID + Client secret**
5. ดับเบิลคลิก `F:\LocalAI\teamchat\google-token.bat` → วาง Client ID / secret → ล็อกอิน Google → กดอนุญาต
   - สคริปต์สร้างโฟลเดอร์ **Team Chat** ใน Drive และแสดง 4 ค่าให้ใส่ขั้นที่ 5 + ลิงก์โฟลเดอร์ (ส่งลิงก์ให้ Claude ได้)
   - ถ้าบริษัทมี Shared Drive: ย้ายโฟลเดอร์ Team Chat เข้าไปได้ แอปยังเขียนได้ตามเดิม

## ขั้นที่ 5 · ใส่ค่าลับ ✋ (3 นาที)
เปิด https://supabase.com/dashboard/project/emlwnczeckucjycwjzmd/functions/secrets → Add new secret ทีละตัว:

| Name | Value |
|---|---|
| `TELEGRAM_BOT_TOKEN` | token จาก @BotFather |
| `TELEGRAM_CHAT_ID` | ไอดีกลุ่ม (-100…) |
| `TELEGRAM_WEBHOOK_SECRET` | ตั้งเอง ภาษาอังกฤษ/ตัวเลข 20 ตัวขึ้นไป |
| `TELEGRAM_APP_LINK` | `https://t.me/<ชื่อบอท>/chat` |
| `ADMIN_IDS` | `tg:<ไอดีตัวเอง>` (หลายคนคั่นด้วย ,) |
| `TEAM_PIN` | รหัสทีมสำหรับเปิดจากเบราว์เซอร์ (ไม่ใส่ = ใช้ได้เฉพาะใน Telegram) |
| `GOOGLE_CLIENT_ID` `GOOGLE_CLIENT_SECRET` `GOOGLE_REFRESH_TOKEN` `DRIVE_FOLDER_ID` | จาก google-token.bat |

## ขั้นที่ 6 · อัป Edge Function ✋ (2 นาที)
1. ดับเบิลคลิก `F:\LocalAI\teamchat\deploy-function.bat` → ครั้งแรกเบราว์เซอร์เปิดให้ล็อกอิน Supabase → กดยืนยัน
2. รอจนขึ้น "เสร็จแล้ว"

## ขั้นที่ 7 · ต่อข้อความกลุ่ม Telegram เข้าแอป ✋ (1 นาที)
เปิดในเบราว์เซอร์ (แทน `<token>` และ `<secret>` ด้วยค่าจริง):
```
https://api.telegram.org/bot<token>/setWebhook?url=https://emlwnczeckucjycwjzmd.supabase.co/functions/v1/teamchat/tg-webhook&secret_token=<secret>
```
ต้องขึ้น `"ok":true`

## ขั้นที่ 8 · ทดสอบ 🤖 + ✋
- 🤖 Claude ทดสอบหน้าเว็บจริง (ส่งข้อความ · แนบไฟล์ขึ้น Drive · สร้างห้อง/โฟลเดอร์)
- ✋ ลุงพีเปิด `https://t.me/<ชื่อบอท>/chat` ในมือถือ → ส่งข้อความ → ดูว่าเด้งเข้ากลุ่ม Telegram และพิมพ์ในกลุ่มแล้วเข้าแอป
