# Team Chat · แชททีม (Telegram Mini App + Supabase + Google Drive)

โดย ลุงพี · v0.1.0 (ต้นแบบ) · โฟลเดอร์ `<ไดรฟ์>:\LocalAI\teamchat`

```
[หน้าเว็บ web/  ← เปิดใน Telegram (Mini App) หรือเบราว์เซอร์]
      │ อ่าน + realtime                 │ เขียน (ตรวจสิทธิ์)
      ▼                                 ▼
[Supabase: tc_channels, tc_messages] ← [Edge Function "teamchat"] → Google Drive (โฟลเดอร์ Team Chat)
                                              ↕
                                     Telegram Bot ↔ กลุ่ม Telegram ของทีม
```

## 1. เปิดดูตัวอย่าง (ไม่ต้องมีบัญชีอะไร)
1. ดับเบิลคลิก **Team Chat** บน Desktop (หรือ `TeamChat.bat` ในโฟลเดอร์นี้)
2. เบราว์เซอร์เปิด `http://127.0.0.1:8790` → ใส่ชื่อ + เลือกบทบาท (ผู้ดูแล/สมาชิก) → เข้าใช้
3. ลองคุยกัน 2 คน/ลองสิทธิ์: เปิดแท็บใหม่ที่อยู่เดียวกัน → "เปลี่ยนชื่อ" (มุมซ้ายล่าง) เป็นอีกชื่อ/อีกบทบาท
4. ปิดหน้าต่าง cmd = ปิดโปรแกรม · ข้อมูลตัวอย่างอยู่ในเบราว์เซอร์นี้เท่านั้น (⚙️ → "ล้างข้อมูลตัวอย่าง")

### ความสามารถ
| ส่วน | ใช้ยังไง |
|---|---|
| **ห้องแชท** | "＋ ห้องใหม่" (ตั้งชื่อตามโปรเจกต์/ไซต์ · เลือกไอคอน · ติ๊กสร้างโฟลเดอร์ Drive ได้เลย) · ⋯ = เปลี่ยนชื่อ/ไอคอน/แจ้ง Telegram/ลบห้อง — ทำได้เฉพาะ **ผู้สร้างห้องหรือผู้ดูแล** · ลบห้องแล้วไฟล์ใน Drive ยังอยู่ |
| **โฟลเดอร์ Drive ของห้อง** | 📁 ที่หัวห้อง → สร้างโฟลเดอร์ย่อยใน Drive บริษัท ชื่อ **[ชื่องาน] - [ผู้สร้าง]** · เลือก ● ว่าไฟล์ที่แนบในห้องเข้าโฟลเดอร์ไหน |
| **โฟลเดอร์เอกสาร** | แถบซ้าย 📁 = รวมทุกโฟลเดอร์ที่สร้างผ่าน Team Chat แยกตามห้อง · กดเปิดใน Drive / ไปที่ห้อง |
| **การ์ด** ➕ | 🏗️ รายงานหน้างาน (วันที่ · ช่าง · % · หมายเหตุ · หลายรูป) · ✅ ขออนุมัติ · ☑️ เช็กลิสต์ (ติ๊กทีละข้อ เห็นใครติ๊ก) · 🛠️ ใบงาน (ช่างที่รับงาน · สถานที่ · กำหนดเสร็จ · รอ→กำลังทำ→เสร็จ) · 📅 นัดหมาย (ตอบรับ · ลง Google Calendar) |
| **จัดการข้อความ** | ชี้ (คอม) หรือแตะ (มือถือ) ที่ข้อความ → ↩ ตอบกลับ · 📌 ปักหมุด · ✏️ แก้ไข (ของตัวเอง) · 🗑 ลบ (ของตัวเอง · ผู้ดูแลลบได้ทุกข้อความ) |
| **ค้นหา** 🔍 | ค้นข้อความ ชื่อไฟล์ เนื้อหาการ์ด · ห้องนี้หรือติ๊ก "ทุกห้อง" · กดผลเพื่อกระโดดไปที่ข้อความ |
| **ปักหมุด** 📌 | ตัวเลขที่หัวห้อง = จำนวนปักหมุด · กดเพื่อดูรายการ |
| **แจ้งเตือน** | 🔔/🔕 ที่หัวห้อง = เปิด/ปิดแจ้งเตือนบนเครื่องนี้ทีละห้อง · ⋯ ตั้งค่าห้อง = แจ้งเข้ากลุ่ม Telegram หรือไม่ |
| **สิทธิ์** ⚙️ | ผู้ดูแลตั้งได้: ใครอนุมัติได้ (ผู้ดูแลเท่านั้น / ผู้ดูแล + คนที่ติ๊ก "อนุมัติได้" / ทุกคน) · เปลี่ยนบทบาทสมาชิก · ต้องมีผู้ดูแลอย่างน้อย 1 คน |

