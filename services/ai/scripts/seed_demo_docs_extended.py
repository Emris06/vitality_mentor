"""Extended demo doc set (Part 10).

Adds 14 more synthetic SOP-style documents on top of the 6 ingested by
`seed_demo_docs.py`, giving the Ideathon demo a ~20-document corpus so the
RAG retriever has enough breadth to look impressive on stage.

Topics (lang count in brackets):
    - Currency exchange operations          [en, ru, uz] = 3
    - Wire transfer procedure               [en, ru, uz] = 3
    - AML escalation                        [ru, uz]     = 2
    - New product onboarding                [ru, uz]     = 2
    - Dress code for back-office            [ru]         = 1
    - Customer complaint handling           [en, ru]     = 2
                                            total        = 13
    (we round to 14 by adding a second uz wire-transfer reference card)

Every document is **synthetic** — invented for the demo. The `source_uri`
scheme is `synthetic://<topic>/<lang>` so that the existing ingestion
pipeline's `delete_by_source_uri` keeps reruns idempotent.

Run:
    cd services/ai
    python -m scripts.seed_demo_docs_extended

Import:
    from scripts.seed_demo_docs_extended import main as seed_extended
    await seed_extended()
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass
from typing import Literal

from app.db import close_pool
from app.rag.ingest import delete_by_source_uri, ingest_document

Lang = Literal["uz", "ru", "en"]


@dataclass
class SeedDoc:
    title: str
    source_uri: str
    lang: Lang
    text: str


# ---------------------------------------------------------------------------
# Currency exchange — en / ru / uz
# ---------------------------------------------------------------------------

EN_FX = """\
Currency Exchange Operations SOP

Purpose. This procedure governs cash currency exchange at retail branches.
The goal is uniform pricing, reliable record-keeping, and a clear separation
between teller and cashier roles.

Scope. Applies to spot exchange of UZS against USD, EUR, RUB, GBP, and CHF
for resident individuals up to the equivalent of 100,000 USD per calendar
month. Larger amounts and non-resident operations are out of scope and must
be routed to the FX desk.

Step 1. Capture the client identifier — for amounts under 1,000 USD a
passport scan suffices. For higher amounts, follow the KYC SOP first.

Step 2. Pull the indicative rate from the morning FX board. The spread for
retail clients is 0.6% on USD, 0.8% on EUR, 1.0% on RUB. Rates are refreshed
hourly; never quote a rate older than one hour.

Step 3. Issue the transaction slip in two copies. The client keeps one,
the second is filed with the cash audit at end of day.

Step 4. Reconcile the cash drawer at end of shift. Any discrepancy above
the equivalent of 5 USD requires a manager sign-off and a written note.

Audit. The branch FX log is reviewed weekly by Compliance. Patterns of
structured exchange (multiple sub-threshold operations within a short
window) trigger an AML review per the AML SOP.
"""

RU_FX = """\
Регламент валютно-обменных операций

Назначение. Документ устанавливает порядок наличного обмена иностранной
валюты в отделениях. Цель — единое ценообразование, чёткая отчётность и
разделение функций кассира и контролёра.

Шаг 1. Зафиксировать клиента. До 1 000 долларов США достаточно паспорта;
выше — выполнить процедуру KYC по соответствующему СОП.

Шаг 2. Применять курс с утренней доски обмена. Розничный спред: USD 0,6%,
EUR 0,8%, RUB 1,0%, GBP 1,0%, CHF 1,0%. Курсы обновляются каждый час;
запрещено применять курс старше одного часа.

Шаг 3. Оформлять операцию в двух экземплярах. Один экземпляр выдаётся
клиенту, второй подшивается в кассовую отчётность смены.

Шаг 4. Сверка кассы по окончании смены. Расхождение свыше эквивалента
5 долларов США требует подписи руководителя и письменного объяснения.

