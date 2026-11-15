"""Team Chat · ทำการ์ด QR ส่งทีมงาน (โดย ลุงพี) — py -I tools\\make_qr.py
ได้ assets\\teamchat-qr-card.png (แนวตั้ง ส่งใน LINE/Telegram/พิมพ์ติดผนังได้)
ใช้ segno ที่ติดตั้งไว้ใน tools\\_vendor (pip install --target tools\\_vendor segno)
"""
import io
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE / "_vendor"))
import segno  # noqa: E402
from PIL import Image, ImageDraw, ImageFont  # noqa: E402

ROOT = HERE.parent
APP = "https://t.me/ProInventive_Chat_bot/chat"
WEB = "https://teamchat-eih.pages.dev"
F = r"C:\Windows\Fonts"
font = lambda name, size: ImageFont.truetype(f"{F}\\{name}", size)
B, R = "LeelaUIb.ttf", "LeelawUI.ttf"


def qr(data, px):
    buf = io.BytesIO()
    segno.make(data, error="m").save(buf, kind="png", scale=20, border=2)
    return Image.open(buf).convert("RGB").resize((px, px), Image.NEAREST)


W, H = 1080, 1700
img = Image.new("RGB", (W, H), "white")
d = ImageDraw.Draw(img)
for y in range(300):  # หัวไล่สี
    t = y / 300
    d.line([(0, y), (W, y)], fill=(int(30 + 20 * t), int(120 - 40 * t), int(220 - 80 * t)))
icon = Image.open(ROOT / "teamchat.ico").convert("RGBA").resize((170, 170), Image.LANCZOS)
img.paste(icon, (70, 65), icon)
d.text((270, 80), "Team Chat", font=font(B, 92), fill="white")
d.text((275, 195), "แชททีม ProInventive", font=font(R, 46), fill=(225, 238, 255))

def block(y, title, sub, data, steps, color):
    d.rounded_rectangle((50, y, W - 50, y + 610), radius=36, outline=color, width=6)
    d.text((90, y + 30), title, font=font(B, 50), fill=color)
    d.text((90, y + 95), sub, font=font(R, 34), fill=(90, 100, 115))
    img.paste(qr(data, 400), (90, y + 160))
    ty = y + 175
    for i, s in enumerate(steps, 1):
        d.text((520, ty), f"{i}.", font=font(B, 36), fill=color)
        yy = ty
        for line in s.split("\n"):
            d.text((565, yy), line, font=font(R, 34), fill=(40, 48, 60))
            yy += 46
        ty = yy + 18
    d.text((90, y + 558), data.replace("https://", ""), font=font(R, 30), fill=(110, 118, 130))

block(340, "ทางที่ 1 · ในแอป Telegram (แนะนำ)", "ไม่ต้องใช้รหัส · ต้องอยู่ในกลุ่ม Pro inventive", APP,
      ["สแกน QR ด้วยกล้องมือถือ", "เปิดด้วย Telegram\nกด Open / เปิดแอป", "ใช้งานได้ทันที\nชื่อมาจาก Telegram"], (43, 139, 232))
block(990, "ทางที่ 2 · เบราว์เซอร์ / คอม", "สำหรับคนที่ไม่ใช้ Telegram · ต้องมีรหัสทีม", WEB,
      ["สแกน QR หรือพิมพ์ที่อยู่\nด้านล่างในเบราว์เซอร์", "ใส่ชื่อของตัวเอง", "ใส่รหัสทีม\n(ขอจากหัวหน้า)"], (31, 157, 85))
d.text((W // 2, H - 40), "ห้ามส่ง QR นี้ให้คนนอกบริษัท", font=font(B, 32), fill=(214, 69, 69), anchor="ms")
out = ROOT / "assets" / "teamchat-qr-card.png"
img.save(out)
print(out)
