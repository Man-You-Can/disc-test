/* Типографика, которую неудобно держать в текстах локалей; применяется при сборке сайта (build.js) и PDF (scripts/make-pdf.js).
   fr — узкий неразрывный пробел (U+202F) перед : ; ! ? » и после «, чтобы знак не уезжал на новую строку;
   rtl (ar) — метка LRM перед знаком числа (+24, −24), иначе в строке справа налево знак встаёт после числа («24+»). */
function typo(L) {
  const fix = L.lang === 'fr' ? s => s.replace(/[  ]+([:;!?»])/g, ' $1').replace(/«[  ]+/g, '« ')
    : L.dir === 'rtl' ? s => s.replace(/(^|[\s( ])([+−-])(?=\d)/g, '$1‎$2') : null;
  if (!fix) return L;
  const walk = v => typeof v === 'string' ? fix(v) : Array.isArray(v) ? v.map(walk) : v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, walk(x)])) : v;
  return walk(L);
}
module.exports = typo;
