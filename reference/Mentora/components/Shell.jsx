// Shell.jsx — sidebar + topbar app frame (RU)
const { useState: useState_s } = React;

function BrandMark() {
  return (
    <span className="brand-mark"><i /><i /></span>
  );
}

function Sidebar({ route, setRoute, xp, level, lang }) {
  const items = [
    { id: "dashboard", label: "Главная",   Icon: I.Home },
    { id: "simulator", label: "Симулятор", Icon: I.Sim, badge: "1/4" },
    { id: "knowledge", label: "База знаний", Icon: I.Book },
    { id: "badges",    label: "Награды",   Icon: I.Trophy },
  ];
  const personalItems = [
    { id: "profile",  label: "Профиль",   Icon: I.User },
    { id: "settings", label: "Настройки", Icon: I.Settings },
  ];

  const go = (id) => () => {
    if (["dashboard", "simulator"].includes(id)) setRoute(id);
  };

  return (
    <aside className="sidebar" data-screen-label="Sidebar">
      <div className="brand">
        <BrandMark />
        <span className="brand-name">mentora<em>*</em></span>
      </div>

      <div className="nav-section">
        <div className="nav-title">Обучение</div>
        {items.map(it => (
          <button key={it.id} className={`nav-item ${route === it.id ? "active" : ""}`} onClick={go(it.id)}>
            <it.Icon className="nav-icon" />
            <span>{it.label}</span>
            {it.badge && <span className="nav-badge">{it.badge}</span>}
          </button>
        ))}
      </div>

      <div className="nav-section">
        <div className="nav-title">Личное</div>
        {personalItems.map(it => (
          <button key={it.id} className="nav-item" onClick={go(it.id)}>
            <it.Icon className="nav-icon" />
            <span>{it.label}</span>
          </button>
        ))}
      </div>

      <div className="sidebar-foot">
        <div className="synth-tag">Синтетическая среда</div>
        <div className="user-chip">
          <div className="avatar">АП</div>
          <div className="user-meta">
            <b>Алексей П.</b>
            <span>Ур. {level} · {xp} XP</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

function Topbar({ crumbs, ptt }) {
  return (
    <header className="topbar">
      <nav className="crumbs">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
          </React.Fragment>
        ))}
      </nav>

      <div style={{ flex: 1 }} />

      <div className="search">
        <I.Search size={14} />
        <span>Поиск процедур, клиентов, наград…</span>
        <kbd>⌘K</kbd>
      </div>

      <div className={`ptt-hint ${ptt ? "live" : ""}`}>
        <I.Mic size={13} />
        {ptt ? <>Слушаю{" "}<span className="wave"><i/><i/><i/><i/><i/><i/></span></> : <>Зажмите <kbd>`</kbd> чтобы говорить с Кликом</>}
      </div>
    </header>
  );
}

window.Sidebar = Sidebar;
window.Topbar = Topbar;
window.BrandMark = BrandMark;
