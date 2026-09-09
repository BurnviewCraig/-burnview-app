// Small colored illustrations for the home screen cards — the rest of the
// app stays monochrome/line-icon, but these are meant to be quickly spotted
// and told apart at a glance from the home grid.

type IconProps = { size?: number };

export function CalendarColorIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="3" y="4.5" width="18" height="16" rx="2.2" fill="#F6F4E9" stroke="#232A1E" strokeWidth="1" />
      <path d="M3 9.2h18" stroke="#232A1E" strokeWidth="1" />
      <rect x="3" y="4.5" width="18" height="4.7" rx="2.2" fill="#C0392B" />
      <rect x="7" y="2.3" width="1.8" height="4" rx="0.9" fill="#232A1E" />
      <rect x="15.2" y="2.3" width="1.8" height="4" rx="0.9" fill="#232A1E" />
      <rect x="6" y="12" width="4" height="3.6" rx="0.6" fill="#C0392B" />
      <rect x="14" y="12" width="4" height="3.6" rx="0.6" fill="#5C86A8" />
    </svg>
  );
}

export function FarmColorIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <circle cx="17" cy="17.5" r="4" fill="#232A1E" />
      <circle cx="17" cy="17.5" r="1.5" fill="#D9A916" />
      <circle cx="6.2" cy="18.5" r="2.7" fill="#232A1E" />
      <circle cx="6.2" cy="18.5" r="1" fill="#D9A916" />
      <path d="M9 9.5h6.5v5H9z" fill="#4C8C4A" />
      <path d="M9 9.5l1.8-3.8h3.4l1.3 3.8z" fill="#5DA05B" />
      <rect x="3.2" y="13.5" width="6.2" height="3.3" rx="0.8" fill="#D9A916" />
      <rect x="13.6" y="4.3" width="1.5" height="3" fill="#232A1E" />
    </svg>
  );
}

export function CattleColorIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <ellipse cx="12.5" cy="12.5" rx="8" ry="5" fill="#FFFFFF" stroke="#232A1E" strokeWidth="0.9" />
      <path d="M6 9.3c1.6-1.4 3-.6 4 .2 1.3 1 2.6 1 3.8-.1 1.4-1.3 3.2-1 4.7.3l-1 4.6c-3.6 2-7.6 2-11 0z" fill="#232A1E" />
      <circle cx="5.3" cy="9.6" r="3.1" fill="#FFFFFF" stroke="#232A1E" strokeWidth="0.9" />
      <path d="M4 8.3c.9-.7 2-.6 2.6.1" fill="#232A1E" opacity="0.9" />
      <circle cx="4.1" cy="9.2" r="0.65" fill="#232A1E" />
      <ellipse cx="4.6" cy="11.6" rx="1.5" ry="1" fill="#F2AFC0" />
      <rect x="8.4" y="16.6" width="1.4" height="3.2" rx="0.5" fill="#FFFFFF" stroke="#232A1E" strokeWidth="0.6" />
      <rect x="14.6" y="16.6" width="1.4" height="3.2" rx="0.5" fill="#FFFFFF" stroke="#232A1E" strokeWidth="0.6" />
      <ellipse cx="12.5" cy="17.3" rx="3.2" ry="1.7" fill="#F2AFC0" />
    </svg>
  );
}

export function FeedColorIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M9.3 4C7.6 6 6.5 8.7 6.5 12.5c0 4.6 2.4 7.7 5.5 7.7s5.5-3.1 5.5-7.7C17.5 8.7 16.4 6 14.7 4z" fill="#E9C13A" stroke="#C9A227" strokeWidth="0.6" />
      <g stroke="#C9A227" strokeWidth="0.6">
        <path d="M8.6 6.5v12" />
        <path d="M10.8 4.8v14.8" />
        <path d="M13.2 4.8v14.8" />
        <path d="M15.4 6.5v12" />
      </g>
      <path d="M9.3 4C7 2.2 4.2 2.7 3 4.5c2 .2 4 .1 5.6 1.3z" fill="#4C8C4A" />
      <path d="M14.7 4c2.3-1.8 5.1-1.3 6.3.5-2 .2-4 .1-5.6 1.3z" fill="#5DA05B" />
    </svg>
  );
}

export function StocksColorIcon({ size = 30 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path d="M6.3 8h11.4l-1 12.6a1 1 0 01-1 .9H8.3a1 1 0 01-1-.9z" fill="#EDEAD9" stroke="#232A1E" strokeWidth="0.9" />
      <rect x="6.7" y="12" width="10.6" height="3.2" fill="#5C86A8" />
      <path d="M7.2 8L5 4" stroke="#232A1E" strokeWidth="1.1" strokeLinecap="round" />
      <path d="M16.8 8l2.2-4" stroke="#232A1E" strokeWidth="1.1" strokeLinecap="round" />
      <circle cx="4.6" cy="3.4" r="1.1" fill="#232A1E" />
      <circle cx="19.4" cy="3.4" r="1.1" fill="#232A1E" />
    </svg>
  );
}
