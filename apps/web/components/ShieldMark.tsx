export function ShieldMark() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M12 2L4 5V11C4 16.5 7.4 21.2 12 22C16.6 21.2 20 16.5 20 11V5L12 2Z"
        fill="url(#g)"
        stroke="#a78bfa"
        strokeWidth="1"
      />
      <path d="M9 12L11 14L15.5 9" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <defs>
        <linearGradient id="g" x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#3b82f6" />
        </linearGradient>
      </defs>
    </svg>
  );
}
