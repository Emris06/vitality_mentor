"""Seed six synthetic SOP-like documents (2 per language) for demo retrieval.

Run from `services/ai/`:
    python -m scripts.seed_demo_docs

Idempotent: deletes prior rows by source_uri before re-inserting.
All content is synthetic -- it does NOT come from any real bank document.
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


# -- English ----------------------------------------------------------------

EN_KYC = """\
KYC Onboarding Standard Operating Procedure

Purpose. This SOP defines how front-office staff verify the identity of new
retail clients before opening any deposit or transactional account. The
procedure applies to all branches and to remote onboarding through the mobile
channel.

Scope. The procedure covers individual residents and non-residents. Legal
entities are handled by the corporate KYC SOP, which is out of scope here.

Step 1. Collect a government-issued photo ID. Acceptable documents are a
biometric national ID card, an international passport, or a residency permit.
Expired documents must be rejected at intake.

Step 2. Capture a live selfie and run the liveness check. The liveness score
must be at least 0.85. If the score is below threshold, request a second
capture under better lighting before escalating to a manual review.

Step 3. Screen the client against the internal sanctions list and the
politically exposed persons (PEP) list. Any hit must be flagged for the
Compliance officer; do not proceed with onboarding until written clearance
is received.

Step 4. Record the source of funds. For monthly inflows above the equivalent
of 20,000 USD, request supporting documentation such as a salary certificate
or a notarized contract.

Step 5. Assign a risk rating: Low, Medium, or High. High-risk clients require
enhanced due diligence and approval from the branch manager.

Record retention. All onboarding artifacts must be archived in the document
management system for at least five years from account closure.
"""

EN_DRESS = """\
Dress Code Policy

The dress code applies to all employees during business hours, at client
meetings, and at any event where the employee represents the bank. The goal
is to project a consistent, professional image.

Business formal. Required for client-facing roles in branches and for the
treasury floor. For men: dark suit, plain shirt, conservative tie, polished
leather shoes. For women: tailored suit or knee-length skirt with blouse,
closed-toe shoes.

Business casual. Permitted in back-office areas on Mondays through Thursdays.
Tailored trousers or chinos with a collared shirt; blouses or sweaters for
women. Sneakers, shorts, and ripped denim are not permitted at any time.

Friday casual. Polo shirts and clean denim are allowed in back-office areas
on Fridays only. Branch staff continue to wear business formal.

Visible tattoos and piercings other than a single pair of stud earrings must
be covered during client interactions. Hair must be clean and neatly styled.

Violations are addressed by the line manager. Repeated violations may be
referred to HR and may affect the performance review.
"""

# -- Russian ---------------------------------------------------------------

RU_KYC = """\
СОП по идентификации клиента (KYC) при открытии счёта

Назначение. Настоящий документ описывает порядок идентификации физического
лица перед открытием депозитного или расчётного счёта в Туронбанке. Документ
обязателен к применению во всех отделениях и при удалённом обслуживании
через мобильное приложение.

Шаг 1. Принять документ, удостоверяющий личность. Принимаются биометрический
ID-карта, международный паспорт или вид на жительство. Просроченные документы
не принимаются и возвращаются клиенту.

Шаг 2. Сделать селфи и выполнить проверку живости. Минимально допустимый
балл живости — 0.85. При меньшем балле повторите съёмку при лучшем освещении;
при повторной неудаче направьте дело на ручную проверку.

Шаг 3. Проверить клиента по внутреннему санкционному списку и списку
публичных должностных лиц (PEP). Любое совпадение блокирует процесс до
получения письменного разрешения комплаенс-офицера.

Шаг 4. Зафиксировать источник средств. При среднемесячных поступлениях свыше
эквивалента 20 000 долларов США потребуйте подтверждающие документы:
справку о доходах или нотариально заверенный договор.

Шаг 5. Присвоить уровень риска: низкий, средний или высокий. Клиенты с
высоким уровнем риска требуют расширенной проверки и согласования с
управляющим отделением.

Хранение. Все материалы идентификации хранятся в системе документооборота
не менее пяти лет с даты закрытия счёта.
"""

RU_AML = """\
Порядок выявления и сообщения о подозрительных операциях (СПД)

Назначение. Документ определяет действия сотрудников фронт-офиса и
бэк-офиса при выявлении операций, имеющих признаки отмывания денег или
финансирования терроризма.

Признаки подозрительности. К таким признакам относятся: дробление переводов
на суммы чуть ниже порога обязательного контроля, неоднократные операции с
неустановленным экономическим смыслом, переводы в адрес юрисдикций
повышенного риска, а также резкое изменение характера операций по счёту.

Действия сотрудника. При выявлении хотя бы одного признака сотрудник в
течение того же рабочего дня формирует внутреннее уведомление о
подозрительной операции (ВУПО) через систему комплаенс-портала. Самостоятельно
информировать клиента о факте формирования ВУПО запрещено.

Действия комплаенс-офицера. Комплаенс-офицер обязан рассмотреть ВУПО в
течение трёх рабочих дней. При подтверждении подозрений готовится сообщение
в уполномоченный орган в установленной форме.

