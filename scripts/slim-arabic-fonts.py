# -*- coding: utf-8 -*-
"""Облегчает арабские шрифты сайта (src/assets/fonts/*-arabic.woff2) и правит их unicode-range в fonts.css.

Google Fonts отдаёт Noto Kufi Arabic переменным шрифтом (все толщины в одном файле, ~124 КБ) и с буквами
персидского, урду и других письменностей. Сайту нужны одна толщина и арабские буквы с огласовками:
шрифт заголовков становится ~9 КБ, основной ~15 КБ — главный текст арабской версии на телефоне появляется
раньше (PageSpeed 16.11.2026: 86 баллов, LCP 3,9 с из-за загрузки шрифта заголовков).

Запуск: python3 scripts/slim-arabic-fonts.py — после node scripts/fetch-fonts.js (тот перезаписывает файлы).
Повторный запуск безопасен. Нужен fontTools с brotli (pip3 install fonttools brotli).
Знаки вне набора (редкие буквы других письменностей) браузер берёт из системного шрифта.
"""
import os, re, sys
from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib.instancer import instantiateVariableFont

FONTS = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'assets', 'fonts')
# арабские буквы, огласовки, цифры и знаки препинания, частые заимствованные буквы (پ چ ژ ڤ ک گ ی), ZWNJ/ZWJ и метки направления
RANGE = 'U+0020, U+00A0, U+060C, U+061B, U+061F, U+0621-065F, U+0660-066D, U+0670, U+067E, U+0686, U+0698, U+06A4, U+06A9, U+06AF, U+06CC, U+200C-200F, U+2010-2011'
CSS_RANGE = RANGE.replace('U+0020, U+00A0, ', '')  # пробелы есть в файле, но в unicode-range их не пишем: их даёт латинский файл

def slim(path, weight):
    f = TTFont(path)
    if 'fvar' in f:
        f = instantiateVariableFont(f, {'wght': weight})
    o = subset.Options()
    o.flavor = 'woff2'
    o.layout_features = ['*']
    o.name_IDs = ['*']
    o.notdef_outline = True
    s = subset.Subsetter(o)
    s.populate(unicodes=subset.parse_unicodes(RANGE.replace(' ', '')))
    s.subset(f)
    f.flavor = 'woff2'
    f.save(path)

def main():
    css_path = os.path.join(FONTS, 'fonts.css')
    css = open(css_path, encoding='utf-8').read()
    done = 0
    for name in sorted(os.listdir(FONTS)):
        m = re.match(r'(noto-kufi-arabic|ibm-plex-sans-arabic)-(\d+)-arabic\.woff2$', name)
        if not m:
            continue
        p = os.path.join(FONTS, name)
        before = os.path.getsize(p)
        slim(p, int(m.group(2)))
        print('%s: %d -> %d bytes' % (name, before, os.path.getsize(p)))
        css, n = re.subn(r'(src:url\(__FONTS__' + re.escape(name) + r'\) format\(\'woff2\'\);unicode-range:)[^}]*\}', lambda mm: mm.group(1) + CSS_RANGE + '}', css)
        if n != 1:
            sys.exit('fonts.css: no @font-face for ' + name)
        done += 1
    if not done:
        sys.exit('no Arabic font files in ' + FONTS)
    open(css_path, 'w', encoding='utf-8').write(css)
    print('fonts.css: unicode-range updated for %d files' % done)

main()
