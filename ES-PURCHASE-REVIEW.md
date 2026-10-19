# Испанская покупка расширенного отчёта — тексты для вычитки носителем

Ветка `es-pay-prodamus`, 19 октября 2026 (от `main`, в которую уже влиты английская и португальская покупки). Здесь собраны все испанские тексты, которые появились или изменились на ветке (`src/locales/es.json`). Текст писался заново для испаноязычного читателя (usted, нейтральный испанский, запись испанского сайта: кавычки «», процент с пробелом, «correo»), а не переводился с русского, английского или португальского; юридические тексты держатся близко к русским. Тексты прошли одну вычитку свежим взглядом (агент в роли испаноязычного редактора, 8,5 из 10, принятые замечания внесены); носитель их не читал. Правки вносятся в `src/locales/es.json`, затем `node scripts/validate-locale.js`, `node build.js`, `node scripts/test-apps-script.js`.

Подстановки в фигурных скобках (`{price}`, `{date}`, `{email}`, `{offer}`, `{contact}`, `{order}`, `{site}`, `{k}`, `{name}`, `{pct}`, `{a}`, `{b}`, `{label}`, `{original}`, `{link}`) не переводятся и не удаляются: на их место сайт или сервер ставит значение. `{offer}` — ссылка «condiciones de venta», `{contact}` — «Contacto», `{email}` — info@disc-test.org, `{price}` — 6,99 (после него в тексте стоит «USD»).

## Что проверить по существу (решения и вопросы к заказчику)

1. **Налоги и сборы банка покупателя** не упоминаются — как решено для португальской версии (19 октября 2026).
2. **Страница оплаты Prodamus только на английском** — `pay.how[1]` предупреждает: «la página está en inglés».
3. **Квитанция и имя в выписке** — как в английской и португальской версиях: квитанция приходит от bePaid, в выписке может стоять simpleway.by (`pay.note`, `pay.how[1]`, `pay.thanks.next[1]`).
4. **Число листов** — «unas 28 páginas» осталось как было (`facts`, `compare`, `faq[1]`, `pdf.facts`): у 13 испанских профилей из 16 по 28 листов, у DI, ID и DC — 29.
5. **Цена** записывается как на испанском сайте — «6,99 USD» (цена, затем код валюты). Письмо-напоминание пишет её так же: ядро форматирует доллары в записи языка (`es-ES`), проверка добавлена в `scripts/test-apps-script.js`.
6. **Оферта: платёжный посредник назван «Proveedor de pagos»**, а не «Servicio de pago»: во вводной части оферты и на других страницах «servicio de pago» значит «платная услуга» (замечание вычитки). Prodamus назван по имени в определении (раздел 1) и в разделе о данных покупателя (`policy.purchase`, `privacy.purchase`).
7. **Дата перевода оферты** — `offer.edition`: «actualizada el 19 de octubre de 2026». При вливании в `main` поставить дату публикации.
8. **`faq[2].a`** говорит, что отчёт написан на нейтральном испанском, понятном в Испании и Латинской Америке, и что это не перевод. Если носитель решит иначе (например, по вопросу 1 своего задания о `tú`/`usted`), строку стоит перечитать.
9. **Не принято из вычитки**:
   - `policy.purchase.p[3]` и `privacy.purchase.p[3]` («La base legal del tratamiento son los pasos que usted dio para celebrar el contrato» → «la aplicación, a petición suya, de medidas precontractuales…»). Это прежний текст политики, на ветке из него только убрана фраза о заявке; показать юристу вместе с остальными юридическими текстами (то же замечание было в португальской версии).
   - «use el formulario de «{contact}»» вместо «use el formulario «{contact}»»: на остальных испанских страницах сайта — «el formulario «{contact}»», оставлено единообразно.
   - В зацепке `promo.hooks.pairMid` вторую букву ({b}) назвать нельзя: валидатор требует тот же набор подстановок, что в русском тексте; принят вариант «qué le aporta».

