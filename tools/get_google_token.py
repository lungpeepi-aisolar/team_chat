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
import urllib.error
import urllib.parse
import urllib.request
import webbrowser

SCOPE = "https://www.googleapis.com/auth/drive.file"
PORT = 8791


def post(url, data, headers=None):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method="POST")
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        try:
            j = json.loads(e.read())
        except Exception:
            j = {}
        raise SystemExit(f"Google ตอบ {e.code}: {j.get('error', '')} {j.get('error_description', '')}".strip())


def check_pair(cid, csec):
    """ตรวจว่า Client ID + secret เป็นคู่เดียวกันก่อนเปิดเบราว์เซอร์ (ส่ง code ปลอม:
    คู่ถูก → invalid_grant · คู่ผิด → invalid_client)"""
    req = urllib.request.Request("https://oauth2.googleapis.com/token", method="POST", data=urllib.parse.urlencode({
        "code": "x", "client_id": cid, "client_secret": csec,
        "redirect_uri": f"http://127.0.0.1:{PORT}/", "grant_type": "authorization_code"}).encode())
    try:
        urllib.request.urlopen(req)
        return True
    except urllib.error.HTTPError as e:
        try:
            err = json.loads(e.read()).get("error", "")
        except Exception:
            err = ""
        return err != "invalid_client"


def _read_client(p):
    """อ่าน client_secret_*.json ที่ดาวน์โหลดจาก Google Cloud (ชนิด Desktop = "installed")"""
    try:
        j = json.loads(p.read_text(encoding="utf-8"))
        c = j.get("installed") or j.get("web") or {}
        return c.get("client_id", ""), c.get("client_secret", "")
    except Exception:
        return "", ""


def find_client_json():
    """หาไฟล์ client_secret_*.json ใน Downloads เอง · ไม่เจอ = เปิดหน้า Google Cloud ให้สร้าง แล้วรอไฟล์ใหม่
    (Google แสดง secret ครั้งเดียวตอนสร้าง client — ต้องกด Download JSON ตอนนั้น)"""
    import os
    import time
    from pathlib import Path
    dl = Path(os.environ.get("USERPROFILE", str(Path.home()))) / "Downloads"
    here = Path(__file__).resolve().parent.parent
    seen = set()

    def candidates():
        fs = list(dl.glob("client_secret_*.json")) + list(here.glob("client_secret_*.json"))
        return sorted(fs, key=lambda f: f.stat().st_mtime, reverse=True)

    for f in candidates():
        seen.add(f)
        cid, csec = _read_client(f)
        if cid and csec and check_pair(cid, csec):
            print(f"  ✔ ใช้ไฟล์ {f.name} (Client ID กับ secret ถูกต้อง)")
            return cid, csec
        print(f"  ✖ ไฟล์ {f.name} ใช้ไม่ได้ (client ถูกลบหรือ secret ไม่ตรง) — ข้าม")

    url = "https://console.cloud.google.com/auth/clients/create"
    print("\n  ยังไม่มีไฟล์ client — เปิดหน้า Google Cloud ให้แล้ว ทำ 4 คลิก:")
    print("   1) มุมบนเลือก project ที่สร้างไว้ (Team Chat) และบัญชีที่ถูกต้อง")
    print("   2) Application type = Desktop app → Name อะไรก็ได้ → กด Create")
    print("   3) กล่อง 'OAuth client created' → กด  Download JSON  (ไฟล์ลง Downloads)")
    print("   4) กด OK ปิดกล่อง — หน้าต่างนี้จะเจอไฟล์และไปต่อเอง")
    print(f"   (ถ้าเบราว์เซอร์ไม่เปิด: {url})\n")
    try:
        os.startfile(url)
    except Exception:
        webbrowser.open(url)
    deadline = time.time() + 15 * 60
    while time.time() < deadline:
        for f in candidates():
            if f in seen:
                continue
            seen.add(f)
            time.sleep(1)  # รอเขียนไฟล์เสร็จ
            cid, csec = _read_client(f)
            if cid and csec and check_pair(cid, csec):
                print(f"  ✔ เจอไฟล์ {f.name} — Client ID กับ secret ถูกต้อง")
                return cid, csec
            print(f"  ✖ ไฟล์ {f.name} ใช้ไม่ได้ — รอไฟล์ถัดไป")
        time.sleep(3)
    sys.exit("รอไฟล์ client_secret_*.json เกิน 15 นาที — รัน setup-all.bat ใหม่")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--env", required=True, help="ไฟล์ที่จะเขียน GOOGLE_* (ค่าลับ)")
    ap.add_argument("--folder-url", required=True, help="ไฟล์ที่จะเขียนลิงก์โฟลเดอร์ (ไม่ลับ)")
    a = ap.parse_args()

    print("\n── Google Drive ──")
    cid, csec = find_client_json()

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
