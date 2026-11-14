// Team Chat · ค่าเชื่อม Supabase project จริง (ค่าสาธารณะ ใส่ในหน้าเว็บได้)
// ⚠ ห้ามใส่ service_role / sb_secret_ / bot token / Google secret ที่นี่ — ของลับอยู่ใน Edge Function Secrets เท่านั้น
// anonKey ว่าง = โหมดตัวอย่าง (เก็บในเครื่อง)
window.TC_CONFIG = {
  supabaseUrl: 'https://emlwnczeckucjycwjzmd.supabase.co',
  // anon public (role=anon) — ค่าสาธารณะ ใช้อ่านได้อย่างเดียวตาม RLS · Supabase → Project Settings → API Keys → Legacy
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVtbHduY3plY2t1Y2p5Y3dqem1kIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTQ2MjUzMjIsImV4cCI6MjExMDIwMTMyMn0.X2cg_jD_AtC9GcvsysZ3pqzBm8ag7LlRIjtBfCuElgU',
  driveRootUrl: '', // ← ลิงก์โฟลเดอร์ "Team Chat" ใน Drive (ได้จาก tools\get_google_token.py)
};
