// Results.jsx — scenario score (RU)
function Results({ score, xpEarned, sanctionsAction, onRetry, onContinue }) {
  const escalated = sanctionsAction === "escal";
  const overrode  = sanctionsAction === "override";

  const breakdown = [
    { label: "Поиск клиента",                pct: 100, pts: 15, cls: "" },
    { label: "Проверка личности",            pct: 100, pts: 15, cls: "" },
    { label: "Обработка санкций",            pct: escalated ? 100 : overrode ? 0 : 60, pts: escalated ? 25 : overrode ? -20 : 15, cls: escalated ? "" : overrode ? "bad" : "warn" },
    { label: "Источник средств",             pct: 100, pts: 15, cls: "" },
    { label: "Точность оценки риска",        pct: 92,  pts: 14, cls: "" },
    { label: "Эффективность по времени",     pct: 84,  pts: 13, cls: "" },
  ];

  const grade = score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : "ПЕРЕСДАТЬ";
  const gradeColor = score >= 90 ? "var(--good)" : score >= 75 ? "var(--cobalt)" : score >= 60 ? "var(--warn)" : "var(--bad)";

  return (
    <div className="page screen-in" data-screen-label="Scenario Results">
      <p className="h-eyebrow">Сценарий · верификация KYC · попытка №15 · {new Date().toLocaleDateString("ru-RU")}</p>
      <h1 className="h1">{escalated ? <>Вы прошли всё <em>по инструкции</em>.</> : overrode ? <>Это <em>серьёзный промах</em>.</> : <>Неплохо, почти <em>получилось</em>.</>}</h1>
      <p className="sub" style={{ marginTop: 8, maxWidth: 580 }}>
        {escalated
          ? "Вы заметили частичное совпадение ПДЛ и эскалировали в комплаенс, а не очистили хит. Это именно то решение, которое требует процедура."
          : overrode
          ? "Вы проигнорировали возможное санкционное совпадение. В боевой системе это регуляторный инцидент — пересмотрите блок «Обработка санкций» ниже."
          : "Вы отметили хит как очищенный без эскалации. При уверенности 72% правильное решение — эскалация. Пересмотрите блок «Обработка санкций»."}
      </p>

      <div className="results" style={{ marginTop: 28 }}>
        <div>
          <div className="score-hero">
            <span className="score-grade" style={{ background: gradeColor }}>Оценка · {grade}</span>
            <div className="score-number">{score}<small>/ 100</small></div>
            <div style={{ display: "flex", gap: 24, marginTop: 8, color: "var(--mute)", fontSize: 13 }}>
              <span>Время · <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>11м 42с</b></span>
              <span>Ошибок · <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>{escalated ? 1 : overrode ? 3 : 2}</b></span>
              <span>Подсказок · <b style={{ color: "var(--ink)", fontFamily: "var(--font-mono)" }}>2</b></span>
            </div>

            <div className="breakdown">
              {breakdown.map((b, i) => (
                <div className="bd-row" key={i}>
                  <span>{b.label}</span>
                  <div className="meter"><i className={b.cls} style={{ width: `${b.pct}%` }} /></div>
                  <span className="pts">{b.pts > 0 ? `+${b.pts}` : b.pts} баллов</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ marginTop: 22 }}>
            <h2 className="h2" style={{ marginBottom: 12 }}>Разбор · что запомнить</h2>

            {overrode && (
              <div className="mistake bad">
                <b>Вы проигнорировали совпадение ПДЛ с уверенностью 72%.</b>
                <p>Справочник однозначен: любое совпадение с уверенностью выше 50% требует эскалации в комплаенс, независимо от мнения стажёра. Игнор разрешён только старшим комплаенс-офицерам с задокументированным решением.</p>
                <div className="corr"><b>Правильно:</b> открыть тикет в комплаенсе и уведомить наставника в течение 15 минут. <span style={{ font: "500 10.5px/1.6 var(--font-mono)" }}>SANCTIONS-PROC §1.4</span></div>
              </div>
            )}

            {!escalated && !overrode && (
              <div className="mistake">
                <b>«Отметить как очищенное» здесь не подходит.</b>
                <p>Очистка уместна при уверенности ниже ~50% и без совпадения ДР. Здесь — 72% и расхождение по дате рождения всего 4 дня. Учебниковый случай эскалации.</p>
                <div className="corr"><b>Правильно:</b> эскалировать в комплаенс. <span style={{ font: "500 10.5px/1.6 var(--font-mono)" }}>SANCTIONS-PROC §1.4</span></div>
              </div>
            )}

            <div className="mistake">
              <b>Оценка риска назначена до сбора источника средств.</b>
              <p>Процедура требует сначала собрать и проверить ИС, и только потом ставить итоговую оценку риска: ИС напрямую влияет на клиентский риск.</p>
              <div className="corr"><b>Совет:</b> панель сценария упорядочена не случайно — идите сверху вниз. <span style={{ font: "500 10.5px/1.6 var(--font-mono)" }}>KYC-PROC §3.6</span></div>
            </div>
          </div>
        </div>

        <div className="results-side">
          <div className="xp-burst">
            <small>Получено XP</small>
            <div className="num">+{xpEarned} <em>XP</em></div>
            <div className="levelbar"><i style={{ width: `${escalated ? 78 : overrode ? 41 : 62}%` }} /></div>
            <div className="levelmeta">
              <span>Ур. 3 · подмастерье</span>
              <span>{escalated ? "240" : overrode ? "440" : "320"} до ур. 4</span>
            </div>
          </div>

          {escalated && (
            <div className="new-badge">
              <div className="glyph">🛡️</div>
              <div>
                <b>Новая награда · <em>Комплаенс-про</em></b>
                <small>0 пропусков по санкциям в 3 сценариях подряд.</small>
              </div>
            </div>
          )}

          <div className="card card-pad">
            <h3 className="h3" style={{ marginBottom: 10 }}>Что дальше</h3>
            <p className="sub" style={{ marginBottom: 12 }}>
              {escalated ? "«Открытие счёта» откроется завтра. Наставник просмотрит этот прогон до того."
                         : "Пройдите KYC ещё раз, чтобы закрыть тему санкций, или попросите наставника о коротком разборе."}
            </p>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn btn-primary" onClick={onContinue}><I.Arrow size={13} /> На главную</button>
              <button className="btn btn-ghost" onClick={onRetry}>Пройти заново</button>
            </div>
          </div>

          <div className="card card-pad" style={{ background: "var(--surface-2)", borderStyle: "dashed" }}>
            <h3 className="h3" style={{ marginBottom: 8, display: "flex", alignItems: "center", gap: 8 }}>
              <I.Chat size={13} /> Заметка наставника
            </h3>
            <p className="sub" style={{ fontStyle: "italic" }}>
              {escalated
                ? "«Хороший прогон, Алексей. Замешкался на ИС примерно на 40 секунд — стоит ещё раз перечитать §4.7, чтобы выработался автоматизм». — Татьяна К."
                : "«Завтра в 11:00 разберём этот сценарий вместе — санкционные решения дают больше всего инцидентов у новичков». — Татьяна К."}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

window.Results = Results;