Аудит. Журнал валютных операций отделения еженедельно проверяется
комплаенсом. Признаки дробления (несколько операций ниже порога в коротком
интервале) направляются на проверку по СОП ПОД/ФТ.

Лимит. Для резидентов — не более эквивалента 100 000 долларов США в
календарный месяц. Превышение — перенаправить на FX-стол головного офиса.
"""

UZ_FX = """\
Valyuta ayirboshlash operatsiyalari tartibi

Maqsad. Hujjat filiallarda naqd valyuta ayirboshlash tartibini belgilaydi.
Maqsad — yagona narx siyosati, ishonchli hisobot va kassir bilan nazoratchi
rollarining aniq ajratilishi.

1-bosqich. Mijozni qayd eting. 1 000 AQSh dollarigacha pasportning skani
yetarli; undan yuqorisida — KYC SOP boyicha qayta tasdiqlang.

2-bosqich. Ertalabki ayirboshlash taxtasidagi kursni qollang. Chakana
spread: USD 0,6%, EUR 0,8%, RUB 1,0%. Kurslar har soatda yangilanadi;
bir soatdan eski kursni qollash taqiqlanadi.

3-bosqich. Operatsiyani ikki nusxada rasmiylashtiring. Bir nusxa mijozda
qoladi, ikkinchisi smena yakunida kassa hisobotiga tikiladi.

4-bosqich. Smena oxirida kassani sverka qiling. 5 AQSh dollari ekvivalentidan
yuqori farq filial boshqaruvchisining imzosi va yozma izohni talab qiladi.

Limit. Rezident mijozlar uchun bir oyda 100 000 AQSh dollari ekvivalentidan
oshmasligi kerak. Undan yuqori summalar bosh ofisning FX-stoliga
yonaltiriladi. (Sintetik hujjat.)
"""

# ---------------------------------------------------------------------------
# Wire transfer procedure — en / ru / uz
# ---------------------------------------------------------------------------

EN_WIRE = """\
Wire Transfer Procedure (SWIFT MT103)

Purpose. This procedure defines how operations officers process outgoing
international wire transfers initiated at the branch.

Pre-checks. Verify that the originator's account has cleared funds for the
full amount plus the SWIFT commission (currently a flat 25 USD plus 0.1%
for amounts above 10,000 USD).

Step 1. Capture the beneficiary IBAN, beneficiary name, beneficiary bank
SWIFT/BIC, and the purpose of payment. The purpose must match the operation
code from the local FX classifier — generic descriptions like "services"
are rejected at intake.

Step 2. Screen the beneficiary against the internal sanctions list. Any
hit on a denied-party list blocks the transfer and creates a Compliance
review case. The originator must be informed only that the transfer
"requires additional checks"; the screening result is confidential.

Step 3. Submit the MT103 message via the SWIFT gateway. Capture the
returned UETR (Unique End-to-end Transaction Reference) and attach it to
the operation in the core banking system.

Step 4. Send the originator an SMS confirmation that the message was
released to SWIFT. Provide the UETR on request — it allows the client to
trace settlement.

Cut-off times. USD: 17:00 local. EUR: 16:00 local. Outside these windows
the transfer is queued and submitted on the next business day.
"""

RU_WIRE = """\
Порядок исполнения международного перевода (SWIFT MT103)

Назначение. Документ описывает порядок оформления исходящего международного
перевода в отделении.

Предварительные проверки. Убедитесь, что на счёте клиента имеется свободный
остаток, покрывающий сумму перевода и комиссию SWIFT (25 долларов США + 0,1%
для сумм свыше 10 000 долларов США).

Шаг 1. Зафиксируйте IBAN бенефициара, его имя, SWIFT/BIC банка бенефициара
и назначение платежа. Назначение должно соответствовать коду операции из
классификатора; формулировки вроде "услуги" не принимаются.

Шаг 2. Проверьте бенефициара по внутреннему санкционному списку. Любое
совпадение блокирует операцию и создаёт кейс для комплаенс-проверки.
Клиенту сообщается лишь, что перевод "требует дополнительных проверок".

