"""Team Chat · ขอ Google refresh token + สร้างโฟลเดอร์ "Team Chat" ใน Drive (โดย ลุงพี)

ปกติเรียกจาก setup-all.bat (ไม่ต้องรันเอง):
    py -I tools\\get_google_token.py --env <ไฟล์ชั่วคราว> --folder-url <ไฟล์เก็บลิงก์>

ถาม Client ID / Client secret ทางหน้าจอ (secret พิมพ์แล้วไม่แสดง) — มาจาก Google Cloud Console →
Google Auth Platform → Clients → ชนิด "Desktop app"
สิทธิ์ที่ขอ = drive.file (เห็นเฉพาะไฟล์ที่ Team Chat สร้างเอง ไม่เห็นไฟล์อื่นใน Drive)
ค่าลับเขียนลงไฟล์ --env เท่านั้น (setup-all ส่งเข้า Supabase Secrets แล้วลบไฟล์ทิ้ง) — ไม่แสดงบนจอ
"""
import argparse
import getpass
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
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True, help="ไฟล์ที่จะเขียน GOOGLE_* (ค่าลับ)")
    ap.add_argument("--folder-url", required=True, help="ไฟล์ที่จะเขียนลิงก์โฟลเดอร์ (ไม่ลับ)")
    a = ap.parse_args()

    print("\n── Google Drive ──")
    cid = input("วาง Client ID แล้วกด Enter: ").strip()
    csec = getpass.getpass("วาง Client secret แล้วกด Enter (จะไม่แสดงบนจอ): ").strip()
    if not cid or not csec:
        sys.exit("ไม่ได้ใส่ Client ID / secret")

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
                msg = "เรียบร้อย ปิดหน้านี้ได้ แล้วกลับไปดูหน้าต่างติดตั้ง"
            else:
                got["error"] = q.get("error", ["ไม่มี code"])[0]
                msg = "ไม่สำเร็จ: " + got["error"]
            self.send_response(200)
            self.send_header("content-type", "text/html; charset=utf-8")
            self.end_headers()
            self.wfile.write(f"<h2 style='font-family:sans-serif'>{msg}</h2>".encode())

        def log_message(self, *x):
            pass

    print("กำลังเปิดเบราว์เซอร์ → เลือกบัญชีที่สร้าง client → กด Continue/Allow")
    print("\nถ้าเบราว์เซอร์ไม่เปิดเอง: คัดลอกลิงก์ทั้งบรรทัดด้านล่าง ไปวางในช่องที่อยู่ของ Chrome แล้วกด Enter\n")
    print(url + "\n")
    try:
        import os
        os.startfile(url)  # Windows: เปิดด้วยเบราว์เซอร์หลัก
    except Exception:
        webbrowser.open(url)
    print("…รอการกดอนุญาตในเบราว์เซอร์ (หน้าต่างนี้จะไปต่อเอง)")
    srv = http.server.HTTPServer(("127.0.0.1", PORT), H)
    while "code" not in got and "error" not in got:
        srv.handle_request()
    if "error" in got:
        sys.exit("Google ไม่อนุญาต: " + got["error"])

    tok = post("https://oauth2.googleapis.com/token", urllib.parse.urlencode({
        "code": got["code"], "client_id": cid, "client_secret": csec,
        "redirect_uri": redirect, "grant_type": "authorization_code",
    }).encode())
    refresh = tok.get("refresh_token")
    if not refresh:
        sys.exit("ไม่ได้ refresh_token — ถอนสิทธิ์แอปที่ myaccount.google.com/permissions แล้วรันใหม่")

    folder = post("https://www.googleapis.com/drive/v3/files?fields=id,webViewLink",
                  json.dumps({"name": "Team Chat", "mimeType": "application/vnd.google-apps.folder"}).encode(),
                  {"authorization": "Bearer " + tok["access_token"], "content-type": "application/json"})

    with open(a.env, "a", encoding="utf-8") as f:
        f.write(f"GOOGLE_CLIENT_ID={cid}\nGOOGLE_CLIENT_SECRET={csec}\n"
                f"GOOGLE_REFRESH_TOKEN={refresh}\nDRIVE_FOLDER_ID={folder['id']}\n")
    with open(a.folder_url, "w", encoding="utf-8") as f:
        f.write(folder.get("webViewLink", ""))
    print("✔ สร้างโฟลเดอร์ Team Chat ใน Drive แล้ว:", folder.get("webViewLink"))


if __name__ == "__main__":
    main()
