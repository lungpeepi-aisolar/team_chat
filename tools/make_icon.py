"""สร้างไอคอน Team Chat (teamchat.ico + web/icon.png) · โดย ลุงพี — py tools\\make_icon.py"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent.parent
S = 256
img = Image.new("RGBA", (S, S), (0, 0, 0, 0))
d = ImageDraw.Draw(img)
d.rounded_rectangle((8, 8, S - 8, S - 8), radius=56, fill=(43, 139, 232))
# ฟองแชทหลัง (สีเขียว = Drive/ไฟล์)
d.rounded_rectangle((104, 58, 222, 146), radius=30, fill=(52, 199, 120))
d.polygon([(190, 140), (214, 172), (168, 146)], fill=(52, 199, 120))
# ฟองแชทหน้า (ขาว)
d.rounded_rectangle((36, 92, 176, 196), radius=34, fill=(255, 255, 255))
d.polygon([(64, 188), (46, 226), (98, 194)], fill=(255, 255, 255))
for x in (74, 106, 138):
    d.ellipse((x - 10, 134, x + 10, 154), fill=(43, 139, 232))
img.save(root / "teamchat.ico", sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
img.resize((192, 192), Image.LANCZOS).save(root / "web" / "icon.png")
print("สร้าง", root / "teamchat.ico", "และ web/icon.png")
