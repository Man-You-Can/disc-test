# Английская покупка расширенного отчёта — тексты для вычитки носителем

Ветка `en-pay-prodamus`, 19 октября 2026. Здесь собраны все английские тексты, которые появились или изменились на ветке (`src/locales/en.json`). Текст писался заново для англоязычного читателя (американская запись, как остальной сайт), а не переводился с русского; юридические тексты держатся близко к русским. Вычитку делает редактор-носитель; правки вносятся в `src/locales/en.json`, затем `node scripts/validate-locale.js`, `node build.js`, `node scripts/test-apps-script.js`.

Подстановки в фигурных скобках (`{price}`, `{date}`, `{email}`, `{offer}`, `{contact}`, `{order}`, `{site}`, `{k}`, `{name}`, `{pct}`, `{a}`, `{b}`, `{label}`) не переводятся и не удаляются: на их место сайт или сервер ставит значение. `{offer}` — ссылка «terms of sale», `{contact}` — «Contact», `{email}` — info@disc-test.org, `{price}` — 6.99 (перед ним уже стоит «US$»).

## Что проверить по существу (вопросы к заказчику)

1. **Чек и имя в выписке.** Проверочная оплата 1 $ (19 октября) дала квитанцию bePaid «Payment receipt» в долларах; получатель в ней — simpleway.by (белорусский посредник Prodamus), ни Prodamus, ни disc-test.org там нет. Поэтому тексты предупреждают: квитанция придёт от bePaid, а в выписке по карте списание может называться simpleway.by (`pay.note`, `pay.how[1]`, `pay.thanks.next[1]`). Как именно списание записано в банковской выписке, не проверено — сверить по выписке карты заказчика за ту оплату и при необходимости поправить. Пробивает ли Prodamus фискальный чек в рублях (тумблер «Самостоятельное пробитие чеков» выключен — по подсказке кабинета, чеки полного прихода пробивает Prodamus) и на чей ИНН — уточнить у Prodamus или бухгалтера.
2. **Число листов.** «About 27 pages» (было 28): английские образцы — 26–28 листов. Если число листов английского отчёта изменится до запуска, поправить `facts`, `compare`, `faq[1]`, `pdf.facts`.
3. **«Usually within a few minutes»** (`howMade.benefits[2]`, как в русском тексте) и «It usually comes much sooner» (`pay.thanks.lead`) верны, только когда сервер собирает английский отчёт сам сразу после оплаты.
4. **Дата перевода оферты** — `offer.edition`: «English translation updated on October 19, 2026». При вливании в `main` поставить дату публикации.
5. **Название услуги у Prodamus.** На платёжной странице Prodamus услуга называется «DISC Extended Report» (задаёт сервер, `private/server/src/prodamus.js`), а сайт и отчёт называют её «In-depth DISC profile» / «In-depth DISC report»; слова «Extended DISC» — чужая марка (`STYLE-en.md`). Название на странице оплаты лучше привести к сайту.

