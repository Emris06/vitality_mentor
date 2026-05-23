// Dashboard.jsx — intern home (RU)
const { useState: useState_d } = React;

function Dashboard({ onStartScenario, xp, level, streak }) {
  const scenarios = [
    { id: "kyc",     name: "Верификация KYC", desc: "Полная проверка нового клиента-физлица.",        glyph: <I.ID size={18} />,    state: "next" },
    { id: "open",    name: "Открытие счёта",  desc: "Открытие текущего счёта для резидента.",          glyph: <I.Plus size={18} />,  state: "locked" },
    { id: "deposit", name: "Депозитные операции", desc: "Приём наличных и оформление срочного вклада.", glyph: <I.Coins size={18} />, state: "locked" },
    { id: "transfer",name: "Переводы",        desc: "Внутренние и трансграничные переводы.",           glyph: <I.Swap size={18} />,  state: "locked" },
  ];

  const activity = [
    { who: "Наставник Татьяна К.", what: "оставила фидбэк по", target: "тренировке KYC #14",  when: "12 мин назад",     dot: "cobalt" },
    { who: "Вы",                   what: "получили награду",   target: "«Первый KYC»",          when: "Вчера · 16:42",    dot: "warm" },
    { who: "Поток Q2-26",          what: "открыл модуль",      target: "«Санкции»",             when: "Вчера · 09:10",    dot: "green" },
    { who: "Вы",                   what: "завершили сценарий", target: "«KYC: разбор»",         when: "Пн · 14:08",       dot: "green" },
    { who: "HR Ольга Р.",          what: "назначила",          target: "квест 2-й недели",      when: "Пн · 09:00",       dot: "mute" },
  ];

  const badges = [
    { name: "Первый KYC",       desc: "Первая верификация",      emoji: "🎯", cls: "gold",  locked: false },
    { name: "Полиглот",         desc: "RU + UZ интерфейс",       emoji: "🌐", cls: "teal",  locked: false },
    { name: "Полуночник",       desc: "Практика после 21:00",    emoji: "🌙", cls: "lilac", locked: false },
    { name: "Перфекционист",    desc: "100 баллов за KYC",       emoji: "💎", cls: "",      locked: true },
    { name: "Серия 7",          desc: "7 дней подряд",            emoji: "🔥", cls: "rose",  locked: true },
    { name: "Комплаенс-про",    desc: "0 пропусков по санкциям", emoji: "🛡️", cls: "",     locked: true },
  ];

  return (
    <div className="page screen-in" data-screen-label="Dashboard">
      <p className="h-eyebrow">Неделя 2 из 6 · поток Q2-26</p>
      <h1 className="h1">Доброе утро, <em>Алексей</em>.</h1>
      <p className="sub" style={{ marginTop: 8, maxWidth: 560 }}>
        Сегодня три квеста — один новый, два перешли со вчера. Наставник оставила заметки к вчерашнему KYC.
      </p>

      <div className="dash-hero" style={{ marginTop: 24 }}>
        <div className="quest" data-clicky-target="todays-quest">
          <span className="quest-mark">КВЕСТ · ДЕНЬ-08</span>
          <span className="eyebrow">Квест дня</span>
          <h2>Проведите чистую <em>верификацию KYC</em> синтетического клиента Ивана Соколова — отметьте санкционный жёлтый флаг.</h2>
          <div className="quest-meta">
            <span><b>~12 мин</b> · длительность</span>
            <span><b>+80 XP</b> за первое прохождение</span>
            <span><b>3 шага</b> впереди</span>
          </div>
          <div className="quest-actions">
            <button className="btn btn-light-on-cobalt" onClick={() => onStartScenario("kyc")}>
              <I.Play size={13} /> Начать сценарий
            </button>
            <button className="btn btn-ghost-on-cobalt">
              <I.Doc size={13} /> Открыть бриф
            </button>
          </div>
        </div>

        <div className="stats">
          <div className="stat">
            <span className="stat-icon"><I.Bolt size={18} /></span>
            <div style={{ flex: 1 }}>
              <div className="stat-value">{xp}<small>XP</small></div>
              <div className="stat-label">Уровень {level} · до следующего 240</div>
            </div>
          </div>
          <div className="stat">
            <span className="stat-icon warm"><I.Flame size={18} /></span>
            <div style={{ flex: 1 }}>
              <div className="stat-value">{streak}<small>дней</small></div>
              <div className="stat-label">Серия практики</div>
              <div className="streak-dots">
                {[1,1,1,1,1,0,0].map((d,i) => <i key={i} className={d ? "" : "miss"} />)}
              </div>
            </div>
          </div>
          <div className="stat">
            <span className="stat-icon green"><I.Star size={18} /></span>
            <div style={{ flex: 1 }}>
              <div className="stat-value">87<small>/100</small></div>
              <div className="stat-label">Средний балл</div>
            </div>
          </div>
        </div>
      </div>

      <div className="section-head">
        <div>
          <p className="h-eyebrow">Трек: операции</p>
          <h2 className="h2">Банковские сценарии</h2>
        </div>
        <a>Все 12 →</a>
      </div>

      <div className="scenarios">
        {scenarios.map(s => (
          <button
            key={s.id}
            className={`scenario ${s.state === "locked" ? "locked" : ""}`}
            onClick={() => s.state !== "locked" && onStartScenario(s.id)}
            disabled={s.state === "locked"}
          >
            <div className="scenario-glyph">{s.glyph}</div>
            <div className="scenario-name">{s.name}</div>
            <div className="scenario-desc">{s.desc}</div>
            <div className="scenario-foot">
              {s.state === "next" ? <span className="new-pill">ДАЛЕЕ</span>
                : s.state === "locked" ? <span><I.Lock size={12} style={{ verticalAlign: "-2px" }}/> Откроется на 12-й день</span>
                : <span className="score-pill">87/100</span>}
              <I.ChevronR size={14} style={{ opacity: 0.5 }} />
            </div>
          </button>
        ))}
      </div>

      <div className="dash-low">
        <div className="card">
          <div style={{ padding: "16px 20px 4px", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h3 className="h2">Активность</h3>
            <span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--mute)", letterSpacing: "0.06em", textTransform: "uppercase" }}>За 48ч</span>
          </div>
          <div style={{ padding: "0 16px 12px" }} className="activity">
            {activity.map((a, i) => (
              <div className="activity-row" key={i}>
                <span className={`dot ${a.dot}`} />
                <div><b>{a.who}</b> <span style={{ color: "var(--mute)" }}>{a.what}</span> <b>{a.target}</b></div>
                <span className="when">{a.when}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ padding: "16px 20px 4px", display: "flex", alignItems: "baseline", justifyContent: "space-between" }}>
            <h3 className="h2">Награды</h3>
            <span style={{ font: "500 11px/1 var(--font-mono)", color: "var(--mute)" }}>3 / 12</span>
          </div>
          <div className="badges-shelf">
            {badges.map((b, i) => (
              <div key={i} className={`badge ${b.locked ? "locked" : ""}`}>
                <div className={`badge-glyph ${b.cls}`}>{b.emoji}</div>
                <b>{b.name}</b>
                <span>{b.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="cohort">
        <div className="stack">
          <div className="avatar">МК</div>
          <div className="avatar cobalt">ИС</div>
          <div className="avatar lilac">ОР</div>
          <div className="avatar teal">ДВ</div>
          <div className="avatar rose">+9</div>
        </div>
        <div>
          <div style={{ fontSize: 13.5, fontWeight: 500 }}>Поток Q2-26 · 13 стажёров</div>
          <small>Вы <b style={{ color: "var(--cobalt)" }}>впереди медианы</b> на 2 дня — на этой неделе доступны 4 наставника.</small>
        </div>
        <div style={{ marginLeft: "auto" }}>
          <button className="btn btn-ghost"><I.Chat size={13} /> Спросить наставника</button>
        </div>
      </div>
    </div>
  );
}

window.Dashboard = Dashboard;
