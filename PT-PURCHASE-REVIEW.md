# Португальская покупка расширенного отчёта — тексты для вычитки носителем

Ветка `pt-pay-prodamus`, 19 октября 2026 (от `main`, в которую уже влита английская покупка `en-pay-prodamus`). Здесь собраны все португальские тексты, которые появились или изменились на ветке (`src/locales/pt.json`). Текст писался заново для бразильского читателя (você, запись португальского сайта), а не переводился с русского или английского; юридические тексты держатся близко к русским. Тексты прошли одну вычитку свежим взглядом (агент в роли бразильского редактора, 8 из 10, принятые замечания внесены); носитель их не читал. Правки вносятся в `src/locales/pt.json`, затем `node scripts/validate-locale.js`, `node build.js`, `node scripts/test-apps-script.js`.

Подстановки в фигурных скобках (`{price}`, `{date}`, `{email}`, `{offer}`, `{contact}`, `{order}`, `{site}`, `{k}`, `{name}`, `{pct}`, `{a}`, `{b}`, `{label}`, `{original}`) не переводятся и не удаляются: на их место сайт или сервер ставит значение. `{offer}` — ссылка «Termos de venda», `{contact}` — «Contato», `{email}` — info@disc-test.org, `{price}` — 6,99 (перед ним уже стоит «US$ »).

## Что проверить по существу (решения и вопросы к заказчику)

1. **IOF** (решение заказчика 19 октября 2026: «убери»). Налог бразильского банка на покупку в долларах (с 2025 года 3,5 %) в текстах сайта не упоминается.
2. **Страница оплаты Prodamus только на английском** (ответ заказчика 19 октября 2026). Поэтому `pay.how[1]` предупреждает: «a página é em inglês».
3. **Квитанция и имя в выписке** — как в английской версии: квитанция приходит от bePaid, в выписке может стоять simpleway.by (`pay.note`, `pay.how[1]`, `pay.thanks.next[1]`).
4. **Число листов** — «cerca de 29 páginas» (`facts`, `compare`, `faq[1]`, `pdf.facts`; решение на усмотрение сессии по слову заказчика 19 октября 2026): у 10 португальских профилей из 16 по 29 листов, у I, D, S, C, CD, DS — 28.
5. **Раздел 10** на странице отчёта переименован как в самом отчёте: «Você como líder e como membro da equipe» (было «…e como liderado»: в слове `liderado` есть род, а отчёт обращается к читателю без мужских и женских форм). Вопрос и редактору отчёта.
6. **Дата перевода оферты** — `offer.edition`: «atualizada em 19 de outubro de 2026». При вливании в `main` поставить дату публикации.
7. **Цена в письме-напоминании** записывается по-бразильски, «US$ 6,99»: ядро (`composePayRemindMail`) теперь пишет цену в долларах в записи языка; в английском письме — по-прежнему «US$6.99».
8. **Не принято из вычитки**: замечание к `policy.purchase.p[3]` и `privacy.purchase.p[3]` («A base legal são as providências que você tomou para celebrar o contrato» → формулировка LGPD «procedimentos preliminares relacionados a contrato… a pedido do titular»). Это прежний текст политики, он не менялся на ветке; показать юристу вместе с остальными юридическими текстами.

Примечание: `buy.orderText`, `buy.orderButton`, `buy.orderMsg` показываются, только если на сайте выключена оплата (нет `payEndpoint`) — тогда вместо «Comprar» остаётся заявка, как в русской версии.

## Покупка на странице отчёта, «Obrigado», «Pagamento não concluído», письмо-напоминание — `content.product.pay` (новое)