Шаг 3. Отправьте сообщение MT103 через SWIFT-шлюз. Сохраните полученный
UETR (уникальный идентификатор сквозной операции) и привяжите его к
операции в АБС.

Шаг 4. Направьте клиенту SMS-подтверждение об отправке. UETR
предоставляется по запросу и позволяет отследить расчёт.

Время отсечения. USD — 17:00 местного времени. EUR — 16:00. После отсечения
перевод ставится в очередь и отправляется в следующий рабочий день.
"""

UZ_WIRE = """\
Xalqaro pul otkazma tartibi (SWIFT MT103)

Maqsad. Hujjat filialdan yuboriladigan xalqaro pul otkazmasining ishlash
tartibini belgilaydi.

Dastlabki tekshiruvlar. Mijoz hisobida otkazma summasi va SWIFT komissiyasini
qoplaydigan erkin qoldiq mavjudligini tekshiring (hozirgi tarif: qatiy 25
AQSh dollari + 10 000 AQSh dollaridan yuqori summalar uchun 0,1%).

1-bosqich. Beneficiar IBAN, ismi, beneficiar banki SWIFT/BIC va tolovning
maqsadini qayd eting. Maqsad mahalliy operatsiya kodlari klassifikatoriga
mos kelishi shart; "xizmatlar" kabi umumiy izohlar qabul qilinmaydi.

2-bosqich. Beneficiarni ichki sanksiyalar royxati bo'yicha tekshiring.
Mosligan natija operatsiyani bloklaydi va komplaens uchun keys yaratadi.

3-bosqich. MT103 xabarini SWIFT shlyuzi orqali yuboring. Qaytarilgan UETR
qiymatini saqlang va ABS dagi operatsiyaga bog'lang.

4-bosqich. Mijozga SMS tasdiq yuboring. UETR talabga binoan beriladi.

Otkazma vaqti. USD: mahalliy 17:00 gacha. EUR: 16:00 gacha. Bu vaqtdan
keyin yuborilgan otkazmalar navbatga qoyiladi va keyingi ish kuni qayta
ishlanadi.
"""

UZ_WIRE_CARD = """\
SWIFT MT103 — Tezkor karta (Sintetik mashq materiali)

Tekshirilishi shart bolgan maydonlar:
  - Beneficiar IBAN — 24 belgigacha, mamlakat kodi bilan boshlanadi.
  - Beneficiar to'liq ismi — pasportdagi kabi.
  - Beneficiar bankining SWIFT/BIC kodi — 8 yoki 11 belgi.
  - To'lovning maqsadi — operatsiya kodi va qisqacha izoh.

Komissiya:
  - 25 USD qatiy tolov.
  - 10 000 USD dan yuqori summalar uchun qoshimcha 0.1%.

Cut-off:
  - USD operatsiyalari: 17:00 gacha.
  - EUR operatsiyalari: 16:00 gacha.

Sanksiyalar bilan mosligan natijada:
  - Operatsiya bloklanadi.
  - Komplaens xodimiga keys yuboriladi.
  - Mijozga faqat "qoshimcha tekshiruv talab qilinadi" deb ayting.

Mijozga UETR qiymatini berish ortqali u tolov holatini kuzatishi mumkin.
"""

# ---------------------------------------------------------------------------
# AML escalation — ru / uz
# ---------------------------------------------------------------------------

RU_AML_ESC = """\
СОП по эскалации подозрительной активности (расширенный регламент)

Назначение. Документ детализирует порядок эскалации, дополняя базовый
СОП по выявлению подозрительных операций. Применяется при срабатывании
средних и высоких уровней риска по результатам автоматизированного
мониторинга.