Примечание: `buy.orderText`, `buy.orderButton`, `buy.orderMsg` показываются, только если на сайте выключена оплата (нет `payEndpoint`) — тогда вместо «Comprar» остаётся заявка, как в русской версии.

## Покупка на странице отчёта, «Gracias», «Pago no completado», письмо-напоминание — `content.product.pay` (новое)

- `product.pay.title`: Su informe se elaborará a partir del test que hizo el {date}
- `product.pay.text`: El informe le llegará por correo electrónico, como PDF adjunto, en un plazo máximo de 24 horas desde el pago. El comprobante de pago se envía a la misma dirección.
- `product.pay.emailLabel`: Correo para el informe y el comprobante
- `product.pay.button`: Comprar
- `product.pay.note`: Al pulsar «Comprar», acepta las {offer}. El pago se hace en dólares estadounidenses, en la página segura de Prodamus: los datos de la tarjeta se introducen allí, no en este sitio. En el extracto de la tarjeta, el cargo puede figurar como simpleway.by.
- `product.pay.badEmail`: Revise la dirección de correo: a ella enviaremos el informe y el comprobante.
- `product.pay.wait`: Abriendo la página de pago…
- `product.pay.error`: No se ha podido abrir la página de pago. Inténtelo de nuevo en unos instantes o escriba a {email}.
- `product.pay.how[0]`: Haga el test gratuito: 24 bloques, unos 10 minutos. Si ya lo hizo, no tiene que repetirlo: el informe se elabora con el resultado que ya tiene.
- `product.pay.how[1]`: Indique su correo y pulse «Comprar». Pagará en dólares estadounidenses en la página segura de Prodamus, nuestro proveedor de servicios de pago; la página está en inglés. En el extracto de la tarjeta, el cargo puede figurar como simpleway.by, el nombre que usa bePaid, la empresa que procesa los pagos con tarjeta para Prodamus.
- `product.pay.how[2]`: El informe le llegará por correo electrónico, como PDF adjunto, en un plazo máximo de 24 horas desde el pago. El comprobante de pago se envía a la misma dirección.
- `product.pay.thanks.title`: Gracias por su compra — Informe DISC ampliado
- `product.pay.thanks.description`: El pago del informe DISC ampliado se ha completado: dónde y cuándo llega el informe y qué hacer si el correo no llega.
- `product.pay.thanks.h1`: ¡Gracias! Pago completado
- `product.pay.thanks.lead`: El informe llegará a la dirección de correo que indicó al pagar: un PDF adjunto, en un plazo máximo de 24 horas desde el pago. Normalmente llega mucho antes.
- `product.pay.thanks.leadEmail`: El informe llegará a {email}: un PDF adjunto, en un plazo máximo de 24 horas desde el pago. Normalmente llega mucho antes.
- `product.pay.thanks.order`: Número de pedido: {order}
- `product.pay.thanks.statusWait`: Esperando a que Prodamus confirme el pago.
- `product.pay.thanks.statusPaid`: Pago recibido. Estamos preparando el informe.
- `product.pay.thanks.statusSent`: El informe se ha enviado. Revise su bandeja de entrada.
- `product.pay.thanks.nextTitle`: Qué ocurre ahora
- `product.pay.thanks.next[0]`: El correo llegará desde {email}, con un asunto que empieza por «Su informe DISC ampliado».
- `product.pay.thanks.next[1]`: El comprobante de pago le llegará en un correo aparte, enviado por bePaid, la empresa que procesa los pagos con tarjeta para Prodamus. En el extracto de la tarjeta, el cargo puede figurar como simpleway.by, y no como DISC Test.
- `product.pay.thanks.next[2]`: El informe tiene 13 secciones. Empiece por la sección 1: explica cómo leer las demás.
- `product.pay.thanks.helpTitle`: Si el correo no llega
- `product.pay.thanks.help[0]`: Revise las carpetas de correo no deseado (spam) y de promociones.
- `product.pay.thanks.help[1]`: Si aun así no lo encuentra, escriba a {email} o use el formulario «{contact}» e indique el número de pedido. Le enviaremos el informe de nuevo.
- `product.pay.thanks.back`: Volver al sitio
- `product.pay.fail.title`: Pago no completado — Informe DISC ampliado
- `product.pay.fail.description`: El pago del informe DISC ampliado no se ha completado: qué puede hacer y cómo contactar con nosotros.
- `product.pay.fail.h1`: El pago no se ha completado
- `product.pay.fail.lead`: Su pedido sigue abierto y el informe todavía no se ha enviado.
- `product.pay.fail.order`: Número de pedido: {order}
- `product.pay.fail.tryTitle`: Qué puede hacer
- `product.pay.fail.try[0]`: Compruebe los datos de la tarjeta y que esté habilitada para compras en línea y en el extranjero.
- `product.pay.fail.try[1]`: Pruebe con otra tarjeta u otro medio de pago.
- `product.pay.fail.try[2]`: Vuelva a intentarlo dentro de unos minutos.
- `product.pay.fail.button`: Intentarlo de nuevo
- `product.pay.fail.charged`: Si a pesar de todo se le ha cobrado, escriba a {email} o use el formulario «{contact}» e indique el número de pedido. Lo revisaremos y le responderemos en un plazo de tres días hábiles.
- `product.pay.remind.subject`: Su informe DISC ampliado está pendiente de pago
- `product.pay.remind.intro`: Inició la compra del informe DISC ampliado en {site}, pero el pago no se completó. Su pedido sigue guardado: el informe se elaborará a partir de su resultado, para este perfil:
- `product.pay.remind.price`: El precio es de {price} USD. Tras el pago, el informe llegará a esta dirección como PDF adjunto, y el comprobante, en un correo aparte.
- `product.pay.remind.button`: Completar el pago
- `product.pay.remind.valid`: El enlace lleva a la página segura de pago de Prodamus y es válido hasta el {date}.
- `product.pay.remind.footer`: Le enviamos este correo una sola vez porque se hizo un pedido (n.º {order}) en {site} con esta dirección. Si no necesita el informe o no hizo ese pedido, no tiene que hacer nada: el pedido se cancelará automáticamente y no recibirá más mensajes sobre él.