- `product.pay.title`: Seu relatório será montado com base no teste que você fez em {date}
- `product.pay.text`: O relatório chega ao seu e-mail em PDF, como anexo, em até 24 horas após o pagamento. O comprovante de pagamento vai para o mesmo endereço.
- `product.pay.emailLabel`: E-mail para o relatório e o comprovante
- `product.pay.button`: Comprar
- `product.pay.note`: Ao clicar em “Comprar”, você aceita os {offer}. O pagamento é em dólares, na página segura da Prodamus: você informa os dados do cartão lá, e não neste site. Na fatura, a cobrança pode aparecer como simpleway.by.
- `product.pay.badEmail`: Confira o endereço: o relatório e o comprovante serão enviados para ele.
- `product.pay.wait`: Redirecionando para o pagamento…
- `product.pay.error`: Não foi possível abrir a página de pagamento. Tente de novo em instantes ou escreva para {email}.
- `product.pay.how[0]`: Faça o teste gratuito: 24 blocos, cerca de 10 minutos. Se você já fez, não precisa repetir: o relatório é montado a partir do resultado que você já tem.
- `product.pay.how[1]`: Informe seu e-mail e clique em “Comprar”. Você paga em dólares americanos na página segura da Prodamus, nossa prestadora de serviços de pagamento; a página é em inglês. Na fatura, a cobrança pode aparecer como simpleway.by, nome usado pela bePaid, a processadora de cartões da Prodamus.
- `product.pay.how[2]`: O relatório chega ao seu e-mail em PDF, como anexo, em até 24 horas após o pagamento. O comprovante de pagamento vai para o mesmo endereço.
- `product.pay.thanks.title`: Obrigado pela compra — Relatório DISC ampliado
- `product.pay.thanks.description`: O pagamento do relatório DISC ampliado foi aprovado: onde e quando o relatório chega e o que fazer se o e-mail não chegar.
- `product.pay.thanks.h1`: Obrigado! Pagamento concluído
- `product.pay.thanks.lead`: O relatório chega ao e-mail que você informou no pagamento: um PDF anexado, em até 24 horas após o pagamento. Em geral, chega bem antes.
- `product.pay.thanks.leadEmail`: O relatório chega ao e-mail {email}: um PDF anexado, em até 24 horas após o pagamento. Em geral, chega bem antes.
- `product.pay.thanks.order`: Número do pedido: {order}
- `product.pay.thanks.statusWait`: Aguardando a confirmação do pagamento pela Prodamus.
- `product.pay.thanks.statusPaid`: Pagamento recebido. O relatório está sendo preparado.
- `product.pay.thanks.statusSent`: O relatório foi enviado. Confira a sua caixa de entrada.
- `product.pay.thanks.nextTitle`: O que acontece agora
- `product.pay.thanks.next[0]`: O e-mail será enviado por {email}, com um assunto que começa com “Seu relatório DISC ampliado”.
- `product.pay.thanks.next[1]`: O comprovante de pagamento chega em outro e-mail, da bePaid, a processadora de cartões da Prodamus. Na fatura do cartão, a cobrança pode aparecer como simpleway.by, e não como DISC Test.
- `product.pay.thanks.next[2]`: O relatório tem 13 seções. Comece pela seção 1: ela explica como ler as demais.
- `product.pay.thanks.helpTitle`: Se o e-mail não chegar
- `product.pay.thanks.help[0]`: Confira as pastas Spam e Promoções.
- `product.pay.thanks.help[1]`: Se mesmo assim não encontrar, escreva para {email} ou use o formulário “{contact}” e informe o número do pedido. Enviaremos o relatório de novo.
- `product.pay.thanks.back`: Voltar ao site
- `product.pay.fail.title`: Pagamento não concluído — Relatório DISC ampliado
- `product.pay.fail.description`: O pagamento do relatório DISC ampliado não foi concluído: o que você pode fazer e como falar conosco.
- `product.pay.fail.h1`: O pagamento não foi concluído
- `product.pay.fail.lead`: Seu pedido continua em aberto, e o relatório ainda não foi enviado.
- `product.pay.fail.order`: Número do pedido: {order}
- `product.pay.fail.tryTitle`: O que você pode fazer
- `product.pay.fail.try[0]`: Confira os dados do cartão e veja se ele está liberado para compras on-line e internacionais.
- `product.pay.fail.try[1]`: Tente outro cartão ou outro meio de pagamento.
- `product.pay.fail.try[2]`: Tente de novo daqui a alguns minutos.
- `product.pay.fail.button`: Tentar de novo
- `product.pay.fail.charged`: Se o valor foi cobrado mesmo assim, escreva para {email} ou use o formulário “{contact}” e informe o número do pedido. Vamos verificar e responder em até três dias úteis.
- `product.pay.remind.subject`: Seu relatório DISC ampliado está aguardando o pagamento
- `product.pay.remind.intro`: Você iniciou a compra do relatório DISC ampliado em {site}, mas o pagamento não foi concluído. Seu pedido está salvo, e o relatório será montado a partir do seu resultado, para este perfil:
- `product.pay.remind.price`: O preço é US$ {price}. Depois do pagamento, o relatório chega a este endereço em PDF, como anexo, e o comprovante vem em outro e-mail.
- `product.pay.remind.button`: Concluir o pagamento
- `product.pay.remind.valid`: O link leva à página segura de pagamento da Prodamus e vale até {date}.
- `product.pay.remind.footer`: Enviamos este e-mail uma única vez porque um pedido (nº {order}) foi feito em {site} com este endereço. Se você não precisa do relatório ou não fez esse pedido, não é preciso fazer nada: o pedido será cancelado automaticamente, e você não receberá mais mensagens sobre ele.

