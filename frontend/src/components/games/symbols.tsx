import { useId } from "react";

/** Simbol slot bergaya permata berbingkai emas — SVG orisinal (tanpa aset eksternal). */
const SKIN: Record<string, { a: string; b: string; glow: string }> = {
  CHERRY: { a: "#fb7185", b: "#9f1239", glow: "#fb7185" },
  LEMON: { a: "#fde047", b: "#a16207", glow: "#facc15" },
  BELL: { a: "#fbbf24", b: "#92400e", glow: "#f59e0b" },
  CLOVER: { a: "#4ade80", b: "#14532d", glow: "#22c55e" },
  STAR: { a: "#c084fc", b: "#4c1d95", glow: "#a855f7" },
  DIAMOND: { a: "#67e8f9", b: "#155e75", glow: "#22d3ee" },
  SEVEN: { a: "#f87171", b: "#7f1d1d", glow: "#ef4444" },
};

function Glyph({ id }: { id: string }) {
  switch (id) {
    case "CHERRY":
      return (<g>
        <path d="M30 18c0 10-6 17-11 25M35 18c2 10 7 17 12 25" stroke="#bbf7d0" strokeWidth="2.600" fill="none" strokeLinecap="round" />
        <path d="M30 18c5-4 12-4 15 1-5 2-10 2-15-1Z" fill="#4ade80" />
        <circle cx="21" cy="42" r="8.500" fill="#fff1f2" /><circle cx="43" cy="42" r="8.500" fill="#fff1f2" />
        <circle cx="21" cy="42" r="7" fill="#e11d48" /><circle cx="43" cy="42" r="7" fill="#be123c" />
        <circle cx="18.500" cy="39.500" r="2.200" fill="#fff" opacity=".7" /><circle cx="40.500" cy="39.500" r="2.200" fill="#fff" opacity=".7" />
      </g>);
    case "LEMON":
      return (<g transform="rotate(-20 32 32)">
        <ellipse cx="32" cy="32" rx="19" ry="13" fill="#fef9c3" />
        <ellipse cx="32" cy="32" rx="16.500" ry="10.500" fill="#facc15" />
        <path d="M32 21.500v21M17 32h30M21 24l22 16M21 40l22-16" stroke="#fef08a" strokeWidth="1.400" opacity=".8" />
        <ellipse cx="27" cy="27" rx="6" ry="2.500" fill="#fff" opacity=".5" />
      </g>);
    case "BELL":
      return (<g>
        <path d="M32 11a3.500 3.500 0 0 1 3.500 3.500v.8c7 1.800 10.500 7.700 10.500 15.700l3 8.500H15l3-8.500c0-8 3.500-13.900 10.500-15.700v-.8A3.500 3.500 0 0 1 32 11Z" fill="#fff7ed" />
        <path d="M32 13.500a2 2 0 0 1 2 2v1c6.500 1.600 9.300 7 9.300 14l2.500 7H18.200l2.500-7c0-7 2.800-12.400 9.300-14v-1a2 2 0 0 1 2-2Z" fill="#fbbf24" />
        <path d="M22 30c0-5 2.500-9 7-10.500" stroke="#fff" strokeWidth="2.400" opacity=".7" strokeLinecap="round" fill="none" />
        <rect x="16" y="38" width="32" height="4.500" rx="2.200" fill="#d97706" /><circle cx="32" cy="48" r="4.200" fill="#92400e" />
      </g>);
    case "CLOVER":
      return (<g>
        {[[25, 25], [39, 25], [25, 39], [39, 39]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="9.500" fill="#dcfce7" />)}
        {[[25, 25], [39, 25], [25, 39], [39, 39]].map(([x, y], i) => <circle key={"i" + i} cx={x} cy={y} r="8" fill={i % 2 ? "#16a34a" : "#22c55e"} />)}
        <circle cx="22" cy="22" r="2.400" fill="#fff" opacity=".55" />
        <path d="M33 38c-1 8 1 12 6 16" stroke="#bbf7d0" strokeWidth="3" strokeLinecap="round" fill="none" />
      </g>);
    case "STAR":
      return (<g>
        <path d="m32 11 6.200 12.800 14 1.800-10.300 9.700 2.600 13.900L32 42.400l-12.500 6.800 2.600-13.900-10.300-9.700 14-1.800Z" fill="#fff7cc" stroke="#fbbf24" strokeWidth="2.600" strokeLinejoin="round" />
        <path d="m32 17 4.500 9.500 10.300 1.300-7.600 7.100 2 10.300L32 39.800l-9.200 5.400 2-10.300-7.600-7.100 10.300-1.300Z" fill="#fcd34d" />
        <path d="M27 25l5-6" stroke="#fff" strokeWidth="2.200" strokeLinecap="round" opacity=".8" />
      </g>);
    case "DIAMOND":
      return (<g>
        <path d="M32 12 51 28 32 53 13 28Z" fill="#ecfeff" stroke="#a5f3fc" strokeWidth="2.600" strokeLinejoin="round" />
        <path d="M32 12 51 28H13Z" fill="#a5f3fc" /><path d="M13 28 32 53 24 28ZM51 28 32 53 40 28Z" fill="#06b6d4" /><path d="M24 28 32 53 40 28Z" fill="#22d3ee" />
        <path d="M21 22l5-7" stroke="#fff" strokeWidth="2.400" opacity=".9" strokeLinecap="round" />
      </g>);
    case "SEVEN":
      return (<g>
        <path d="M17 15h30v7L31 50H21l16-27H17Z" fill="#fff7ed" stroke="#fde68a" strokeWidth="3" strokeLinejoin="round" />
        <path d="M20 18h24v3L28.500 47h-4L40 21H20Z" fill="#dc2626" />
      </g>);
    default:
      return <circle cx="32" cy="32" r="14" fill="#94a3b8" />;
  }
}

export function SymbolIcon({ id, size = 72 }: { id: string; size?: number }) {
  const uid = useId().replace(/:/g, "");
  const k = SKIN[id] ?? { a: "#94a3b8", b: "#334155", glow: "#94a3b8" };
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={id.toLowerCase()} style={{ filter: `drop-shadow(0 2px 6px ${k.glow}66)` }}>
      <defs>
        <radialGradient id={`${uid}g`} cx=".35" cy=".25" r=".95"><stop offset="0" stopColor={k.a} /><stop offset="1" stopColor={k.b} /></radialGradient>
        <linearGradient id={`${uid}r`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fef3c7" /><stop offset=".45" stopColor="#f59e0b" /><stop offset="1" stopColor="#78350f" /></linearGradient>
        <linearGradient id={`${uid}s`} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".55" /><stop offset="1" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <rect x="3" y="3" width="58" height="58" rx="17" fill={`url(#${uid}r)`} />
      <rect x="6.500" y="6.500" width="51" height="51" rx="14" fill={`url(#${uid}g)`} />
      <Glyph id={id} />
      <path d="M10 24C10 14 17 9 28 9h8c-9 2-19 6-26 15Z" fill={`url(#${uid}s)`} />
    </svg>
  );
}
