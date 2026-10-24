// English version of the sample CV for disc-test.org/ru/cv/: fictional candidate Irina Sokolova, Head of E-commerce role.
// Same facts as the Russian CV (only the «green» items of the unified resume); job titles — the English variants from the unified resume.
const fs = require('fs');
const { Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, WidthType, BorderStyle,
        AlignmentType, TabStopType, LevelFormat, Footer, PageNumber } = require('docx');

const OUT = process.argv[2];
const FONT = 'Calibri';
const BODY = 22;               // 11 pt
const PAGE_W = 11906, MARGIN_LR = 1134, MARGIN_TB = 1134;
const CONTENT_W = PAGE_W - 2 * MARGIN_LR;
const ACCENT = '1F3864', GREY = '595959';

const nb = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' };
const noBorders = { top: nb, bottom: nb, left: nb, right: nb, insideHorizontal: nb, insideVertical: nb };

const run = (text, o = {}) => new TextRun({ text, font: FONT, size: BODY, ...o });
const P = (children, o = {}) => new Paragraph({ spacing: { after: 60, line: 288 }, ...o,
  children: Array.isArray(children) ? children : [run(children)] });
const H = (text) => new Paragraph({
  spacing: { before: 300, after: 120 }, keepNext: true,
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '8EAADB', space: 1 } },
  children: [new TextRun({ text: text.toUpperCase(), font: FONT, size: 22, bold: true, color: ACCENT, characterSpacing: 15 })] });
const B = (children, o = {}) => new Paragraph({ numbering: { reference: 'bul', level: 0 },
  spacing: { after: 70, line: 288 }, ...o, children: Array.isArray(children) ? children : [run(children)] });
const JOB = (role, company, dates, sub) => [
  new Paragraph({ spacing: { before: 220, after: 20 }, keepNext: true,
    tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
    children: [run(role, { bold: true, size: 22 }), run('\t' + dates, { color: GREY, size: 20 })] }),
  new Paragraph({ spacing: { after: 60 }, keepNext: true,
    children: [run(company, { bold: true, color: ACCENT }), ...(sub ? [run('  ·  ' + sub, { italics: true, color: GREY })] : [])] }),
];
const cell = (paras) => new TableCell({ width: { size: CONTENT_W / 2, type: WidthType.DXA }, borders: noBorders,
  margins: { top: 0, bottom: 0, left: 0, right: 160 }, children: paras });

const doc = new Document({
  creator: 'disc-test.org', title: 'CV Irina Sokolova — Head of E-commerce (sample)',
  description: 'Sample CV from disc-test.org/ru/cv/. Fictional data.',
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 320, hanging: 220 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 },
      margin: { top: MARGIN_TB, bottom: MARGIN_TB, left: MARGIN_LR, right: MARGIN_LR } } },
    footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
      children: [new TextRun({ text: 'Sample CV from disc-test.org · fictional data', font: FONT, size: 16, color: GREY }),
                 new TextRun({ text: '\tIrina Sokolova · page ', font: FONT, size: 16, color: GREY }),
                 new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GREY })] })] }) },
    children: [
      new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: 'IRINA SOKOLOVA', font: FONT, size: 42, bold: true, color: ACCENT, characterSpacing: 20 })] }),
      new Paragraph({ spacing: { after: 70 }, children: [run('Head of E-commerce: own online store and marketplaces', { size: 25, bold: true, color: '2F5496' })] }),
      new Paragraph({ spacing: { after: 160 }, children: [
        run('Moscow, Russia  ·  +7 (900) 000-00-00  ·  irina.sokolova@example.com  ·  hybrid or office', { size: 20, color: GREY })] }),

      P([run('E-commerce leader with 12 years in online retail, running an own online store and marketplaces side by side. Since 2021, Head of E-commerce at a home goods retail chain (240 stores): grew online sales from RUB 0.9 bn to RUB 2.6 bn a year and launched the chain on Ozon, Wildberries and Yandex Market, now 31% of online revenue. I own the online channel P&L and lead a team of 18 across marketplaces, website, content and analytics.')],
        { alignment: AlignmentType.BOTH, spacing: { after: 100, line: 300 } }),

      H('Key achievements'),
      B([run('Online sales up 2.9x: ', { bold: true }), run('from RUB 0.9 bn to RUB 2.6 bn a year in 3 years at a home goods retail chain.')]),
      B([run('Three marketplaces launched: ', { bold: true }), run('Ozon, Wildberries and Yandex Market — 31% of the chain’s online revenue.')]),
      B([run('Team built from scratch: ', { bold: true }), run('18 people across marketplaces, website, content and analytics.')]),
      B([run('Category turnover tripled: ', { bold: true }), run('Home Appliances at an online electronics retailer, up to RUB 4.1 bn a year.')]),

      H('Core skills'),
      new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W / 2, CONTENT_W / 2], borders: noBorders,
        rows: [new TableRow({ children: [
          cell([B('Marketplaces: Ozon, Wildberries, Yandex Market'), B('Online channel P&L'), B('Unit economics')]),
          cell([B('Team leadership'), B('Web analytics and website conversion'), B('Assortment and pricing')]),
        ] })] }),

      H('Experience'),
      ...JOB('Head of E-commerce', 'Home goods retail chain', 'Mar 2021 – present', '240 stores · team of 18'),
      B('Grew online sales from RUB 0.9 bn to RUB 2.6 bn a year (2.9x) in 3 years.'),
      B('Launched the chain on Ozon, Wildberries and Yandex Market — 31% of online revenue.'),
      B('Built a team of 18: marketplaces, website, content, analytics.'),
      B('Raised website conversion from 1.4% to 2.3% by redesigning the product page and checkout.'),

      ...JOB('Category Manager, Home Appliances', 'Online electronics retailer', 'Jun 2017 – Feb 2021'),
      B('Tripled category turnover to RUB 4.1 bn a year.'),
      B('Managed 200+ suppliers; launched a marketplace model in the category.'),

      ...JOB('Parental leave', 'Career break', 'Jun 2016 – May 2017'),
      B('Web analytics course (2017).'),

      ...JOB('E-commerce Manager', 'Fashion retail chain', 'Sep 2013 – May 2016'),
      B('Launched the chain’s online store: 8% of revenue in its second year.'),

      H('Education'),
      B([run('Plekhanov Russian University of Economics', { bold: true }), run(', Faculty of Informatics in Economics, 2013')]),
      H('Courses'),
      B([run('Web Analytics', { bold: true }), run(', 2017')]),
      B([run('P&L Management', { bold: true }), run(', 2022')]),
      H('Achievements'),
      B('“Project of the Year” company award for the marketplace launch, 2022.'),
      B('Speaker at an industry e-commerce conference, 2023.'),
      H('Languages'),
      B('English — upper-intermediate (B2).'),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('written', OUT, buf.length, 'bytes'); });
