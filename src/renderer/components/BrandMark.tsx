export function BrandMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient id="df-brand" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6a5cff" />
          <stop offset="1" stopColor="#ff5cc8" />
        </linearGradient>
      </defs>
      <rect x="2" y="4" width="28" height="19" rx="4" fill="#f1efff" />
      <rect x="4" y="6" width="24" height="15" rx="2.5" fill="url(#df-brand)" />
      <path d="M4 16 C 10 12, 15 19, 21 15 S 27 12, 28 13" stroke="#b6fff0" strokeWidth="2" fill="none" strokeLinecap="round" />
      <path d="M13 23 L19 23 L20.5 27 L11.5 27 Z" fill="#d9d4ff" />
      <rect x="8" y="26.5" width="16" height="3" rx="1.5" fill="#f1efff" />
    </svg>
  );
}
