interface P {
  size?: number;
}
const s = (n = 22) => ({ width: n, height: n });

export const HomeIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M5.5 9.5V19a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1V9.5" />
    <path d="M10 20v-5h4v5" />
  </svg>
);

export const CupIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h13v4a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V8Z" />
    <path d="M17 9h1.5a2.5 2.5 0 0 1 0 5H17" />
    <path d="M7 3.5c-.5.7-.5 1.3 0 2M11 3.5c-.5.7-.5 1.3 0 2" />
  </svg>
);

export const PlusIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 5v14M5 12h14" />
  </svg>
);

export const ImageIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="4" width="18" height="16" rx="2.5" />
    <circle cx="8.5" cy="9.5" r="1.6" />
    <path d="M4 17l4.5-4.5a2 2 0 0 1 2.8 0L20 21" />
  </svg>
);

export const CameraIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 8h3l1.5-2h7L17 8h3a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
    <circle cx="12" cy="13" r="3.4" />
  </svg>
);

export const SettingsIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 13a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-2.9 1.2V21a2 2 0 1 1-4 0v-.1A1.7 1.7 0 0 0 7 19.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.7 1.7 0 0 0 4.6 13H4.4a2 2 0 1 1 0-4h.1A1.7 1.7 0 0 0 6.7 7L6.6 7a2 2 0 1 1 2.8-2.8l.1.1A1.7 1.7 0 0 0 12 4.6V4.4a2 2 0 1 1 4 0v.1A1.7 1.7 0 0 0 17.3 6.7l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.7 2.9v.2a1.7 1.7 0 0 0 1 .3h.2a2 2 0 1 1 0 4H21a1.7 1.7 0 0 0-1.6.9Z" />
  </svg>
);

export const BackIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 5l-7 7 7 7" />
  </svg>
);

export const CheckIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M5 12.5 10 17l9-10" />
  </svg>
);

export const HeartIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 20s-7-4.35-9.33-8.36C1.1 8.7 2.4 5.6 5.4 5.1c1.9-.32 3.5.7 4.6 2 .3.36.7.36 1 0 1.1-1.3 2.7-2.32 4.6-2 3 .5 4.3 3.6 2.73 6.54C19 15.65 12 20 12 20Z" />
  </svg>
);

export const WrenchIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15.2 4a5 5 0 0 0-6 6.6L4 15.9a1.6 1.6 0 0 0 2.3 2.3l5.3-5.3a5 5 0 0 0 6.6-6l-2.6 2.6-2.6-.5-.5-2.6L15.2 4Z" />
  </svg>
);

/** A sophisticated coffee bean — an oval with the characteristic centre crease. */
export const BeanIcon = ({ size }: P) => (
  <svg {...s(size)} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
    <g transform="rotate(-32 12 12)">
      <ellipse cx="12" cy="12" rx="6.4" ry="9.4" />
      <path d="M12 3.2C9.7 7 14.3 10 12 12s-2.3 5 0 8.8" />
    </g>
  </svg>
);
