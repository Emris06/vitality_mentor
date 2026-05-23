// Icons.jsx — tiny inline SVG set, all 1.5px stroke, currentColor
const Icon = ({ d, size = 16, fill = "none", stroke = "currentColor", strokeWidth = 1.5, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke}
       strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round"
       aria-hidden="true" {...rest}>
    {d ? <path d={d} /> : children}
  </svg>
);

const I = {
  Home:     (p) => <Icon {...p}><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/></Icon>,
  Sim:      (p) => <Icon {...p}><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M3 9h18"/><path d="M9 14l2 2 4-4"/></Icon>,
  Book:     (p) => <Icon {...p}><path d="M4 5a2 2 0 0 1 2-2h13v17H6a2 2 0 0 0-2 2V5z"/><path d="M19 17H6"/></Icon>,
  Trophy:   (p) => <Icon {...p}><path d="M7 4h10v4a5 5 0 0 1-10 0V4z"/><path d="M5 6H3a3 3 0 0 0 3 3"/><path d="M19 6h2a3 3 0 0 1-3 3"/><path d="M9 14v2h6v-2"/><path d="M8 20h8"/></Icon>,
  Chat:     (p) => <Icon {...p}><path d="M21 12a8 8 0 1 1-3-6.2L21 4l-1 4.2A8 8 0 0 1 21 12z"/></Icon>,
  Search:   (p) => <Icon {...p}><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></Icon>,
  Spark:    (p) => <Icon {...p}><path d="M12 3l1.8 4.8L18.6 9 14 11l-2 5-2-5L5.4 9l4.8-1.2L12 3z"/></Icon>,
  Mic:      (p) => <Icon {...p}><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/></Icon>,
  Flame:    (p) => <Icon {...p}><path d="M12 3s4 4 4 8a4 4 0 1 1-8 0c0-2 2-3 2-5 0 0 2 0 2-3z"/></Icon>,
  Bolt:     (p) => <Icon {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></Icon>,
  Check:    (p) => <Icon {...p}><path d="M4 12l5 5 11-11"/></Icon>,
  X:        (p) => <Icon {...p}><path d="M6 6l12 12M18 6L6 18"/></Icon>,
  Arrow:    (p) => <Icon {...p}><path d="M5 12h14M13 6l6 6-6 6"/></Icon>,
  Play:     (p) => <Icon {...p}><path d="M6 4l13 8-13 8V4z"/></Icon>,
  Pause:    (p) => <Icon {...p}><path d="M7 4v16M17 4v16"/></Icon>,
  Send:     (p) => <Icon {...p}><path d="M4 20l17-8-17-8 3 8-3 8z"/></Icon>,
  Plus:     (p) => <Icon {...p}><path d="M12 5v14M5 12h14"/></Icon>,
  Doc:      (p) => <Icon {...p}><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9l-6-6z"/><path d="M14 3v6h6"/></Icon>,
  Upload:   (p) => <Icon {...p}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="M17 8l-5-5-5 5"/><path d="M12 3v12"/></Icon>,
  User:     (p) => <Icon {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></Icon>,
  Shield:   (p) => <Icon {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6l8-3z"/><path d="M9 12l2 2 4-4"/></Icon>,
  Globe:    (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18"/><path d="M12 3a14 14 0 0 0 0 18"/></Icon>,
  Settings: (p) => <Icon {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 4.7 9a1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9A1.7 1.7 0 0 0 10 3.1V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9c.3.6.9 1 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></Icon>,
  ID:       (p) => <Icon {...p}><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="12" r="2.5"/><path d="M14 10h5M14 14h3"/></Icon>,
  Coins:    (p) => <Icon {...p}><ellipse cx="12" cy="6" rx="8" ry="3"/><path d="M4 6v6c0 1.7 3.6 3 8 3s8-1.3 8-3V6"/><path d="M4 12v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></Icon>,
  Swap:     (p) => <Icon {...p}><path d="M7 7h13l-3-3M17 17H4l3 3"/></Icon>,
  Help:     (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.9.4-1.5 1-1.5 2.2"/><path d="M12 17.5v.01"/></Icon>,
  ChevronR: (p) => <Icon {...p}><path d="M9 6l6 6-6 6"/></Icon>,
  Star:     (p) => <Icon {...p}><path d="M12 3l2.6 6.3 6.4.5-4.9 4.2 1.5 6.5L12 17l-5.6 3.5 1.5-6.5L3 9.8l6.4-.5L12 3z"/></Icon>,
  Lock:     (p) => <Icon {...p}><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 1 1 8 0v4"/></Icon>,
  Clock:    (p) => <Icon {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></Icon>,
};

window.Icon = Icon;
window.I = I;