## Личные зацепки, закреплённая кнопка, карточка вернувшегося посетителя — `content.product.promo` (новое)

- `product.promo.lead`: A partir de sus respuestas, el informe aborda:
- `product.promo.hooks.low`: {k}, {name}, su escala más baja, con un {pct} %: qué significa
- `product.promo.hooks.flat`: su perfil equilibrado: qué significa y cómo leerlo
- `product.promo.hooks.moderate`: su estilo predominante, {k}, llega solo al {pct} % (intensidad moderada): cómo leer las descripciones
- `product.promo.hooks.pairMid`: su combinación {a} + {b}: qué le aporta y en qué se diferencia del {a} puro
- `product.promo.hooks.pairClose`: sus estilos {a} y {b} están casi empatados: hasta qué punto es fiable el orden de las letras
- `product.promo.hooks.pairEqual`: sus estilos {a} y {b} están empatados: por qué {a} va primero
- `product.promo.hooks.pairEdge`: {b} es su estilo secundario por una sola respuesta de diferencia: qué significa para usted
- `product.promo.hooks.pureHigh`: {k} tiene un {pct} %, pero no es su estilo secundario: qué significa un perfil «puro»
- `product.promo.hooks.layersDiff`: su estilo adaptado ({a}) es distinto del natural ({b}): qué le exige eso
- `product.promo.hooks.layersSame`: su estilo adaptado y el natural coinciden ({k}): qué ventaja y qué riesgo supone
- `product.promo.tail`: En total, 13 secciones, con cinco prácticas y un plan de 30 días.
- `product.promo.button`: Informe ampliado — {price} USD
- `product.promo.close`: Ocultar
- `product.promo.homeLabel`: Su resultado del {date}
- `product.promo.homeOpen`: Ver el resultado

