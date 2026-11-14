// คัดลอกไฟล์นี้เป็น config.js แล้วใส่ค่าของ project Supabase (ค่าทั้งสองนี้เป็นค่าสาธารณะ ใส่ในหน้าเว็บได้)
// ⚠ ห้ามใส่ service_role key / bot token / Google secret ที่นี่ — ของลับอยู่ใน Edge Function secrets เท่านั้น
window.TC_CONFIG = {
  supabaseUrl: 'https://<project-ref>.supabase.co',
  anonKey: '<anon public key>',
  // functionUrl: 'https://<project-ref>.supabase.co/functions/v1/teamchat', // (ไม่ต้องใส่ ถ้าใช้ชื่อมาตรฐาน)
};
