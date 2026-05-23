// app.jsx — top-level wiring: routing, state, tweaks, Clicky (RU)

const { useState: useState_a, useEffect: useEffect_a, useMemo: useMemo_a } = React;

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "clickyEnabled": true,
  "clickyMode": "smart",
  "density": "regular",
  "accent": "#2046FF",
  "lang": "RU",
  "chatOpen": false,
  "showHighlights": true
}/*EDITMODE-END*/;

function clickyScript(route, stepIndex, sanctionsAction) {
  if (route === "dashboard") {
    return {
      mode: "anchored",
      target: "todays-quest",
      message: {
        who: "проводник",
        lead: "Начни отсюда →",
        text: "Сегодняшний квест — <b>верификация KYC</b>. Нажми «Начать», когда будешь готов. Я пойду с тобой и подскажу, если что-то непонятно. Зажми <b>`</b>, чтобы поговорить со мной.",
      },
      actions: { a: "Проведи меня", b: "Скрыть" },
    };
  }
  if (route === "simulator") {
    if (stepIndex === 0) return {
      mode: "anchored",
      target: "customer-card",
      message: { who: "шаг 1 из 6", lead: "Начни с карточки клиента.",
        text: "Это <b>синтетический профиль</b> — никаких реальных данных. Сверь основные поля с тем, что сказал клиент, и переходи к проверке личности." },
    };
    if (stepIndex === 1) return {
      mode: "anchored",
      target: "identity-card",
      message: { who: "шаг 2 из 6", lead: "Личность автоматически зелёная.",
        text: "OCR совпал на <b>98.4%</b>, квитанция подтверждает адрес. Сверь по символу написание ФИО с паспортом и продолжай." },
    };
    if (stepIndex === 2) return {
      mode: "anchored",
      target: "sanctions-card",
      message: { who: "шаг 3 из 6 · ⚠ ловушка", lead: "Внимательно прочитай хит.",
        text: "Уверенность <b>72%</b>, частичное имя и ДР в пределах 4 дней. Процедура <span style='font-family:var(--font-mono);background:var(--cobalt-tint);padding:1px 4px;border-radius:3px;'>SANCTIONS-PROC §1.4</span> требует: <b>≥50% уверенности ⇒ эскалация</b>. Не игнорируй." },
    };
    if (stepIndex === 3) return {
      mode: "anchored",
      target: "sof-card",
      message: { who: "шаг 4 из 6", lead: "Источник средств обязателен.",
        text: "Депозит 75 млн UZS — выше порога <b>50 млн</b> из AML-HB §4.7. 2-НДФЛ уже прикреплён; сверь работодателя и продолжай." },
    };
    if (stepIndex === 4) return {
      mode: "anchored",
      target: "risk-card",
      message: { who: "шаг 5 из 6", lead: "Уровень риска следует за эскалацией.",
        text: "Поскольку ты эскалировал санкционный хит, клиентский риск становится <b>Высокий</b> до решения комплаенса. Система заполнила это за тебя." },
    };
    if (stepIndex === 5) return {
      mode: "anchored",
      target: "risk-card",
      message: { who: "шаг 6 из 6", lead: "Отправляй на проверку.",
        text: "Досье уйдёт сначала наставнику, затем в комплаенс для проверки ПДЛ. Результат увидишь на главной завтра." },
    };
  }
  return null;
}

