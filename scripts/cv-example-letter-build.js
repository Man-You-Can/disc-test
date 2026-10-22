// Сопроводительное письмо из примера на лендинге /ru/cv/ (вымышленная кандидатка Ирина Соколова, вакансия «Руководитель e-commerce»):
// полная версия для e-mail и короткая для Telegram или отклика на hh. Тексты — content.cv.example.letter в src/locales/ru.json.
// Запуск: node scripts/cv-example-letter-build.js <локаль ru.json> <путь>.docx (нужен пакет docx — см. scripts/cv-example-build.js).
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, BorderStyle, AlignmentType, TabStopType, Footer } = require('docx');

const [LOCALE, OUT] = process.argv.slice(2);
const L = JSON.parse(fs.readFileSync(LOCALE, 'utf8')).content.cv.example.letter;
const FONT = 'Calibri', BODY = 22, GREY = '595959', ACCENT = '1F3864';
const PAGE_W = 11906, MARGIN = 1134, CONTENT_W = PAGE_W - 2 * MARGIN;
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: BODY, ...o });
const P = (text, o = {}) => new Paragraph({ spacing: { after: 160, line: 300 }, alignment: AlignmentType.LEFT, ...o, children: [run(text, o.run || {})] });
const H = (text) => new Paragraph({ spacing: { before: 360, after: 140 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '8EAADB', space: 1 } },
  children: [new TextRun({ text: text.toUpperCase(), font: FONT, size: 20, bold: true, color: ACCENT, characterSpacing: 15 })] });

const doc = new Document({
  creator: 'disc-test.org', title: 'Сопроводительное письмо — Ирина Соколова (пример)',
  description: 'Пример сопроводительного письма с сайта disc-test.org/ru/cv/. Данные вымышлены.',
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [new Paragraph({ children: [
      new TextRun({ text: 'Пример сопроводительного письма с сайта disc-test.org · данные вымышлены', font: FONT, size: 16, color: GREY })] })] }) },
    children: [
      H(L.fullTitle),
      P(L.subject, { run: { color: GREY } }),
      ...L.body.map(t => P(t)),
      P(L.sign, { run: { bold: true } }),
      H(L.shortTitle),
      P(L.short),
    ],
  }],
});
Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('written', OUT, buf.length, 'bytes'); });