## Личные зацепки, закреплённая кнопка, карточка вернувшегося посетителя — `content.product.promo` (новое)

- `product.promo.lead`: Com base nas suas respostas, o relatório trata de:
- `product.promo.hooks.low`: {k}, {name}, a sua escala mais baixa, com {pct}%: o que isso significa
- `product.promo.hooks.flat`: o seu perfil equilibrado: o que isso significa e como lê-lo
- `product.promo.hooks.moderate`: o seu estilo predominante, {k}, tem só {pct}%, uma intensidade moderada: como ler as descrições
- `product.promo.hooks.pairMid`: a sua combinação {a} + {b}: o que ela traz e em que difere do {a} puro
- `product.promo.hooks.pairClose`: os seus estilos {a} e {b} estão quase empatados: até que ponto a ordem das letras é confiável
- `product.promo.hooks.pairEqual`: os seus estilos {a} e {b} estão empatados: por que o {a} vem primeiro
- `product.promo.hooks.pairEdge`: o {b} passou a ser o seu estilo secundário por uma resposta de diferença: o que isso significa para você
- `product.promo.hooks.pureHigh`: o {k} tem {pct}%, mas não é o seu estilo secundário: o que significa um perfil “puro”
- `product.promo.hooks.layersDiff`: o seu perfil adaptado ({a}) difere do natural ({b}): o que isso exige de você
- `product.promo.hooks.layersSame`: o seu perfil adaptado e o natural coincidem ({k}): o ponto forte e o ponto de atenção
- `product.promo.tail`: Ao todo, 13 seções, com cinco práticas e um plano de 30 dias.
- `product.promo.button`: Relatório ampliado — US$ {price}
- `product.promo.close`: Ocultar
- `product.promo.homeLabel`: Seu resultado de {date}
- `product.promo.homeOpen`: Ver o resultado

## Письмо покупателю с отчётом — `content.extendedMail` (новое)