function App() {
  const [t, setTweak] = useTweaks(TWEAK_DEFAULTS);

  const [route, setRoute] = useState_a("dashboard");
  const [stepIndex, setStepIndex] = useState_a(0);
  const [sanctionsAction, setSanctionsAction] = useState_a(null);

  const [xp, setXp] = useState_a(1480);
  const [level] = useState_a(3);
  const [streak] = useState_a(5);

  const [chatOpen, setChatOpen] = useState_a(t.chatOpen);
  useEffect_a(() => { setChatOpen(t.chatOpen); }, [t.chatOpen]);

  const [clickyDismissed, setClickyDismissed] = useState_a(false);
  useEffect_a(() => { setClickyDismissed(false); }, [route, stepIndex]);

  const [ptt, setPtt] = useState_a(false);
  useEffect_a(() => {
    const d = (e) => { if (e.key === "`" && !e.repeat) setPtt(true); };
    const u = (e) => { if (e.key === "`") setPtt(false); };
    window.addEventListener("keydown", d);
    window.addEventListener("keyup", u);
    return () => { window.removeEventListener("keydown", d); window.removeEventListener("keyup", u); };
  }, []);

  useEffect_a(() => {
    document.documentElement.style.setProperty("--cobalt", t.accent);
    const c = t.accent;
    document.documentElement.style.setProperty("--cobalt-glow", c + "2e");
    document.documentElement.style.setProperty("--cobalt-50",   c + "0f");
  }, [t.accent]);

  const handleStart = (scenarioId) => {
    if (scenarioId !== "kyc") return;
    setStepIndex(0);
    setSanctionsAction(null);
    setRoute("simulator");
  };

  const handleComplete = () => {
    const xpEarned = sanctionsAction === "escal" ? 80 : sanctionsAction === "override" ? 25 : 50;
    setXp(xp + xpEarned);
    setRoute("results");
  };

  const crumbs = route === "dashboard" ? ["Стажёр", "Главная"]
              : route === "simulator" ? ["Стажёр", "Симулятор", "Верификация KYC"]
              : ["Стажёр", "Сценарий", "Результаты"];

  const script = useMemo_a(() => clickyScript(route, stepIndex, sanctionsAction), [route, stepIndex, sanctionsAction]);
  const showClicky = t.clickyEnabled && (t.clickyMode === "always" || route !== "results");
  const showAnchored = script && !clickyDismissed && t.clickyMode !== "ghost";
  const score = sanctionsAction === "escal" ? 93 : sanctionsAction === "override" ? 52 : 74;
  const xpEarned = sanctionsAction === "escal" ? 80 : sanctionsAction === "override" ? 25 : 50;

  return (
    <div className={`app density-${t.density}`}>
      <Sidebar route={route} setRoute={setRoute} xp={xp} level={level} lang={t.lang} />

      <div className="workspace">
        <Topbar crumbs={crumbs} ptt={ptt} />

        <div className="main" key={route}>
          {route === "dashboard" && <Dashboard onStartScenario={handleStart} xp={xp} level={level} streak={streak} />}
          {route === "simulator" && (
            <Simulator
              stepIndex={stepIndex}
              setStepIndex={setStepIndex}
              onComplete={handleComplete}
              sanctionsAction={sanctionsAction}
              setSanctionsAction={setSanctionsAction}
              density={t.density}
            />
          )}
          {route === "results" && (
            <Results
              score={score}
              xpEarned={xpEarned}
              sanctionsAction={sanctionsAction}
              onRetry={() => { setStepIndex(0); setSanctionsAction(null); setRoute("simulator"); }}
              onContinue={() => setRoute("dashboard")}
            />
          )}
        </div>
      </div>

      {showClicky && (
        <Clicky
          enabled
          mode={showAnchored ? script.mode : "cursor"}
          target={showAnchored ? script.target : null}
          message={showAnchored ? script.message : null}
          onDismiss={() => setClickyDismissed(true)}
        />
      )}

      {!chatOpen && (
        <button className="chat-fab" onClick={() => setChatOpen(true)}>
          <span className="dot" />
          <I.Chat size={14} />
          Спросить базу знаний
        </button>
      )}
      <Chat open={chatOpen} onClose={() => setChatOpen(false)} lang={t.lang} />

      <TweaksPanel title="Настройки">
        <TweakSection label="Клик (Clicky)" />
        <TweakToggle label="Показывать Клика" value={t.clickyEnabled} onChange={(v) => setTweak("clickyEnabled", v)} />
        <TweakRadio  label="Режим" value={t.clickyMode}
          options={[{value: "smart", label: "умный"}, {value: "ghost", label: "тихий"}]}
          onChange={(v) => setTweak("clickyMode", v)} />

        <TweakSection label="Интерфейс" />
        <TweakRadio label="Плотность" value={t.density}
          options={[{value: "compact", label: "плотно"}, {value: "regular", label: "обычно"}, {value: "comfy", label: "свободно"}]}
          onChange={(v) => setTweak("density", v)} />
        <TweakColor label="Акцент" value={t.accent}
          options={["#2046FF", "#0F2BD9", "#1B5BFF", "#FF7A1A", "#0B8F5C", "#6F47E0"]}
          onChange={(v) => setTweak("accent", v)} />

        <TweakSection label="Язык" />
        <TweakRadio label="Локаль" value={t.lang}
          options={["RU", "UZ", "EN"]}
          onChange={(v) => setTweak("lang", v)} />

        <TweakSection label="Демо" />
        <TweakButton label="Открыть чат" onClick={() => setChatOpen(true)} />
        <TweakButton label="Сбросить прогон" onClick={() => { setStepIndex(0); setSanctionsAction(null); setRoute("dashboard"); }} />
        <TweakButton label="К результатам" onClick={() => { setSanctionsAction(sanctionsAction || "escal"); setRoute("results"); }} />
      </TweaksPanel>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
