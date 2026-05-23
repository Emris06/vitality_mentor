// Chat.jsx — Knowledge Base RAG chat widget (RU)
const { useState: useState_c, useEffect: useEffect_c, useRef: useRef_c } = React;

const CHAT_SEED = [
  {
    role: "bot",
    text: "Привет! Я — <b>помощник по базе знаний Mentora</b>. Спросите про процедуры KYC, лимиты счетов, санкционные проверки или что угодно из банковского справочника. Все ответы — только из проиндексированных документов, ничего не выдумываю.",
    sources: [],
  },
];

const CANNED_ANSWERS = {
  "Какие документы нужны для KYC?":
    {
      answer: [
        "Для верификации KYC физлица-резидента нужны <b>три документа</b>:",
        "1. <b>Документ, удостоверяющий личность</b> — паспорт или ID-карта (с фотографией и датой рождения).",
        "2. <b>Подтверждение адреса</b> — квитанция за коммунальные услуги или договор аренды не старше 90 дней.",
        "3. <b>Декларация источника средств</b> — обязательна при любом депозите ≥ 50 000 000 UZS.",
      ],
      citations: ["KYC-PROC §2.1", "AML-HB §4.3"],
    },
  "Максимальный депозит без подтверждения источника?":
    {
      answer: [
        "<b>49 999 999 UZS</b> для физлица в одной операции. Сверх этого порога нужно получить декларацию источника средств и приложить подтверждающий документ к карточке клиента.",
        "Важно: совокупные депозиты, превышающие порог в течение 7 дней, требуют того же (<span class='cite'>AML-HB §4.7</span>).",
      ],
      citations: ["AML-HB §4.7", "DEPOSIT-OPS §3.2"],
    },
  "Как эскалировать санкционный хит?":
    {
      answer: [
        "Если санкционный скрининг вернул <b>возможное совпадение</b> (жёлтый флаг):",
        "1. <b>Не</b> продолжайте операцию.",
        "2. Откройте тикет комплаенса через меню <i>Комплаенс → Эскалация</i>.",
        "3. Уведомите наставника в течение 15 минут.",
        "4. Дождитесь решения комплаенса — не пытайтесь обойти флаг самостоятельно.",
      ],
      citations: ["SANCTIONS-PROC §1.4", "OPS-ESC §2.1"],
    },
};

function typewrite(setText, full, done) {
  let i = 0;
  setText("");
  const id = setInterval(() => {
    i += Math.max(1, Math.floor(full.length / 60));
    if (i >= full.length) {
      setText(full);
      clearInterval(id);
      done && done();
    } else {
      setText(full.slice(0, i));
    }
  }, 18);
  return () => clearInterval(id);
}

function Chat({ open, onClose, lang = "RU" }) {
  const [messages, setMessages] = useState_c(CHAT_SEED);
  const [input, setInput] = useState_c("");
  const [typing, setTyping] = useState_c(false);
  const bodyRef = useRef_c();

  useEffect_c(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
  }, [messages, typing]);

  const ask = (q) => {
    if (!q.trim()) return;
    setMessages((m) => [...m, { role: "user", text: q }]);
    setInput("");
    setTyping(true);
    const canned = CANNED_ANSWERS[q] || {
      answer: [
        `Не нашёл уверенного совпадения по запросу «${q}» в базе знаний.`,
        "Попробуйте предложенные вопросы или переформулируйте. По политике я отвечаю только по проиндексированным документам — никогда свободным текстом.",
      ],
      citations: ["KB-FALLBACK §0"],
    };
    setTimeout(() => {
      setTyping(false);
      setMessages((m) => [...m, { role: "bot", text: canned.answer.join("\n\n"), sources: canned.citations, streaming: true }]);
    }, 850 + Math.random() * 500);
  };

  if (!open) return null;

  const langName = lang === "RU" ? "Русский" : lang === "UZ" ? "Oʻzbekcha" : "English";
  const placeholder = lang === "RU" ? "Спросите из справочника…" : lang === "UZ" ? "Qoʻllanmadan soʻrang…" : "Ask the handbook…";

  return (
    <div className="chat-panel" role="dialog" aria-label="База знаний">
      <div className="chat-hd">
        <span className="pulse" />
        <div>
          <b>База знаний</b>
          <small>С опорой на документы · {langName} · ~1.2с</small>
        </div>
        <button className="close" onClick={onClose} aria-label="Закрыть"><I.X size={14} /></button>
      </div>
      <div className="chat-body" ref={bodyRef}>
        {messages.map((m, i) => (
          <ChatMessage key={i} m={m} />
        ))}
        {typing && (
          <div className="chat-msg typing"><i /><i /><i /></div>
        )}
      </div>
      <div className="chat-suggest">
        {Object.keys(CANNED_ANSWERS).map((q) => (
          <button key={q} onClick={() => ask(q)}>{q}</button>
        ))}
      </div>
      <div className="chat-input">
        <button className="lang" title="Сменить язык">{lang}</button>
        <input
          placeholder={placeholder}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(input); }}
        />
        <button onClick={() => ask(input)} disabled={!input.trim()} aria-label="Отправить">
          <I.Send size={15} />
        </button>
      </div>
    </div>
  );
}

function ChatMessage({ m }) {
  const [shown, setShown] = useState_c(m.streaming ? "" : m.text);
  useEffect_c(() => {
    if (m.streaming) return typewrite(setShown, m.text);
  }, []);
  if (m.role === "user") {
    return <div className="chat-msg user">{m.text}</div>;
  }
  const paras = (m.streaming ? shown : m.text).split("\n\n");
  return (
    <div className="chat-msg bot">
      {paras.map((p, i) => <p key={i} dangerouslySetInnerHTML={{ __html: p }} />)}
      {m.sources && m.sources.length > 0 && !m.streaming && (
        <div className="sources">
          <div className="sources-label">Источники</div>
          {m.sources.map((s) => <span key={s} className="cite">{s}</span>)}
        </div>
      )}
      {m.sources && m.sources.length > 0 && m.streaming && shown === m.text && (
        <div className="sources">
          <div className="sources-label">Источники</div>
          {m.sources.map((s) => <span key={s} className="cite">{s}</span>)}
        </div>
      )}
    </div>
  );
}

window.Chat = Chat;
