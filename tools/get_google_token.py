"""Team Chat · ขอ Google refresh token + สร้างโฟลเดอร์ "Team Chat" ใน Drive (โดย ลุงพี)

รันครั้งเดียวบนเครื่องที่มีเบราว์เซอร์:
    py tools\\get_google_token.py <CLIENT_ID> <CLIENT_SECRET>

CLIENT_ID/SECRET มาจาก Google Cloud Console → APIs & Services → Credentials → OAuth client ID ชนิด "Desktop app"
สิทธิ์ที่ขอ = drive.file (เห็นเฉพาะไฟล์ที่ Team Chat สร้างเอง ไม่เห็นไฟล์อื่นใน Drive)
ผลลัพธ์: แสดง 4 ค่าให้คัดลอกไปใส่ Supabase → Edge Functions → Secrets — ไม่บันทึกค่าลับลงไฟล์
"""
import http.server
import json
import secrets
import sys
import urllib.parse
import urllib.request
import webbrowser

SCOPE = "https://www.googleapis.com/auth/drive.file"
PORT = 8791


def post(url, data, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST")
    with urllib.request.urlopen(req) as r:
        return json.loads(r.read())


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    cid, csec = sys.argv[1], sys.argv[2]
    redirect = f"http://127.0.0.1:{PORT}/"
    state = secrets.token_urlsafe(16)
    url = "https://accounts.google.com/o/oauth2/v2/auth?" + urllib.parse.urlencode({
        "client_id": cid, "redirect_uri": redirect, "response_type": "code", "scope": SCOPE,
        "access_type": "offline", "prompt": "consent", "state": state,
    })
    got = {}

    class H(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            q = urllib.parse.parse_qs(urllib.parse.urlparse(self.path).query)
            if q.get("state", [""])[0] == state and "code" in q:
                got["code"] = q["code"][0]
                msg = "เรียบร้อย ปิดหน้านี้ได้ แล้วกลับไปดูหน้าต่าง cmd"
            else:
                msg = "ไม่สำเร็จ: " + q.get("error", ["ไม่มี code"])[0]
            self.send_response(200)
            self.send_header("content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"<h2 style='font-family:sans-serif'>{msg}</h2>".encode())

        def log_message(self, *a):
            pass

    print("กำลังเปิดเบราว์เซอร์ให้ล็อกอิน Google (บัญชีที่จะเป็นเจ้าของไฟล์แชท)…")
    webbrowser.open(url)
    srv = http.server.HTTPServer(("127.0.0.1", PORT), H)
    while "code" not in got:
        srv.handle_request()

    tok = post("https://oauth2.googleapis.com/token", urllib.parse.urlencode({
        "code": got["code"], "client_id": cid, "client_secret": csec,
        "redirect_uri": redirect, "grant_type": "authorization_code",
    }).encode())
    refresh = tok.get("refresh_token")
    if not refresh:
        sys.exit("ไม่ได้ refresh_token — ลองถอนสิทธิ์แอปที่ myaccount.google.com/permissions แล้วรันใหม่")

    folder = post("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
                  json.dumps({"name": "Team Chat", "mimeType": "application/vnd.google-apps.folder"}).encode(),
                  {"authorization": "Bearer " + tok["access_token"], "content-type": "application/json"})

    print("\nสร้างโฟลเดอร์ใน Drive แล้ว:", folder.get("webViewLink"))
    print("  → คัดลอกลิงก์นี้ไปใส่ใน web\\config.js ช่อง driveRootUrl")
    print("\nนำ 4 ค่านี้ไปใส่ที่ Supabase → Edge Functions → Secrets (ค่าลับ — อย่าวางในแชท/ไฟล์):")
    print("  https://supabase.com/dashboard/project/emlwnczeckucjycwjzmd/functions/secrets\n")
    for k, v in (("GOOGLE_CLIENT_ID", cid), ("GOOGLE_CLIENT_SECRET", csec),
                 ("GOOGLE_REFRESH_TOKEN", refresh), ("DRIVE_FOLDER_ID", folder["id"])):
        print(f"  {k:<22} = {v}")
    input("\nกด Enter เพื่อปิด…")


if __name__ == "__main__":
    main()