## Письмо покупателю с отчётом — `content.extendedMail` (новое)

- `extendedMail.subject`: Su informe DISC ampliado: {label}
- `extendedMail.intro`: Gracias por su compra. Su informe DISC ampliado está listo. Se ha elaborado para este perfil:
- `extendedMail.attached`: Encontrará el informe ampliado adjunto a este correo, en formato PDF.
- `extendedMail.how`: El informe tiene 13 secciones. Empiece por la sección 1: explica cómo leer las demás.
- `extendedMail.help`: Si el archivo no se abre o algo del informe le parece incorrecto, responda a este correo.
- `extendedMail.inviteTitle`: Invite a sus amigos, compañeros y familiares a hacer el test
- `extendedMail.invite`: La sección 8 del informe explica cómo hablar con personas de cada uno de los cuatro estilos. Para conocer el estilo de las personas de su entorno, pídales que hagan el test: es gratuito y lleva unos 10 minutos. Cuando cada uno conoce el estilo del otro, es más fácil entenderse.
- `extendedMail.inviteLink`: Puede compartir este enlace al test:
- `extendedMail.footer`: Ha recibido este correo porque pagó el servicio «Perfil DISC ampliado» en disc-test.org. El informe es personalizado y está destinado únicamente a su uso privado.

## Листы образца на странице отчёта — `sampleTitle`, `sampleNote`, `sampleAlt`, `sampleCaption`, `block.sample`, `pdf.sheets` (новое)

- `product.sampleTitle`: Cómo es el informe
- `product.sampleNote`: Cuatro páginas del informe de una participante ficticia con el perfil Inspirador. Su informe lleva su nombre, sus puntuaciones y el texto de su perfil. Toque o haga clic en una página para ampliarla.
- `product.sampleAlt[0]`: Página del informe DISC ampliado: la portada con el perfil de la participante y el índice de las 13 secciones
- `product.sampleAlt[1]`: Página del informe DISC ampliado: la sección «Su perfil en detalle», con las cuatro escalas y qué significa cada una
- `product.sampleAlt[2]`: Página del informe DISC ampliado: la sección «La comunicación con cada uno de los cuatro estilos»
- `product.sampleAlt[3]`: Página del informe DISC ampliado: la hoja de trabajo «Plan de 30 días»
- `product.sampleCaption[0]`: Portada e índice
- `product.sampleCaption[1]`: Sección 2: sus escalas
- `product.sampleCaption[2]`: Sección 8: cómo hablar con cada estilo
- `product.sampleCaption[3]`: Sección 11: plan de 30 días
- `product.pdf.sheets[0]`: 2
- `product.pdf.sheets[1]`: 4
- `product.block.sample`: Páginas del informe de una participante ficticia

## Изменённые тексты страницы отчёта и блока на экране результата — `content.product`

- `product.description`: Informe DISC ampliado sobre su resultado: análisis de cada escala, cinco prácticas, un plan de 30 días y una hoja para sus compañeros. PDF por correo, {price} USD.
- `product.how[1]`: Pague el informe en la página segura de Prodamus, nuestro proveedor de servicios de pago.
- `product.how[2]`: El informe le llegará por correo electrónico, como PDF adjunto, en un plazo máximo de 24 horas desde el pago.
- `product.faq[2].a`: En español neutro, que se entiende igual en España y en América Latina. El informe se escribió directamente en español; no es una traducción de otro idioma.
- `product.buy.testText`: Primero haga el test gratuito: 24 bloques, unos 10 minutos. Verá el resultado y el informe breve al instante.
- `product.buy.orderText`: El pago en línea no está disponible en este momento. Déjenos su contacto y le escribiremos en cuanto se pueda pagar.
- `product.buy.orderButton`: Dejar mi contacto
- `product.buy.orderMsg`: Quiero comprar el informe DISC ampliado. Por favor, avísenme por correo cuando se pueda pagar. ⏎  ⏎ Mi resultado: {link}
- `product.pdf.where`: Más información y compra:
- `product.block.button`: Quiero el informe ampliado
- `product.block.topButton`: Quiero el informe — {price} USD
- `product.block.soon`: (удалено)