## 2. ต่อของจริง (ทำครั้งเดียว ~30–45 นาที)
### 2.1 Supabase — ไม่ต้องสมัครบัญชีใหม่
- ใช้บัญชีเดิม: สร้าง project ใหม่ชื่อ `teamchat` (แพ็กเกจฟรีมีโควตา project ที่เปิดพร้อมกันได้จำกัด) **หรือ** ใส่ลง project เดิมก็ได้ เพราะทุกตารางขึ้นต้น `tc_` ไม่ชนของเดิม
- รัน `supabase\schema.sql` ใน SQL Editor ของ project นั้น
- คัดลอก `web\config.example.js` → `web\config.js` แล้วใส่ Project URL + anon key (Settings → API)

### 2.2 Telegram Bot
1. คุยกับ @BotFather → `/newbot` → ได้ **bot token**
2. `/newapp` (ผูก Mini App กับบอท) → ใส่ URL หน้าเว็บ (https://team-chat.pages.dev) → ได้ลิงก์ `t.me/<bot>/<app>`
3. เพิ่มบอทเข้ากลุ่มทีม · ปิด privacy (`/setprivacy` → Disable) เพื่อให้บอทเห็นข้อความในกลุ่ม
4. หา chat id ของกลุ่ม (ส่งข้อความในกลุ่ม แล้วเปิด `https://api.telegram.org/bot<token>/getUpdates` ดู `chat.id` ค่าติดลบ)

### 2.3 Google Drive
1. Google Cloud Console → สร้าง project → เปิด **Google Drive API**
2. OAuth consent screen (External · Testing · เพิ่มอีเมลตัวเองเป็น test user) → Credentials → OAuth client ID ชนิด **Desktop app**
3. `py tools\get_google_token.py <CLIENT_ID> <CLIENT_SECRET>` → ล็อกอิน → สคริปต์สร้างโฟลเดอร์ "Team Chat" ใน Drive และพิมพ์คำสั่ง `supabase secrets set ...` ให้
   - ใช้บัญชี Google ของบริษัท · ถ้าบริษัทมี Shared Drive ย้ายโฟลเดอร์ "Team Chat" เข้าไปได้ (แอปยังเขียนได้ เพราะเป็นโฟลเดอร์ที่แอปสร้างเอง) · ห้องที่สร้างโฟลเดอร์จะเป็นโฟลเดอร์ย่อยอยู่ในนี้
   - ⚠ โหมด Testing ของ Google: refresh token หมดอายุใน 7 วัน → ใช้จริงให้กด "Publish app" (ใช้เองไม่ต้องผ่านรีวิวเพราะขอแค่ drive.file)

### 2.4 Deploy Edge Function (ใส่ ADMIN_IDS = ไอดีผู้ดูแลเริ่มต้น เช่น `tg:123456789` ดูไอดีจาก @userinfobot) (Supabase CLI: `npx supabase`)
```bat
cd /d F:\LocalAI\teamchat
npx supabase login
npx supabase link --project-ref <project-ref>
npx supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=-100... TELEGRAM_WEBHOOK_SECRET=<สุ่มเอง> TEAM_PIN=<รหัสทีม> ADMIN_IDS=tg:<ไอดี Telegram ลุงพี> TELEGRAM_APP_LINK=https://t.me/<bot>/<app>
npx supabase secrets set GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... GOOGLE_REFRESH_TOKEN=... DRIVE_FOLDER_ID=...
npx supabase functions deploy teamchat --no-verify-jwt
```
ตั้ง webhook ให้ข้อความจากกลุ่ม Telegram ไหลเข้าแอป (เปิดใน เบราว์เซอร์ครั้งเดียว):
`https://api.telegram.org/bot<token>/setWebhook?url=https://<project-ref>.supabase.co/functions/v1/teamchat/tg-webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>`

### 2.5 ขึ้นเว็บ https
Cloudflare Pages ดึงโฟลเดอร์ `web` จาก GitHub `lungpeepi-aisolar/team_chat` อัตโนมัติทุกครั้งที่ push (ตั้งครั้งเดียว ดู SETUP.md ขั้นที่ 1) → ใส่ URL ใน @BotFather (`/myapps` → Edit Web App URL)

**ขั้นตอนต่อระบบจริงทีละขั้น: ดู [SETUP.md](SETUP.md)**

## 3. ความปลอดภัย (ต้นแบบ)
- ของลับ (bot token · Google secret · service role) อยู่ใน **Supabase secrets** เท่านั้น ไม่อยู่ในหน้าเว็บ/ git
- การเขียนทุกครั้งผ่าน Edge Function `/op/<คำสั่ง>`: ตรวจลายเซ็น Telegram initData (หรือรหัสทีมเมื่อเปิดจากเบราว์เซอร์) + กติกาสิทธิ์ชุดเดียวกับหน้าจอ · จำกัดคนด้วย `ALLOWED_TG_IDS`
- ⚠ คนที่เข้าจากเบราว์เซอร์ด้วยรหัสทีมพิมพ์ชื่ออะไรก็ได้ → ผู้ดูแลควรเข้าผ่าน Telegram เท่านั้น (ไอดี tg: ปลอมไม่ได้)
- ⚠ **การอ่าน**: ต้นแบบเปิดให้ anon อ่านตารางได้ (เพื่อ realtime) — ใครมี URL + anon key อ่านแชทได้ · ก่อนใช้กับงานจริงต้องเปลี่ยนเป็น Supabase Auth + RLS ตามผู้ใช้
- รูป/ไฟล์ดูผ่าน `/file?id=` ได้เฉพาะไฟล์ที่อยู่ในข้อความที่ยังไม่ถูกลบ (Drive ไม่ได้เปิดสาธารณะ)
- ลบข้อความ/ห้อง = ซ่อน (soft delete) ไม่ลบไฟล์ใน Drive

## 4. ข้อจำกัดที่รู้แล้ว
- Telegram Bot ดาวน์โหลดไฟล์จากกลุ่มได้ ≤20MB · อัปผ่านแอปจำกัดที่ `MAX_UPLOAD_MB` (ค่าเริ่ม 20)
- ปุ่ม Mini App ในกลุ่มต้องเป็นลิงก์ `t.me/<bot>/<app>` (ปุ่ม web_app ใช้ได้เฉพาะแชทส่วนตัว)
- Google Photos API ไม่ใช้ (ตั้งแต่ มี.ค. 2025 อ่านคลังรูปผู้ใช้ไม่ได้แล้ว) → เก็บรูปใน Drive แทน

## ไฟล์
| ไฟล์ | หน้าที่ |
|---|---|
| `web/index.html` `app.js` `style.css` | หน้าแอป (ไม่ต้อง build) |
| `web/config.js` | ค่า Supabase (ว่าง = โหมดตัวอย่าง · ไม่ขึ้น git) |
| `supabase/schema.sql` | ตาราง + สิทธิ์ + realtime |
| `supabase/functions/teamchat/index.ts` | Edge Function (Drive · Telegram · ตรวจสิทธิ์) |
| `tools/get_google_token.py` | ขอ refresh token + สร้างโฟลเดอร์ Drive |
| `TeamChat.bat` · `make-shortcut.ps1` · `teamchat.ico` | เปิดโปรแกรม · ไอคอน Desktop |
