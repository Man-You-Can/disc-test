// Пересборка примера CV для лендинга /ru/cv/ (src/assets/files/cv-example-irina-sokolova.docx и .pdf), с 2026-10-22.
// Нужен пакет docx (в репозитории его нет — ставить во временную папку: npm init -y && npm install docx) и Microsoft Word для PDF:
//   node scripts/cv-example-build.js <путь>.docx, затем открыть .docx в Word и сохранить как PDF (A4; должно выйти не больше 2 страниц).
// Тексты — только «зелёные» пункты единого резюме из примера на странице (content.cv.example.profile, in: true).
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
  creator: 'disc-test.org', title: 'CV Ирина Соколова — Руководитель e-commerce (пример)',
  description: 'Пример CV с сайта disc-test.org/ru/cv/. Данные вымышлены.',
  styles: { default: { document: { run: { font: FONT, size: BODY } } } },
  numbering: { config: [{ reference: 'bul', levels: [{ level: 0, format: LevelFormat.BULLET, text: '•',
    alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 320, hanging: 220 } } } }] }] },
  sections: [{
    properties: { page: { size: { width: PAGE_W, height: 16838 },
      margin: { top: MARGIN_TB, bottom: MARGIN_TB, left: MARGIN_LR, right: MARGIN_LR } } },
    footers: { default: new Footer({ children: [new Paragraph({ tabStops: [{ type: TabStopType.RIGHT, position: CONTENT_W }],
      children: [new TextRun({ text: 'Пример CV с сайта disc-test.org · данные вымышлены', font: FONT, size: 16, color: GREY }),
                 new TextRun({ text: '\tИрина Соколова · стр. ', font: FONT, size: 16, color: GREY }),
                 new TextRun({ children: [PageNumber.CURRENT], font: FONT, size: 16, color: GREY })] })] }) },
    children: [
      // ---------- Шапка ----------
      new Paragraph({ spacing: { after: 30 }, children: [new TextRun({ text: 'ИРИНА СОКОЛОВА', font: FONT, size: 42, bold: true, color: ACCENT, characterSpacing: 20 })] }),
      new Paragraph({ spacing: { after: 70 }, children: [run('Руководитель e-commerce: собственный интернет-магазин и маркетплейсы', { size: 25, bold: true, color: '2F5496' })] }),
      new Paragraph({ spacing: { after: 160 }, children: [
        run('Москва  ·  +7 (900) 000-00-00  ·  irina.sokolova@example.com  ·  гибрид или офис', { size: 20, color: GREY })] }),

      P([run('12 лет в онлайн-рознице — собственный интернет-магазин и маркетплейсы одновременно. С 2021 года руковожу направлением e-commerce сети товаров для дома (240 магазинов): онлайн-продажи выросли с 0,9 до 2,6 млрд ₽ в год, сеть вышла на Ozon, Wildberries и Яндекс Маркет — сейчас это 31% онлайн-выручки. Отвечаю за P&L онлайн-канала и команду из 18 человек: маркетплейсы, сайт, контент и аналитика.')],
        { alignment: AlignmentType.BOTH, spacing: { after: 100, line: 300 } }),

      // ---------- Ключевые результаты ----------
      H('Ключевые результаты'),
      B([run('Рост онлайн-продаж в 2,9 раза: ', { bold: true }), run('с 0,9 до 2,6 млрд ₽ в год за 3 года — сеть товаров для дома.')]),
      B([run('Запуск на трёх маркетплейсах: ', { bold: true }), run('Ozon, Wildberries и Яндекс Маркет — 31% онлайн-выручки сети.')]),
      B([run('Команда с нуля: ', { bold: true }), run('18 человек — маркетплейсы, сайт, контент, аналитика.')]),
      B([run('Рост категории в 3 раза: ', { bold: true }), run('оборот «Бытовой техники» у онлайн-ритейлера электроники — до 4,1 млрд ₽ в год.')]),

      // ---------- Компетенции ----------
      H('Компетенции'),
      new Table({ width: { size: CONTENT_W, type: WidthType.DXA }, columnWidths: [CONTENT_W / 2, CONTENT_W / 2], borders: noBorders,
        rows: [new TableRow({ children: [
          cell([B('Маркетплейсы: Ozon, Wildberries, Яндекс Маркет'), B('P&L онлайн-канала'), B('Юнит-экономика')]),
          cell([B('Управление командой'), B('Веб-аналитика, конверсия сайта'), B('Ассортимент и цены')]),
        ] })] }),

      // ---------- Опыт ----------
      H('Опыт работы'),
      ...JOB('Руководитель направления e-commerce', 'Сеть магазинов товаров для дома', 'Март 2021 — н. в.', '240 магазинов · команда 18 человек'),
      B('Онлайн-продажи выросли с 0,9 до 2,6 млрд ₽ в год (×2,9) за 3 года.'),
      B('Вывела сеть на Ozon, Wildberries и Яндекс Маркет — 31% онлайн-выручки.'),
      B('Собрала команду из 18 человек: маркетплейсы, сайт, контент, аналитика.'),
      B('Конверсия сайта — с 1,4% до 2,3% после переделки карточки товара и корзины.'),

      ...JOB('Руководитель категории «Бытовая техника»', 'Онлайн-ритейлер электроники', 'Июнь 2017 — февраль 2021'),
      B('Оборот категории вырос в 3 раза — до 4,1 млрд ₽ в год.'),
      B('200+ поставщиков; запустила модель маркетплейса в категории.'),

      ...JOB('Отпуск по уходу за ребёнком', 'Перерыв в работе', 'Июнь 2016 — май 2017'),
      B('Курс по веб-аналитике (2017).'),

      ...JOB('Менеджер по интернет-продажам', 'Сеть магазинов одежды', 'Сентябрь 2013 — май 2016'),
      B('Запустила интернет-магазин сети: 8% выручки на второй год.'),

      // ---------- Образование, курсы, достижения, языки ----------
      H('Образование'),
      B([run('Высшее экономическое образование', { bold: true }), run(', 2013')]),
      H('Курсы'),
      B([run('Веб-аналитика', { bold: true }), run(', 2017')]),
      B([run('Управление P&L', { bold: true }), run(', 2022')]),
      H('Достижения'),
      B('«Проект года» в компании — запуск на маркетплейсах, 2022.'),
      B('Спикер отраслевой конференции по e-commerce, 2023.'),
      H('Языки'),
      B('Английский — B2.'),
    ],
  }],
});

Packer.toBuffer(doc).then(buf => { fs.writeFileSync(OUT, buf); console.log('written', OUT, buf.length, 'bytes'); });