## Покупка на странице отчёта, «Спасибо», «Оплата не прошла», письмо-напоминание — `content.product.pay` (новое)
- `product.pay.title`: Your report will be built from the test you took on {date}
- `product.pay.text`: The report arrives by email as a PDF attachment, no later than 24 hours after payment. Your payment receipt goes to the same address.
- `product.pay.emailLabel`: Email for your report and receipt
- `product.pay.button`: Buy
- `product.pay.note`: By clicking “Buy”, you accept our {offer}. Payment is handled by Prodamus: you enter your card details on its secure page, not on this site. Your statement may show the charge as simpleway.by.
- `product.pay.badEmail`: Please check the address: your report and receipt will be sent there.
- `product.pay.wait`: Taking you to payment…
- `product.pay.error`: We couldn’t take you to payment. Please try again in a minute or write to us at {email}.
- `product.pay.how[0]`: Take the free test: 24 blocks, about 10 minutes. If you’ve already taken it, there’s no need to retake it: the report is built from the result you already have.
- `product.pay.how[1]`: Enter your email and click “Buy”. You pay in US dollars on the secure page of Prodamus, our payment service. The charge may appear on your card statement as simpleway.by: that’s the card processor Prodamus works with.
- `product.pay.how[2]`: The report arrives by email as a PDF attachment, no later than 24 hours after payment. Your payment receipt goes to the same address.
- `product.pay.thanks.title`: Thank You for Your Purchase — In-Depth DISC Report
- `product.pay.thanks.description`: Your payment for the in-depth DISC report went through: where and when the report will arrive, and what to do if the email doesn’t come.
- `product.pay.thanks.h1`: Thank you! Payment complete
- `product.pay.thanks.lead`: Your report will arrive by email at the address you gave when you paid: a PDF attachment, no later than 24 hours after payment. It usually comes much sooner.
- `product.pay.thanks.leadEmail`: Your report will arrive by email at {email}: a PDF attachment, no later than 24 hours after payment. It usually comes much sooner.
- `product.pay.thanks.order`: Order number: {order}
- `product.pay.thanks.statusWait`: Waiting for the payment service to confirm your payment.
- `product.pay.thanks.statusPaid`: Payment received. Your report is being prepared.
- `product.pay.thanks.statusSent`: Your report has been sent. Check your inbox.
- `product.pay.thanks.nextTitle`: What happens next
- `product.pay.thanks.next[0]`: The email will come from {email}. Its subject line starts with “Your in-depth DISC report”.
- `product.pay.thanks.next[1]`: Your payment receipt comes in a separate email from bePaid, the card processor Prodamus works with. The charge may appear on your card statement as simpleway.by rather than DISC Test.
- `product.pay.thanks.next[2]`: The report has 13 sections. Start with section 1: it explains how to read the rest.
- `product.pay.thanks.helpTitle`: If the email doesn’t arrive
- `product.pay.thanks.help[0]`: Check your spam and promotions folders.
- `product.pay.thanks.help[1]`: If you still can’t find it, write to us at {email} or use the “{contact}” form, and include your order number. We’ll send the report again.
- `product.pay.thanks.back`: Back to the site
- `product.pay.fail.title`: Payment Not Completed — In-Depth DISC Report
- `product.pay.fail.description`: Your payment for the in-depth DISC report didn’t go through: what you can do and how to reach us.
- `product.pay.fail.h1`: Your payment didn’t go through
- `product.pay.fail.lead`: The payment wasn’t completed: your order is unpaid, and no report has been sent.
- `product.pay.fail.order`: Order number: {order}
- `product.pay.fail.tryTitle`: What you can do
- `product.pay.fail.try[0]`: Check your card details and make sure your card allows online and international payments.
- `product.pay.fail.try[1]`: Try a different card or payment method.
- `product.pay.fail.try[2]`: Try again in a few minutes.
- `product.pay.fail.button`: Try again
- `product.pay.fail.charged`: If you were charged anyway, write to us at {email} or use the “{contact}” form, and include your order number. We’ll look into it and reply within three business days.
- `product.pay.remind.subject`: Your in-depth DISC report is waiting for payment
- `product.pay.remind.intro`: You started ordering the in-depth DISC report on {site}, but the payment wasn’t completed. Your order has been saved, and the report will be built from your result for this profile:
- `product.pay.remind.price`: The price is US${price}. Once you pay, the report will arrive at this address as a PDF attachment, and your receipt will follow in a separate email.
- `product.pay.remind.button`: Complete payment
- `product.pay.remind.valid`: The link takes you to the secure Prodamus payment page and works until {date}.
- `product.pay.remind.footer`: We’re sending this email only once: an order (no. {order}) with this address was placed on {site}. If you don’t need the report, or you didn’t place the order, there’s nothing you need to do: the order will be canceled automatically, and you won’t hear from us about it again.

## Личные зацепки, закреплённая кнопка, карточка вернувшегося посетителя — `content.product.promo` (новое)

