// Simulator.jsx — KYC scenario (RU)
const { useState: useState_sim, useEffect: useEffect_sim } = React;

const STEPS = [
  { id: "lookup",    title: "Поиск клиента",        hint: "Найдите профиль Ивана Соколова и откройте черновик." },
  { id: "id",        title: "Проверка личности",    hint: "Сверьте загруженный паспорт с данными формы." },
  { id: "sanctions", title: "Санкционный скрининг", hint: "Запустите скрининг и действуйте по результату — включая неоднозначные совпадения." },
  { id: "sof",       title: "Источник средств",     hint: "Соберите декларацию ИС при депозите ≥ 50 млн UZS." },
  { id: "risk",      title: "Оценка риска",         hint: "Назначьте итоговый уровень риска по результату скрининга." },
  { id: "submit",    title: "Отправить на проверку",hint: "Отправьте досье наставнику или комплаенс-офицеру." },
];

function Simulator({ stepIndex, setStepIndex, onComplete, sanctionsAction, setSanctionsAction, density }) {
  const activeStep = STEPS[stepIndex];

  const next = () => {
    if (stepIndex < STEPS.length - 1) setStepIndex(stepIndex + 1);
    else onComplete();
  };
  const back = () => setStepIndex(Math.max(0, stepIndex - 1));

  const progressPct = Math.round(((stepIndex) / (STEPS.length - 1)) * 100);

  return (
    <div className="sim-shell" data-screen-label="Simulator · KYC">
      <div className="sim-band">
        <span className="pip" />
        <span style={{ color: "white", fontWeight: 500 }}>BankSandbox</span>
        <span style={{ color: "rgba(255,255,255,0.4)" }}>/</span>
        <span className="crumbs-x">Операции <span>/</span> <b>KYC · физлицо-резидент</b></span>
        <div className="scenario-progress">
          <span style={{ color: "rgba(255,255,255,0.55)" }}>Шаг {stepIndex + 1} / {STEPS.length} · {activeStep.title}</span>
          <div className="bar"><i style={{ width: `${Math.max(8, progressPct)}%` }} /></div>
        </div>
      </div>

      <div className="sim-body">
        <SimSidebar />
        <main className="sim-main">
          <CustomerCard />
          <div style={{ height: 16 }} />
          <IdentityCard step={stepIndex} />
          <div style={{ height: 16 }} />
          <SanctionsCard step={stepIndex} action={sanctionsAction} setAction={setSanctionsAction} />
          <div style={{ height: 16 }} />
          {stepIndex >= 3 && <SourceOfFundsCard step={stepIndex} />}
          {stepIndex >= 3 && <div style={{ height: 16 }} />}
          {stepIndex >= 4 && <RiskRatingCard step={stepIndex} sanctionsAction={sanctionsAction} />}
        </main>
        <aside className="sim-rail">
          <StepsPanel stepIndex={stepIndex} sanctionsAction={sanctionsAction} />
          <HintCard step={activeStep} />
          <RailMeta />
        </aside>
      </div>

      <div className="sim-foot">
        <div className="left">
          ID клиента <b>SYN-2847102</b> · Сессия <b>kyc-7f3a</b> · <span style={{ color: "var(--synth)" }}>синтетические данные — никаких боевых систем</span>
        </div>
        <div className="spacer" />
        <button className="btn btn-ghost" onClick={back} disabled={stepIndex === 0}>
          ← Назад
        </button>
        <button className="btn btn-ghost"><I.Help size={13} /> Спросить Клика <kbd style={{ font: "500 10.5px/1 var(--font-mono)", padding: "2px 5px", background: "var(--surface-2)", border: "1px solid var(--line-2)", borderRadius: 3, marginLeft: 6, color: "var(--mute)" }}>`</kbd></button>
          <button className="btn btn-primary" onClick={next}>
            {stepIndex === STEPS.length - 1 ? "Отправить на проверку" : "Шаг выполнен"} <I.Arrow size={13} />
          </button>
      </div>
    </div>
  );
}

function SimSidebar() {
  return (
    <div className="sim-side">
      <h4>Операции</h4>
      <div className="navx active"><I.ID /> <span>Верификация KYC</span></div>
      <div className="navx"><I.Plus /> <span>Открытие счёта</span></div>
      <div className="navx"><I.Coins /> <span>Депозиты</span></div>
      <div className="navx"><I.Swap /> <span>Переводы</span></div>
      <div className="navx"><I.Doc /> <span>Выпуск карт</span></div>
      <h4 style={{ marginTop: 14 }}>Комплаенс</h4>
      <div className="navx"><I.Shield /> <span>Санкционный список</span></div>
      <div className="navx"><I.Globe /> <span>Реестр ПДЛ</span></div>
      <div className="navx"><I.Doc /> <span>Отчёты AML</span></div>
      <h4 style={{ marginTop: 14 }}>Справка</h4>
      <div className="navx"><I.Book /> <span>Справочник процедур</span></div>
      <div className="navx"><I.Clock /> <span>Журнал событий</span></div>
    </div>
  );
}

function CustomerCard() {
  return (
    <div className="crm-card" data-clicky-target="customer-card">
      <div className="crm-head">
        <h3>Профиль клиента <span className="id">SYN-2847102</span></h3>
        <span className="tag mute">Черновик · физлицо</span>
        <span className="tag cobalt">Синтетический</span>
        <div className="right">
          <button className="btn btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>Изменить</button>
        </div>
      </div>
      <div className="crm-body">
        <div className="crm-grid cols-3">
          <div className="field">
            <label>ФИО</label>
            <div className="val">Соколов Иван Алексеевич</div>
          </div>
          <div className="field">
            <label>Дата рождения</label>
            <div className="val mono">1989-03-14</div>
          </div>
          <div className="field">
            <label>Гражданство</label>
            <div className="val">Узбекистан 🇺🇿</div>
          </div>
          <div className="field">
            <label>ИНН</label>
            <div className="val mono">3094 8826 5571</div>
          </div>
          <div className="field">
            <label>Мобильный</label>
            <div className="val mono">+998 90 348 12 04</div>
          </div>
          <div className="field">
            <label>Email</label>
            <div className="val">i.sokolov@example.uz</div>
          </div>
          <div className="field" style={{ gridColumn: "1 / span 2" }}>
            <label>Адрес проживания</label>
            <div className="val">ул. Шахрисабз 14/2, кв. 47 · Ташкент, 100015</div>
          </div>
          <div className="field">
            <label>Клиент с</label>
            <div className="val mono">— (новый)</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function IdentityCard({ step }) {
  const verified = step > 1;
  return (
    <div className="crm-card" data-clicky-target="identity-card">
      <div className="crm-head">
        <h3>Проверка личности</h3>
        {verified ? <span className="tag good"><I.Check size={11} /> Подтверждено</span>
                  : <span className="tag warn">Ожидает проверки</span>}
        <div className="right">
          <button className="btn btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>
            <I.Upload size={12} /> Загрузить снова
          </button>
        </div>
      </div>
      <div className="crm-body">
        <div className="crm-grid">
          <div className="field">
            <label>Тип документа</label>
            <div className="val">Паспорт · UZ</div>
          </div>
          <div className="field">
            <label>Номер документа</label>
            <div className="val mono">AB 5174839</div>
          </div>
          <div className="field">
            <label>Выдан</label>
            <div className="val mono">2019-07-22</div>
          </div>
          <div className="field">
            <label>Действителен до</label>
            <div className="val mono">2029-07-22</div>
          </div>
        </div>

        <div style={{ marginTop: 16 }}>
          <div className="doc-row uploaded">
            <div className="doc-thumb" />
            <div className="doc-meta">
              <b>passport_sokolov_AB5174839.pdf</b>
              <span>Загружен 3 мин назад · 2 стр. · <span style={{ color: "var(--good)" }}>OCR совпал на 98.4%</span></span>
            </div>
            <button className="btn btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>Открыть</button>
          </div>
          <div className="doc-row uploaded">
            <div className="doc-thumb" />
            <div className="doc-meta">
              <b>utility_bill_2026-04.pdf</b>
              <span>Загружен 2 мин назад · 1 стр. · <span style={{ color: "var(--good)" }}>Адрес совпадает</span></span>
            </div>
            <button className="btn btn-ghost" style={{ height: 28, padding: "0 10px", fontSize: 12 }}>Открыть</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function SanctionsCard({ step, action, setAction }) {
  const screened = step >= 2;
  return (
    <div className="crm-card" data-clicky-target="sanctions-card">
      <div className="crm-head">
        <h3>Скрининг санкций и ПДЛ</h3>
        {!screened && <span className="tag mute">Не запущен</span>}
        {screened && <span className="tag warn">⚠ Возможное совпадение · 1 хит</span>}
        <div className="right">
          <span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--mute)" }}>Списки: <b style={{ color: "var(--ink)" }}>OFAC · EU · UN · CBU-AML</b></span>
        </div>
      </div>
      <div className="crm-body">
        {!screened ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, padding: "8px 0" }}>
            <div className="sub" style={{ flex: 1 }}>
              Скрининг для этого профиля ещё не запускался. Запустите его, чтобы увидеть хиты, степень совпадения и рекомендации.
            </div>
            <button className="btn btn-primary"><I.Shield size={13} /> Запустить скрининг</button>
          </div>
        ) : (
          <>
            <div style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr auto",
              gap: 16,
              alignItems: "center",
              padding: "12px 14px",
              border: "1px solid var(--warn)",
              background: "var(--warn-tint)",
              borderRadius: "var(--r-md)",
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: "50%",
                background: "var(--warn)", color: "white",
                display: "grid", placeItems: "center",
                font: "700 18px/1 var(--font-sans)",
              }}>!</div>
              <div>
                <div style={{ fontSize: 13.5, fontWeight: 500 }}>
                  Возможное совпадение ПДЛ · 1 хит в <span className="val mono" style={{ background: "rgba(0,0,0,0.05)", padding: "1px 5px", borderRadius: 3 }}>CBU-AML</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--warn)", marginTop: 3 }}>
                  «Соколов Иван А.» — частичное совпадение имени + ДР в пределах 4 дней. Уверенность: <b>72%</b>.
                </div>
              </div>
              <div style={{ font: "500 11px/1.4 var(--font-mono)", color: "var(--mute)", textAlign: "right" }}>
                <div>ID хита</div>
                <div style={{ color: "var(--ink)" }}>HIT-7741</div>
              </div>
            </div>

            <div style={{ marginTop: 14 }}>
              <label style={{ font: "500 10.5px/1 var(--font-mono)", letterSpacing: "0.05em", textTransform: "uppercase", color: "var(--mute-2)", display: "block", marginBottom: 8 }}>
                Рекомендуемое действие
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
                {[
                  { id: "clear",   label: "Отметить как очищенное", sub: "Ложное срабатывание · продолжить", correct: false },
                  { id: "escal",   label: "Эскалировать в комплаенс", sub: "Открыть тикет, приостановить KYC", correct: true },
                  { id: "override",label: "Игнорировать и продолжить", sub: "Не рекомендуется",            correct: false, bad: true },
                ].map(opt => (
                  <button
                    key={opt.id}
                    onClick={() => setAction(opt.id)}
                    className={action === opt.id ? "action-chip selected" : "action-chip"}
                    style={{
                      textAlign: "left",
                      padding: "12px",
                      border: action === opt.id
                        ? (opt.correct ? "1.5px solid var(--good)" : "1.5px solid var(--bad)")
                        : "1px solid var(--line-2)",
                      borderRadius: "var(--r-md)",
                      background: action === opt.id
                        ? (opt.correct ? "var(--good-tint)" : "var(--bad-tint)")
                        : "var(--surface)",
                      cursor: "pointer",
                      transition: "all 0.15s",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, fontWeight: 500 }}>
                      <span style={{
                        width: 14, height: 14, borderRadius: "50%",
                        border: "1.5px solid " + (action === opt.id ? (opt.correct ? "var(--good)" : "var(--bad)") : "var(--mute-3)"),
                        background: action === opt.id ? (opt.correct ? "var(--good)" : "var(--bad)") : "transparent",
                        display: "grid", placeItems: "center",
                      }}>
                        {action === opt.id && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "white" }} />}
                      </span>
                      {opt.label}
                    </div>
                    <div style={{ fontSize: 11.5, color: "var(--mute)", marginTop: 4, paddingLeft: 22 }}>{opt.sub}</div>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function SourceOfFundsCard({ step }) {
  return (
    <div className="crm-card" data-clicky-target="sof-card">
      <div className="crm-head">
        <h3>Декларация источника средств</h3>
        <span className="tag warn">Требуется · депозит 75 000 000 UZS</span>
      </div>
      <div className="crm-body">
        <div className="crm-grid">
          <div className="field">
            <label>Заявленный источник</label>
            <div className="val">Зарплата и бонусы · «ООО ТехноТрейд»</div>
          </div>
          <div className="field">
            <label>Годовой доход</label>
            <div className="val mono">~ 220 000 000 UZS</div>
          </div>
          <div className="field">
            <label>Подтверждающий документ</label>
            <div className="val">2NDFL_2025_signed.pdf · <span style={{ color: "var(--good)" }}>Проверен</span></div>
          </div>
          <div className="field">
            <label>Дата декларации</label>
            <div className="val mono">2026-05-23 09:14</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function RiskRatingCard({ step, sanctionsAction }) {
  const tier = sanctionsAction === "escal" ? "Высокий · ожидает комплаенс"
            : sanctionsAction === "override" ? "Низкий (игнор)"
            : "Средний";
  const tierClass = sanctionsAction === "escal" ? "warn" : sanctionsAction === "override" ? "bad" : "cobalt";
  return (
    <div className="crm-card" data-clicky-target="risk-card">
      <div className="crm-head">
        <h3>Оценка риска</h3>
        <span className={`tag ${tierClass}`}>{tier}</span>
      </div>
      <div className="crm-body">
        <div className="crm-grid cols-3">
          <div className="field">
            <label>Страновой риск</label>
            <div className="val">Низкий (резидент UZ)</div>
          </div>
          <div className="field">
            <label>Продуктовый риск</label>
            <div className="val">Средний (срочный депозит)</div>
          </div>
          <div className="field">
            <label>Клиентский риск</label>
            <div className="val">{sanctionsAction === "escal" ? "Высокий (проверка ПДЛ)" : "Средний"}</div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StepsPanel({ stepIndex, sanctionsAction }) {
  return (
    <div className="steps-panel">
      <h4>Сценарий · KYC v3.4</h4>
      {STEPS.map((s, i) => {
        const status = i < stepIndex ? "done" : i === stepIndex ? "active" : "pending";
        const isSanctionsError = s.id === "sanctions" && i < stepIndex && sanctionsAction === "override";
        return (
          <div key={s.id} className={`step ${isSanctionsError ? "error" : status}`}>
            <div className="marker">{i < stepIndex && !isSanctionsError ? "✓" : isSanctionsError ? "!" : i + 1}</div>
            <div>
              <b>{s.title}</b>
              <span>{s.hint}</span>
            </div>
            <span className="pts">
              {i < stepIndex
                ? (isSanctionsError ? "−20" : "+15")
                : i === stepIndex ? "···" : "0"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function HintCard({ step }) {
  return (
    <div className="hint-card">
      <h5><I.Spark size={11} /> Подсказка · из документов</h5>
      <p>{step.hint}</p>
      <p style={{ fontSize: 11.5, color: "var(--mute)" }}>Источник: <span style={{ background: "var(--cobalt-tint)", color: "var(--cobalt)", padding: "1px 5px", borderRadius: 3, fontFamily: "var(--font-mono)" }}>KYC-PROC §{2 + Math.floor(Math.random()*4)}.{1 + Math.floor(Math.random()*5)}</span></p>
    </div>
  );
}

function RailMeta() {
  return (
    <div style={{ marginTop: "auto", fontSize: 11.5, color: "var(--mute)", paddingTop: 12, borderTop: "1px dashed var(--line)" }}>
      <div style={{ display: "flex", justifyContent: "space-between" }}><span>Дежурный наставник</span> <b style={{ color: "var(--ink)" }}>Татьяна К.</b></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span>SLA подсказки &lt; 2с</span> <b style={{ color: "var(--good)" }}>● онлайн</b></div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}><span>Списки обновлены</span> <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>06:00 UTC</b></div>
    </div>
  );
}

window.Simulator = Simulator;