Уровни эскалации.
  L1 — операционный сотрудник: формирует внутреннее уведомление (ВУПО)
        в течение того же рабочего дня, прикладывает первичные документы.
  L2 — комплаенс-офицер отделения: рассматривает ВУПО в течение трёх
        рабочих дней, при подтверждении передаёт в управление комплаенса.
  L3 — управление комплаенса: принимает решение о направлении сообщения
        в уполномоченный орган в установленной форме; срок — пять
        рабочих дней с момента получения L2-материалов.

Параллельные меры. На уровне L2 при высоком риске счёт клиента может быть
временно ограничен (запрет исходящих операций) на срок до 10 рабочих дней.
Решение оформляется внутренним приказом за подписью руководителя
управления комплаенса.

Запрет на разглашение. Информирование клиента или третьих лиц о факте
эскалации квалифицируется как нарушение законодательства и влечёт
дисциплинарную ответственность вплоть до увольнения.

Хранение. Все материалы по эскалации хранятся не менее семи лет с
момента закрытия кейса.
"""

UZ_AML_ESC = """\
Shubhali operatsiyalarni eskalatsiya qilish tartibi (kengaytirilgan)

Maqsad. Hujjat shubhali operatsiyalarni aniqlash boyicha asosiy SOPni
toldiruvchi eskalatsiya tartibini batafsil bayon qiladi.

Eskalatsiya darajalari.
  L1 — operatsion xodim: oson ish kuni davomida ichki xabarnoma (VUPO)
        shakllantiradi va birlamchi hujjatlarni biriktiradi.
  L2 — filial komplaens xodimi: VUPOni uch ish kuni ichida korib chiqadi
        va tasdiqlangan holatlarda komplaens boshqarmasiga yuboradi.
  L3 — komplaens boshqarmasi: vakolatli organga xabar yuborish toGrisida
        qaror qabul qiladi; muddati — L2 materiallarini olgandan boshlab
        5 ish kuni.

Parallel choralar. L2 darajasida yuqori riskda mijoz hisobiga vaqtinchalik
chiqim operatsiyalari taqiqi qoyilishi mumkin (10 ish kunigacha). Qaror
komplaens boshqarmasi rahbarining ichki buyrugi bilan rasmiylashtiriladi.

Maxfiylik. Mijoz yoki uchinchi shaxslarga eskalatsiya haqida xabar berish
qonunchilik buzilishi sifatida baholanadi.

Saqlash. Eskalatsiya boyicha barcha materiallar keys yopilgandan boshlab
kamida 7 yil saqlanadi.
"""

# ---------------------------------------------------------------------------
# New product onboarding — ru / uz
# ---------------------------------------------------------------------------

RU_NEW_PRODUCT = """\
Регламент вывода нового банковского продукта

Назначение. Документ описывает порядок запуска нового розничного продукта
(депозит, карта, кредит) на отделения, начиная с пилотного периода и
заканчивая полным развёртыванием.

Этап 1. Подготовка. Продуктовая группа готовит описание продукта, тарифы,
проект договора, скрипты для фронт-офиса и обучающий материал для iSpring.

Этап 2. Пилот. Продукт запускается в 5-7 отделениях на 4 недели. В этот
период собираются метрики: время оформления, доля отказов, NPS, ошибки
скриптов. Еженедельный отчёт направляется комитету по продуктам.

Этап 3. Решение комитета. По итогам пилота комитет принимает одно из
решений: масштабировать, доработать, отменить. Решение фиксируется
протоколом.

Этап 4. Масштабирование. При положительном решении тарифы и материалы
выгружаются в ABS, скрипты обновляются во фронт-офисе, обучающий курс
становится обязательным для всех сотрудников затронутых отделений.

Контроль. Через 90 дней после полного запуска продукт проходит
post-launch review: сравниваются плановые и фактические показатели,
формируется список улучшений на следующий релиз.
"""

UZ_NEW_PRODUCT = """\
Yangi bank mahsulotini ishga tushirish tartibi