## «Servicios» — `content.services.sections[0]`

- `services.sections[0].p[0]`: El perfil ampliado se envía por correo electrónico a la dirección indicada al pagar, en un plazo máximo de 24 horas desde el pago.

## Оферта и условия возврата (юридические, близко к русскому тексту)

- `offer.edition`: Versión del 9 de octubre de 2026. Traducción al español actualizada el 19 de octubre de 2026.
- `offer.note`: Este texto es una traducción al español de la oferta original publicada en {original}. En caso de discrepancia entre ambos textos, prevalece el original, salvo en lo relativo al precio y a la forma de pago, que, en la versión en español del Sitio, se rigen por lo dispuesto en las secciones 1 y 3 de esta traducción.
- `offer.sections[0].ul[6]`: Proveedor de pagos: Prodamus, proveedor de servicios de pago en cuya página segura el Cliente paga el Servicio.
- `offer.sections[2].p[1]`: 3.2. El Servicio se paga íntegramente antes de su prestación, con tarjeta de crédito o débito u otro medio de pago electrónico que se muestre en la página de pago. El pago lo procesa el Proveedor de pagos.
- `offer.sections[2].p[2]`: 3.3. El Servicio se considera pagado en el momento en que el Prestador recibe del Proveedor de pagos la confirmación del pago.
- `offer.sections[2].p[3]`: 3.4. El Cliente introduce los datos de la tarjeta en la página segura del Proveedor de pagos. El Prestador no recibe ni conserva esos datos.
- `offer.sections[7].p[1]`: 8.2. Los datos solo se comunican al Proveedor de pagos, para procesar el pago y enviar el comprobante, y a los servicios necesarios para elaborar y enviar el Perfil ampliado, así como a terceros en los casos previstos por la ley.
- `refund.note`: Este texto es una traducción al español de la política de reembolso original publicada en {original}. En caso de discrepancia entre ambos textos, prevalece el original.

## Данные покупателя на странице «Privacidad» — `content.policy.purchase` и прежняя редакция `content.privacy.purchase`

- `privacy.purchase.p[1]`: Los pagos los procesa Prodamus, nuestro proveedor de servicios de pago. Usted introduce los datos de la tarjeta en la página segura de pago de Prodamus: nosotros no los recibimos ni los guardamos. A Prodamus le comunicamos el importe, el número de pedido y su correo electrónico, al que se envía el comprobante de pago.
- `policy.purchase.p[1]`: Los pagos los procesa Prodamus, nuestro proveedor de servicios de pago. Usted introduce los datos de la tarjeta en la página segura de pago de Prodamus: nosotros no los recibimos ni los guardamos. A Prodamus le comunicamos el importe, el número de pedido y su correo electrónico, al que se envía el comprobante de pago.
- `policy.purchase.p[3]`: Si inicia una compra pero no llega a pagarla, conservamos su correo electrónico, el resultado del test y los datos del pedido durante 30 días y después los eliminamos. Durante ese plazo puede recibir, en la dirección indicada, un único correo de recordatorio con el enlace de pago. La base legal del tratamiento son los pasos que usted dio para celebrar el contrato.

## «Cómo se hacen los informes» — `content.howMade`

- `howMade.steps[2]`: <b>El programa compone el informe.</b> Para su perfil y sus puntuaciones elige los textos que la IA escribió de antemano. El informe breve aparece en pantalla al instante; el ampliado se compone tras el pago y se envía por correo electrónico.
- `howMade.benefits[2].p`: El informe breve aparece en pantalla en cuanto responde al último bloque. El ampliado se compone justo después del pago, a cualquier hora del día, sin cita previa ni lista de espera: el correo suele llegar en pocos minutos y, como máximo, en 24 horas desde el pago.