- `product.promo.lead`: Based on your answers, it covers:
- `product.promo.hooks.low`: {k}, {name}, your lowest scale at {pct}%: what it means
- `product.promo.hooks.flat`: your balanced profile: what it means and how to read it
- `product.promo.hooks.moderate`: your primary style, {k}, is only moderately strong at {pct}%: how to read the descriptions
- `product.promo.hooks.pairMid`: your {a} + {b} combination: what it gives you and how it differs from a pure {a}
- `product.promo.hooks.pairClose`: your {a} and {b} styles are nearly even: how reliable the order of the letters is
- `product.promo.hooks.pairEqual`: your {a} and {b} styles are tied: why {a} comes first
- `product.promo.hooks.pairEdge`: {b} became your secondary style by a single answer: what that means for you
- `product.promo.hooks.pureHigh`: {k} is at {pct}% but isn’t your secondary style: what a “pure” profile means
- `product.promo.hooks.layersDiff`: your adapted style ({a}) differs from your natural style ({b}): what that costs you
- `product.promo.hooks.layersSame`: your adapted and natural styles match ({k}): the strength and the catch
- `product.promo.tail`: 13 sections in all, including five practices and a 30-day plan.
- `product.promo.button`: In-depth report — US${price}
- `product.promo.close`: Hide
- `product.promo.homeLabel`: Your result from {date}
- `product.promo.homeOpen`: Open result

## Письмо покупателю с отчётом — `content.extendedMail` (новое)

- `extendedMail.subject`: Your in-depth DISC report: {label}
- `extendedMail.intro`: Thank you for your purchase. Your in-depth DISC report is ready. It was prepared for this profile:
- `extendedMail.attached`: Your in-depth report is attached to this email as a PDF.
- `extendedMail.how`: The report has 13 sections. Start with section 1: it explains how to read the rest.
- `extendedMail.help`: If the file won’t open or something in the report looks wrong, just reply to this email.
- `extendedMail.inviteTitle`: Invite your friends, colleagues and family to take the test
- `extendedMail.invite`: Section 8 of the report shows how to talk to people of each of the four styles. To find out the styles of the people around you, invite them to take the test: it’s free and takes about 10 minutes. Once you know each other’s styles, it’s easier to find common ground.
- `extendedMail.inviteLink`: Here’s a link to the test you can pass on:
- `extendedMail.footer`: You’re receiving this email because you paid for the “In-depth DISC profile” service on disc-test.org. The report is personalized and intended for your personal use only.

## Изменённые тексты страницы отчёта и блока на экране результата — `content.product`

- `product.description`: An in-depth DISC report built from your test result: every scale explained, five practices, a 30-day plan, a sheet for your colleagues. PDF by email, US${price}.
- `product.facts[0]`: 13 sections
- `product.facts[1]`: about 27 pages
- `product.facts[2]`: three worksheets
- `product.facts[3]`: PDF by email
- `product.how[0]`: Take the free test: 24 blocks, about 10 minutes. If you’ve already taken it, there’s no need to retake it: the report is built from the result you already have.
- `product.how[1]`: Pay for the report on the secure page of Prodamus, our payment service.
- `product.how[2]`: The report arrives by email as a PDF attachment, no later than 24 hours after payment.
- `product.faq[0].q`: Is the report written for me, or is it generic text?
- `product.faq[0].a`: It’s built from your answers. The text is written for your profile, one of sixteen. All of section 2 and parts of sections 3, 5, 11, 12 and 13 depend on your numbers: your percentages on the four scales, your “most” and “least” counts and your lowest scale. Your name is on every page.
- `product.faq[1].q`: What format does it come in?
- `product.faq[1].a`: A PDF attached to an email, about 27 A4 pages. It reads well on screen and prints cleanly; each of the three worksheets fits on a single page.
- `product.faq[2].q`: What language is the report in?
- `product.faq[2].a`: In English. The report was written in English from the start, not translated from another language.
- `product.faq[3].q`: Is this a diagnosis or an ability test?
- `product.faq[3].a`: No. The report describes your behavioral style based on your answers. It doesn’t diagnose anything, measure intelligence or predict success.
- `product.faq[4].q`: Can I get a refund?
- `product.faq[4].a`: See the {refund} for when and how refunds are made.
- `product.compare[2][0]`: Length
- `product.compare[2][1]`: A short take on each topic
- `product.compare[2][2]`: 13 sections, about 27 pages
- `product.buy.testTitle`: The report is built from your test result
- `product.buy.testText`: Take the free test first: 24 blocks, about 10 minutes. You’ll see your result and your summary report right away.
- `product.buy.testButton`: Take the test
- `product.buy.orderTitle`: Your report will be built from the test you took on {date}
- `product.buy.orderText`: Online payment is temporarily unavailable. Leave a request and we’ll email you as soon as you can pay.
- `product.buy.orderButton`: Leave a request
- `product.buy.orderMsg`: I’d like to buy the in-depth DISC report. Please email me when I can pay for it. ⏎  ⏎ My result: {link}
- `product.pdf.facts[0][0]`: 27
- `product.pdf.facts[0][1]`: pages
- `product.pdf.where`: Learn more and order:
- `product.block.button`: Get the in-depth report
- `product.block.topButton`: Get the report — US${price}