Maqsad. Hujjat yangi chakana mahsulotni (depozit, karta, kredit) filiallar
boyicha ishga tushirish tartibini belgilaydi: pilot bosqichidan to liq
joriy etishgacha.

1-bosqich. Tayyorgarlik. Mahsulot guruhi mahsulot tavsifi, tariflar,
shartnoma loyihasi, front-ofis skriptlari va iSpring uchun oqitish
materialini tayyorlaydi.

2-bosqich. Pilot. Mahsulot 5-7 filialda 4 hafta davomida ishga tushiriladi.
Bu davrda metrikalar yigiladi: rasmiylashtirish vaqti, rad etish ulushi,
NPS va skript xatolari. Haftalik hisobot mahsulot komitetiga yuboriladi.

3-bosqich. Komitet qarori. Pilot natijalari boyicha komitet uch qarordan
birini qabul qiladi: kengaytirish, qayta ishlash yoki bekor qilish.

4-bosqich. Kengaytirish. Ijobiy qarorda tariflar va materiallar ABSga
yuklanadi, skriptlar yangilanadi, oqitish kursi tegishli filiallarning
barcha xodimlari uchun majburiy boladi.

Nazorat. Toliq ishga tushirilgandan 90 kun keyin mahsulot post-launch
review dan otadi: rejali va haqiqiy korsatkichlar taqqoslanadi va keyingi
relizga yaxshilashlar royxati shakllantiriladi.
"""

# ---------------------------------------------------------------------------
# Dress code for back-office — ru
# ---------------------------------------------------------------------------

RU_DRESS_BO = """\
Дресс-код для сотрудников бэк-офиса

Назначение. Документ уточняет требования к внешнему виду сотрудников
бэк-офиса в дополнение к общей политике дресс-кода банка.

Понедельник-четверг. Допускается business casual: классические брюки или
чиносы, рубашка с воротником, для женщин — блузка или джемпер с юбкой
или брюками. Закрытая обувь обязательна.

Пятница. Разрешены аккуратные джинсы без потёртостей и поло. Шорты,
спортивные костюмы и пляжная обувь не допускаются ни в один из дней.

Видеоконференции с клиентами. Если сотрудник участвует в видеовстрече с
клиентом, требования business formal применяются на весь день встречи
независимо от расписания: тёмный костюм / костюмная двойка, однотонная
сорочка или блузка.

Видимые татуировки и пирсинг (кроме одной пары простых серёг) должны быть
прикрыты в течение всего рабочего дня. Личная гигиена и опрятная причёска —
обязательны.

Контроль. Нарушения фиксируются непосредственным руководителем. Повторные
нарушения передаются в HR и могут отразиться на годовой оценке.
"""

# ---------------------------------------------------------------------------
# Customer complaint handling — en / ru
# ---------------------------------------------------------------------------

EN_COMPLAINT = """\
Customer Complaint Handling SOP

Purpose. This procedure defines how a customer complaint is captured,
triaged, resolved, and reported. The goal is a single 10-business-day SLA
from intake to written response.

Step 1. Intake. Any channel (branch, call center, mobile app, email) must
log the complaint into the central CRM with a unique case id. The intake
template requires: customer id, product, summary, customer's requested
outcome, and a category from the fixed taxonomy (Service, Product, Fees,
Technical, Other).

Step 2. Triage (within 1 business day). The complaints team assigns the
case to the responsible department and sets severity (Low, Medium, High).
High severity cases are reviewed by the Head of Customer Experience daily.

Step 3. Resolution. The responsible department contacts the customer
within 3 business days and resolves the case within 10 business days.
Extensions are possible only with the customer's written consent.

Step 4. Closure. The customer receives a written response (email or
letter, depending on customer preference). The CRM record is closed with
the resolution category and a satisfaction-survey link.

Reporting. Aggregate metrics (volume, time-to-resolve, satisfaction) are
reported monthly to the Risk & Customer Committee.
"""

RU_COMPLAINT = """\
СОП по работе с обращениями клиентов

