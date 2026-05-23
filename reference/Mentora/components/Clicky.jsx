// Clicky.jsx — the AI cursor agent mascot
// Follows cursor with eased offset, can announce intent, push-to-talk via backtick,
// highlights a target element when "navigating" there.

const { useState, useEffect, useRef, useCallback } = React;

function useEasedFollow(target) {
  // target: {x, y} — cursor position
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const raf = useRef();
  const cur = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const tick = () => {
      const dx = target.current.x - cur.current.x;
      const dy = target.current.y - cur.current.y;
      cur.current.x += dx * 0.12;
      cur.current.y += dy * 0.12;
      setPos({ x: cur.current.x, y: cur.current.y });
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target]);

  return pos;
}

function Clicky({ enabled = true, mode = "cursor", target = null, message = null, onDismiss, onActionA, onActionB, actionA, actionB }) {
  // mode: "cursor" (follows mouse) | "anchored" (sits on target element)
  // target: DOM selector string for anchored mode
  // message: { lead, text, who } | null
  const cursorPos = useRef({ x: 200, y: 200 });
  const [anchorPos, setAnchorPos] = useState(null);
  const [highlight, setHighlight] = useState(null);
  const [listening, setListening] = useState(false);
  const [hovered, setHovered] = useState(false);

  const followPos = useEasedFollow(cursorPos);

  // Track mouse
  useEffect(() => {
    if (!enabled) return;
    const onMove = (e) => {
      cursorPos.current = { x: e.clientX + 32, y: e.clientY + 28 };
    };
    window.addEventListener("mousemove", onMove);
    return () => window.removeEventListener("mousemove", onMove);
  }, [enabled]);

  // Anchor + highlight target
  useEffect(() => {
    if (mode !== "anchored" || !target) {
      setAnchorPos(null);
      setHighlight(null);
      return;
    }
    const update = () => {
      const el = document.querySelector(`[data-clicky-target="${target}"]`);
      if (!el) return;
      const r = el.getBoundingClientRect();
      setAnchorPos({ x: r.right + 28, y: r.top + r.height / 2 });
      setHighlight({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 });
    };
    update();
    const onScroll = () => update();
    window.addEventListener("resize", update);
    document.querySelectorAll(".main, .sim-main").forEach(n => n.addEventListener("scroll", onScroll, { passive: true }));
    const interval = setInterval(update, 250); // keep up with layout shifts
    return () => {
      window.removeEventListener("resize", update);
      document.querySelectorAll(".main, .sim-main").forEach(n => n.removeEventListener("scroll", onScroll));
      clearInterval(interval);
    };
  }, [mode, target]);

  // Push-to-talk on backtick
  useEffect(() => {
    if (!enabled) return;
    const down = (e) => { if (e.key === "`" && !e.repeat) setListening(true); };
    const up = (e) => { if (e.key === "`") setListening(false); };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
  }, [enabled]);

  if (!enabled) return null;

  const pos = mode === "anchored" && anchorPos ? anchorPos : followPos;

  return (
    <>
      {highlight && mode === "anchored" && (
        <div className="clicky-highlight"
             style={{ left: highlight.x, top: highlight.y, width: highlight.w, height: highlight.h }} />
      )}
      <div className="clicky-wrap" style={{ left: pos.x, top: pos.y }}>
        <div className={`clicky ${listening ? "listening" : ""}`}
             onMouseEnter={() => setHovered(true)}
             onMouseLeave={() => setHovered(false)}
             style={{ pointerEvents: "auto", cursor: "pointer" }}>
          <div className="clicky-burst">
            <i /><i /><i /><i />
          </div>
        </div>

        {message && (
          <div className="clicky-bubble" role="dialog">
            <div className="who">
              <span className="live" />
              {listening ? <>Clicky · listening <span className="wave"><i/><i/><i/><i/><i/><i/></span></> : <>Clicky {message.who && `· ${message.who}`}</>}
            </div>
            {message.lead && <p style={{ fontWeight: 500, marginBottom: 4 }}>{message.lead}</p>}
            <p dangerouslySetInnerHTML={{ __html: message.text }} />
            {(actionA || actionB || onDismiss) && (
              <div className="actions">
                {actionA && <button className="pill" onClick={onActionA}>{actionA}</button>}
                {actionB && <button className="pill muted" onClick={onActionB}>{actionB}</button>}
                {!actionA && !actionB && onDismiss && <button className="pill muted" onClick={onDismiss}>Понятно</button>}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

window.Clicky = Clicky;