- `extendedMail.subject`: Seu relatório DISC ampliado: {label}
- `extendedMail.intro`: Obrigado pela compra. Seu relatório DISC ampliado está pronto. Ele foi preparado para este perfil:
- `extendedMail.attached`: O relatório ampliado segue anexo a este e-mail, em PDF.
- `extendedMail.how`: O relatório tem 13 seções. Comece pela seção 1: ela explica como ler as demais.
- `extendedMail.help`: Se o arquivo não abrir ou algo no relatório parecer errado, é só responder a este e-mail.
- `extendedMail.inviteTitle`: Convide amigos, colegas e familiares para fazer o teste
- `extendedMail.invite`: A seção 8 do relatório mostra como falar com pessoas de cada um dos quatro estilos. Para descobrir o estilo de quem está à sua volta, convide essas pessoas para fazer o teste: é gratuito e leva cerca de 10 minutos. Quando cada um conhece o estilo do outro, fica mais fácil se entender.
- `extendedMail.inviteLink`: Este é o link do teste para compartilhar:
- `extendedMail.footer`: Você recebeu este e-mail porque pagou pelo serviço “Perfil DISC ampliado” em disc-test.org. O relatório é personalizado e destinado somente ao seu uso pessoal.

## Листы образца на странице отчёта — `sampleTitle`, `sampleNote`, `sampleAlt`, `sampleCaption`, `block.sample`, `pdf.sheets` (новое)

- `product.sampleTitle`: Como é o relatório
- `product.sampleNote`: Quatro páginas do relatório de uma participante fictícia com o perfil Inspirador. O seu relatório traz o seu nome, os seus números e o texto do seu perfil. Clique em uma página para vê-la em tamanho maior.
- `product.sampleAlt[0]`: Página do relatório DISC ampliado: a capa com o perfil da participante e o sumário das 13 seções
- `product.sampleAlt[1]`: Página do relatório DISC ampliado: a seção “Seu perfil em detalhes”, com as quatro escalas e o que cada uma significa
- `product.sampleAlt[2]`: Página do relatório DISC ampliado: a seção “Comunicação com cada um dos quatro estilos”
- `product.sampleAlt[3]`: Página do relatório DISC ampliado: a folha de trabalho “Plano de 30 dias”
- `product.sampleCaption[0]`: Capa e sumário
- `product.sampleCaption[1]`: Seção 2: as suas escalas
- `product.sampleCaption[2]`: Seção 8: como falar com cada estilo
- `product.sampleCaption[3]`: Seção 11: plano de 30 dias
- `product.pdf.sheets[0]`: 2
- `product.pdf.sheets[1]`: 4
- `product.block.sample`: Páginas do relatório de uma participante fictícia

## Изменённые тексты страницы отчёта и блока на экране результата — `content.product`

- `product.description`: Relatório DISC ampliado com base no seu resultado: escala por escala, cinco práticas, plano de 30 dias, folha para compartilhar com os colegas. PDF por e-mail, US$ {price}.
- `product.facts[1]`: cerca de 29 páginas A4
- `product.inside[9]`: <b>Você como líder e como membro da equipe.</b> O que você faz bem, o que atrapalha e como lidar com um gestor de cada estilo: prestar contas, discordar, fazer pedidos.
- `product.compare[2][2]`: 13 seções, cerca de 29 páginas
- `product.how[1]`: Pague pelo relatório na página segura da Prodamus, nossa prestadora de serviços de pagamento.
- `product.how[2]`: O relatório chega ao seu e-mail em PDF, como anexo, em até 24 horas após o pagamento.
- `product.faq[1].a`: Em um arquivo PDF anexado ao e-mail, com cerca de 29 páginas A4. Dá para ler bem na tela e para imprimir; cada uma das três folhas de trabalho cabe em uma única página.
- `product.faq[2].a`: Em português do Brasil. O relatório foi escrito diretamente em português, e não traduzido de outro idioma.
- `product.buy.testText`: Primeiro, faça o teste gratuito: 24 blocos, cerca de 10 minutos. Você verá o resultado e o relatório resumido na hora.
- `product.buy.orderText`: O pagamento on-line está temporariamente indisponível. Deixe seu contato e avisaremos por e-mail assim que for possível pagar.
- `product.buy.orderButton`: Deixar meu contato
- `product.buy.orderMsg`: Quero comprar o relatório DISC ampliado. Por favor, me avisem por e-mail quando for possível pagar. ⏎  ⏎ Meu resultado: {link}
- `product.pdf.facts[0][0]`: 29
- `product.pdf.where`: Saiba mais e compre:
- `product.block.button`: Quero o relatório ampliado
- `product.block.topButton`: Quero o relatório — US$ {price}
- `product.block.soon`: (удалено)