Назначение. Документ определяет порядок регистрации, обработки, решения
и отчётности по обращениям клиентов. Целевой SLA — 10 рабочих дней с
момента регистрации до письменного ответа.

Шаг 1. Регистрация. Любой канал (отделение, контакт-центр, мобильное
приложение, e-mail) регистрирует обращение в CRM с уникальным номером.
Обязательные поля: идентификатор клиента, продукт, суть обращения,
ожидаемый клиентом результат и категория из фиксированного справочника
(Сервис, Продукт, Тарифы, Технический сбой, Прочее).

Шаг 2. Триаж (в течение 1 рабочего дня). Группа по обращениям назначает
ответственное подразделение и устанавливает критичность (низкая, средняя,
высокая). Высокая критичность ежедневно рассматривается руководителем
клиентского сервиса.

Шаг 3. Решение. Ответственное подразделение связывается с клиентом в
течение 3 рабочих дней и закрывает обращение в течение 10 рабочих дней.
Продление возможно только с письменного согласия клиента.

Шаг 4. Закрытие. Клиенту направляется письменный ответ (e-mail или
почтой). В CRM фиксируется категория решения и ссылка на опрос
удовлетворённости.

Отчётность. Сводные метрики ежемесячно передаются комитету по риску и
клиентскому опыту.
"""


DOCS: list[SeedDoc] = [
    SeedDoc("Currency Exchange Operations SOP",      "synthetic://fx/en", "en", EN_FX),
    SeedDoc("Регламент валютно-обменных операций",   "synthetic://fx/ru", "ru", RU_FX),
    SeedDoc("Valyuta ayirboshlash operatsiyalari",   "synthetic://fx/uz", "uz", UZ_FX),
    SeedDoc("Wire Transfer Procedure (SWIFT MT103)", "synthetic://wire/en", "en", EN_WIRE),
    SeedDoc("Порядок исполнения SWIFT MT103",        "synthetic://wire/ru", "ru", RU_WIRE),
    SeedDoc("SWIFT MT103 tartibi",                   "synthetic://wire/uz", "uz", UZ_WIRE),
    SeedDoc("SWIFT MT103 tezkor karta",              "synthetic://wire-card/uz", "uz", UZ_WIRE_CARD),
    SeedDoc("Эскалация подозрительной активности",   "synthetic://aml-esc/ru", "ru", RU_AML_ESC),
    SeedDoc("Shubhali operatsiyalarni eskalatsiya",  "synthetic://aml-esc/uz", "uz", UZ_AML_ESC),
    SeedDoc("Регламент вывода нового продукта",      "synthetic://new-product/ru", "ru", RU_NEW_PRODUCT),
    SeedDoc("Yangi bank mahsulotini ishga tushirish","synthetic://new-product/uz", "uz", UZ_NEW_PRODUCT),
    SeedDoc("Дресс-код для бэк-офиса",               "synthetic://dress-bo/ru", "ru", RU_DRESS_BO),
    SeedDoc("Customer Complaint Handling SOP",       "synthetic://complaint/en", "en", EN_COMPLAINT),
    SeedDoc("СОП по работе с обращениями клиентов",  "synthetic://complaint/ru", "ru", RU_COMPLAINT),
]


async def main() -> None:
    """Ingest the extended demo doc set. Idempotent (delete-then-insert)."""
    print(f"Seeding {len(DOCS)} extended demo documents...")
    try:
        for doc in DOCS:
            deleted = await delete_by_source_uri(doc.source_uri)
            if deleted:
                print(f"  - removed {deleted} prior row(s) for {doc.source_uri}")
            doc_id = await ingest_document(
                title=doc.title,
                source_uri=doc.source_uri,
                text=doc.text,
                lang=doc.lang,
            )
            print(f"  + {doc.lang}  {doc.title}  -> {doc_id}")
        print("done.")
    finally:
        await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
