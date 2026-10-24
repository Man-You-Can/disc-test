// English cover letter for the example on disc-test.org/ru/cv/ (fictional candidate Irina Sokolova, Head of E-commerce role):
// full version for email and a short one for LinkedIn or messengers. Same facts as the Russian letter (content.cv.example.letter).
// Run: node scripts/cv-example-letter-build-en.js <path>.docx (needs the docx package — see scripts/cv-example-build.js).
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, BorderStyle, AlignmentType, TabStopType, Footer } = require('docx');

const [OUT] = process.argv.slice(2);
const L = {
  fullTitle: 'Full version — for email',
  subject: 'Subject: Application for Head of E-commerce — Irina Sokolova',
  body: [
    'Dear Hiring Manager,',
    'I am applying for the Head of E-commerce role. Since 2021 I have led e-commerce at a home goods retail chain: online sales grew from RUB 0.9 bn to RUB 2.6 bn a year, and the chain launched on Ozon, Wildberries and Yandex Market, which now bring 31% of online revenue. I lead a team of 18 covering marketplaces, website, content and analytics.',
    'You are looking for someone to grow your own website and marketplaces at the same time — that is exactly what I do today. I have not worked in FMCG, but home goods is also mass retail with a broad assortment and fast delivery, and the approach to the online channel is very similar.',
    'I would be glad to discuss how to accelerate the growth of your online channel.',
    'Best regards,',
  ],
  sign: 'Irina Sokolova',
  shortTitle: 'Short version — for LinkedIn or messengers',
  short: 'Hello! I am applying for the Head of E-commerce role. Since 2021 I have led e-commerce at a home goods retail chain: online sales grew from RUB 0.9 bn to RUB 2.6 bn, I launched sales on Ozon, Wildberries and Yandex Market (31% of revenue), and I lead a team of 18. My CV is attached — happy to set up a call.',
};
const FONT = 'Calibri', BODY = 22, GREY = '595959', ACCENT = '1F3864';
const PAGE_W = 11906, MARGIN = 1134, CONTENT_W = PAGE_W - 2 * MARGIN;
const run = (text, o = {}) => new TextRun({ text, font: FONT, size: BODY, ...o });
const P = (text, o = {}) => new Paragraph({ spacing: { after: 160, line: 300 }, alignment: AlignmentType.LEFT, ...o, children: [run(text, o.run || {})] });
const H = (text) => new Paragraph({ spacing: { before: 360, after: 140 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '8EAADB', space: 1 } },
  children: [new TextRun({ text: text.toUpperCase(), font: FONT, size: 20, bold: true, color: ACCENT, characterSpacing: 15 })] });

const doc = new Document({
  creator: 'disc-test.org', title: 'Cover letter — Irina Sokolova (sample)',
  description: 'Sample cover letter from disc-test.org/ru/cv/. Fictional data.',
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 }, margin: { top: MARGIN, bottom: MARGIN, left: MARGIN, right: MARGIN } } },
    footers: { default: new Footer({ children: [new Paragraph({ children: [
      new TextRun({ text: 'Sample cover letter from disc-test.org · fictional data', font: FONT, size: 16, color: GREY })] })] }) },
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
