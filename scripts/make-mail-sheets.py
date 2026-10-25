# -*- coding: utf-8 -*-
"""Картинка листов образца для письма подписчикам (content.mailing.promo, с 2026-10-25).

Три листа образца расширенного отчёта рядом, в рамках: src/assets/extended/<язык>-mail.jpg, 1008 × 453 px (в письме — 504 px).
JPEG, а не WebP: WebP показывают не все почтовые программы. Сайт отдаёт файл по адресу /extended/<язык>-mail.jpg (build.js копирует его в docs/).
Листы — 1 (титульный), 2 («Ваш профиль в деталях») и 4 («План на 30 дней») из src/assets/extended/<язык>-i-<n>.webp.

Запуск:  python3 scripts/make-mail-sheets.py ru   (нужен Pillow с поддержкой WebP)
"""
import os, sys
from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DIR = os.path.join(ROOT, 'src', 'assets', 'extended')
SHEETS = (1, 2, 4)
W, GAP = 1008, 24


def make(lang):
    w = (W - 2 * GAP) // 3
    h = round(w * 1416 / 1000)
    out = Image.new('RGB', (W, h), '#FFFFFF')
    d = ImageDraw.Draw(out)
    x = 0
    for n in SHEETS:
        src = os.path.join(DIR, '%s-i-%d.webp' % (lang, n))
        im = Image.open(src).convert('RGB').resize((w - 2, h - 2), Image.LANCZOS)
        d.rectangle([x, 0, x + w - 1, h - 1], outline='#D9DDE3')
        out.paste(im, (x + 1, 1))
        x += w + GAP
    dst = os.path.join(DIR, lang + '-mail.jpg')
    out.save(dst, quality=82, optimize=True, progressive=True)
    print('%s: %d × %d, %d КБ' % (os.path.relpath(dst, ROOT), out.size[0], out.size[1], os.path.getsize(dst) // 1024))


if __name__ == '__main__':
    if len(sys.argv) < 2:
        sys.exit('Укажите язык: python3 scripts/make-mail-sheets.py ru')
    for lang in sys.argv[1:]:
        make(lang)