Примечание: `buy.orderText`, `buy.orderButton`, `buy.orderMsg` показываются, только если на сайте выключена оплата (нет `payEndpoint`) — тогда вместо «Buy» остаётся заявка, как в русской версии.

## «Services» — `content.services.sections[0]`

- `services.sections[0].p[0]`: The in-depth profile is emailed to the address you give at payment, no later than 24 hours after payment.

## Оферта и условия возврата (юридические, близко к русскому тексту)

- `offer.edition`: Version of October 9, 2026. English translation updated on October 19, 2026.
- `offer.note`: This is an English translation of the original offer published at {original}. If the two texts differ, the original prevails, except for the price and the way payment is made: for the English version of the Site they are set out in sections 1 and 3.
- `offer.sections[0].ul[6]`: Payment Service — Prodamus, the payment service provider through which the Customer pays for the Service on its secure payment page.
- `offer.sections[2].p[1]`: 3.2. The Service is paid for in full before it is provided, by payment card or another non-cash method shown on the payment page. Payment is accepted by the Payment Service.
- `offer.sections[2].p[2]`: 3.3. The Service is deemed paid at the moment the Provider receives confirmation of the payment from the Payment Service.
- `offer.sections[2].p[3]`: 3.4. The Customer enters their card details on the Payment Service’s secure page. The Provider does not receive or store these details.
- `offer.sections[7].p[1]`: 8.2. The data is passed only to the Payment Service, to accept payment and send the receipt, and to the services needed to prepare and send the In-depth Profile, and in the cases provided by law.
- `refund.note`: This is an English translation of the original refund policy published at {original}. If the two texts differ, the original prevails.

## Данные покупателя на странице «Privacy» — `content.policy.purchase` и прежняя редакция `content.privacy.purchase`

- `policy.purchase.p[1]`: Payments are processed by Prodamus, our payment service provider. You enter your card details on its secure payment page: we do not receive or store them. Prodamus receives the amount, the order number and your email address, to which it sends the receipt.
- `policy.purchase.p[3]`: If you start a purchase but do not pay, we keep your email address, test result and order details for 30 days and then delete them. During that time one reminder email with a payment link may be sent to the address you gave. The basis is the steps you took toward entering into the contract.
- `privacy.purchase.p[1]`: Payments are processed by Prodamus, our payment service provider. You enter your card details on its secure payment page: we do not receive or store them. Prodamus receives the amount, the order number and your email address, to which it sends the receipt.

## «How reports are made» — `content.howMade`

- `howMade.steps[2]`: <b>The program builds the report.</b> It picks the texts that fit your profile and your numbers from a set written by AI in advance. The summary report appears on screen right away; the in-depth report is assembled after payment and emailed to you.
- `howMade.benefits[2].h`: Results right away
- `howMade.benefits[2].p`: The summary report appears on screen the moment you finish the last block. The in-depth report is assembled as soon as you pay, at any hour of the day or night, with no appointment and no waiting list: the email usually arrives within a few minutes and no later than 24 hours after payment.