Запрет на разглашение. Любое информирование клиента, его представителя или
третьих лиц о факте подачи сообщения квалифицируется как нарушение
законодательства и влечёт дисциплинарную ответственность.

Хранение. Материалы по подозрительным операциям хранятся не менее пяти лет
с момента закрытия дела.
"""

# -- Uzbek -----------------------------------------------------------------

UZ_ACCOUNT = """\
Jismoniy shaxs uchun hisob ochish tartibi

Maqsad. Ushbu hujjat Turonbank filiallarida va mobil ilova orqali jismoniy
shaxsga depozit yoki joriy hisob ochish tartibini belgilaydi.

1-bosqich. Mijozdan amal qilish muddati tugamagan shaxsni tasdiqlovchi
hujjatni qabul qiling. Qabul qilinadigan hujjatlar: biometrik ID-karta,
xalqaro pasport yoki yashash uchun ruxsatnoma. Muddati o'tgan hujjatlar
qabul qilinmaydi.

2-bosqich. Selfi oling va liveness tekshiruvini bajaring. Eng kam ruxsat
etilgan ball — 0.85. Ball undan past bo'lsa, yorug'likni yaxshilab qayta
suratga oling; takroriy muvaffaqiyatsizlikda ishni qo'lda ko'rib chiqishga
yo'naltiring.

3-bosqich. Mijozni ichki sanksiyalar ro'yxati va PEP ro'yxatiga solishtiring.
Har qanday mosligan natija komplaens xodimiga taqdim etiladi va yozma
ruxsatsiz davom ettirilmaydi.

4-bosqich. Mablag' manbasini qayd eting. Oylik tushumlar 20 000 AQSh dollari
ekvivalentidan oshganda, daromad to'g'risida ma'lumotnoma yoki notarial
tasdiqlangan shartnoma kabi tasdiqlovchi hujjatlarni so'rang.

5-bosqich. Risk darajasini belgilang: past, o'rta yoki yuqori. Yuqori riskli
mijozlar uchun kengaytirilgan tekshiruv va filial boshqaruvchisining
roziligi talab etiladi.

Saqlash. Hisob ochish bo'yicha barcha materiallar hisob yopilgan kundan
boshlab kamida besh yil davomida hujjat aylanish tizimida saqlanadi.
"""

UZ_DRESS = """\
Kiyim-bosh qoidalari

Qoida bank ish vaqtida, mijozlar bilan uchrashuvlarda va bank vakili
sifatida ishtirok etiladigan har qanday tadbirda barcha xodimlarga taalluqli.
Maqsad — yagona, professional ko'rinishni saqlash.

Rasmiy ish kiyimi. Filial xodimlari va g'aznachilik xodimlari uchun majburiy.
Erkaklar: to'q rangli kostyum, oddiy ko'ylak, konservativ galstuk va
charm tufli. Ayollar: kostyum yoki tizzagacha bo'lgan yubka va bluzka,
yopiq oyoq kiyim.

Yarim-rasmiy kiyim. Dushanbadan payshanbagacha back-ofis hududlarida
ruxsat etiladi. Klassik shim yoki chinolar, yoqali ko'ylak; ayollar uchun
bluzka yoki ko'ylakcha. Krossovkalar, shortlar va yirtilgan jinsi shimlar
hech qachon ruxsat etilmaydi.

Juma kuni kiyimi. Back-ofis xodimlari uchun faqat juma kunlari toza jinsi
shim va polo ko'ylakka ruxsat beriladi. Filial xodimlari rasmiy kiyimda
qoladilar.

Ko'rinarli tatuirovkalar va bir juft sirg'adan boshqa pirsinglar mijoz
bilan muloqotda yopilishi kerak. Sochlar toza va tartibli bo'lishi shart.

Qoidabuzarlik bo'yicha tegishli xodim bilan to'g'ridan-to'g'ri rahbar
suhbat o'tkazadi. Takroriy qoidabuzarlik kadrlar bo'limiga yuboriladi va
xizmat sifatini baholashda hisobga olinishi mumkin.
"""


DOCS: list[SeedDoc] = [
    SeedDoc(
        title="KYC Onboarding SOP",
        source_uri="seed://sop/en/kyc-onboarding",
        lang="en",
        text=EN_KYC,
    ),
    SeedDoc(
        title="Dress Code Policy",
        source_uri="seed://sop/en/dress-code",
        lang="en",
        text=EN_DRESS,
    ),
    SeedDoc(
        title="СОП по идентификации клиента (KYC)",
        source_uri="seed://sop/ru/kyc-onboarding",
        lang="ru",
        text=RU_KYC,
    ),
    SeedDoc(
        title="Порядок выявления подозрительных операций",
        source_uri="seed://sop/ru/aml-spd",
        lang="ru",
        text=RU_AML,
    ),
    SeedDoc(
        title="Jismoniy shaxs uchun hisob ochish tartibi",
        source_uri="seed://sop/uz/account-opening",
        lang="uz",
        text=UZ_ACCOUNT,
    ),
    SeedDoc(
        title="Kiyim-bosh qoidalari",
        source_uri="seed://sop/uz/dress-code",
        lang="uz",
        text=UZ_DRESS,
    ),
]


async def main() -> None:
    print(f"Seeding {len(DOCS)} demo documents...")
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
