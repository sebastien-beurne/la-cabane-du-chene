export function LogoMark({ className = "h-9 w-9", light = false }) {
  const stroke = light ? "#F8F5F0" : "#1B2B24";
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path d="M12 34 L32 13 L52 34" fill="none" stroke={stroke} strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M19 30 V45 M45 30 V45" stroke={stroke} strokeWidth="2.8" strokeLinecap="round" />
      <path d="M13 50 q4.75 -4.5 9.5 0 t9.5 0 t9.5 0 t9.5 0" fill="none" stroke="#D4A373" strokeWidth="2.8" strokeLinecap="round" />
      <circle cx="32" cy="27" r="2.6" fill="#B35432" />
    </svg>
  );
}

export function Logo({ light = false }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5 sm:gap-3">
      <LogoMark light={light} className="h-8 w-8 shrink-0 sm:h-9 sm:w-9" />
      <span className="min-w-0 leading-none">
        <span className={`block whitespace-nowrap font-display text-[1.15rem] sm:text-[1.35rem] font-semibold tracking-tight ${light ? "text-on-dark" : "text-ink"}`}>
          La Cabane du Chêne
        </span>
        <span className={`block whitespace-nowrap text-[10px] uppercase tracking-[0.22em] sm:tracking-[0.28em] mt-1 ${light ? "text-on-dark" : "text-[#6B4E3D]"}`}>
          Valmunster · Moselle
        </span>
      </span>
    </span>
  );
}