## «Serviços» — `content.services.sections[0]`

- `services.sections[0].p[0]`: O perfil ampliado é enviado por e-mail para o endereço informado no pagamento, em até 24 horas após o pagamento.

## Оферта и условия возврата (юридические, близко к русскому тексту)

- `offer.edition`: Versão de 9 de outubro de 2026. Tradução para o português atualizada em 19 de outubro de 2026.
- `offer.note`: Este texto é a tradução para o português da oferta original publicada em {original}. Em caso de divergência entre os dois textos, prevalece o original, exceto quanto ao preço e à forma de pagamento: na versão em português do Site, eles estão definidos nas seções 1 e 3.
- `offer.sections[0].ul[6]`: Serviço de Pagamento — a Prodamus, prestadora de serviços de pagamento em cuja página segura o Cliente paga pelo Serviço.
- `offer.sections[2].p[1]`: 3.2. O Serviço é pago integralmente antes da prestação, por cartão de crédito ou débito ou outro meio eletrônico exibido na página de pagamento. O pagamento é processado pelo Serviço de Pagamento.
- `offer.sections[2].p[2]`: 3.3. O Serviço é considerado pago no momento em que o Prestador recebe do Serviço de Pagamento a confirmação do pagamento.
- `offer.sections[2].p[3]`: 3.4. O Cliente informa os dados do cartão na página segura do Serviço de Pagamento. O Prestador não recebe nem armazena esses dados.
- `offer.sections[7].p[1]`: 8.2. Os dados são transmitidos apenas ao Serviço de Pagamento, para o processamento do pagamento e o envio do comprovante, e aos serviços necessários para preparar e enviar o Perfil Ampliado, além dos casos previstos em lei.
- `refund.note`: Este texto é a tradução para o português da política de reembolso original publicada em {original}. Em caso de divergência entre os dois textos, prevalece o original.

## Данные покупателя на странице «Privacidade» — `content.policy.purchase` и прежняя редакция `content.privacy.purchase`

- `privacy.purchase.p[1]`: Os pagamentos são processados pela Prodamus, nossa prestadora de serviços de pagamento. Você informa os dados do cartão na página segura de pagamento dela: nós não os recebemos nem armazenamos. A Prodamus recebe o valor, o número do pedido e seu e-mail, para o qual o comprovante é enviado.
- `policy.purchase.p[1]`: Os pagamentos são processados pela Prodamus, nossa prestadora de serviços de pagamento. Você informa os dados do cartão na página segura de pagamento dela: nós não os recebemos nem armazenamos. A Prodamus recebe o valor, o número do pedido e seu e-mail, para o qual o comprovante é enviado.
- `policy.purchase.p[3]`: Se você iniciar uma compra, mas não pagar, guardamos seu e-mail, o resultado do teste e os dados do pedido por 30 dias e depois os excluímos. Nesse período, o endereço informado pode receber um único e-mail de lembrete com o link de pagamento. A base legal são as providências que você tomou para celebrar o contrato.

## «Como os relatórios são feitos» — `content.howMade`

- `howMade.steps[2]`: <b>O programa monta o relatório.</b> De acordo com o seu perfil e os seus números, ele seleciona os textos escritos de antemão pela IA. O relatório resumido aparece na tela na hora; o ampliado é montado depois do pagamento e enviado por e-mail.
- `howMade.benefits[2].p`: O relatório resumido aparece na tela assim que você responde ao último bloco. O ampliado é montado logo após o pagamento, a qualquer hora do dia ou da noite, sem agendamento nem fila: o e-mail costuma chegar em poucos minutos e, no máximo, em 24 horas após o pagamento.
