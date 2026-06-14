const PATHS = {
  search: "M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z",
  quote:
    "M7 7h4v4a4 4 0 01-4 4M15 7h4v4a4 4 0 01-4 4",
  ticket:
    "M3 8a2 2 0 012-2h14a2 2 0 012 2v1a2 2 0 000 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2v-1a2 2 0 000-4V8zM13 6v12",
  brain:
    "M9 3a3 3 0 00-3 3 3 3 0 00-2 5 3 3 0 002 5 3 3 0 003 3V3zM15 3a3 3 0 013 3 3 3 0 012 5 3 3 0 01-2 5 3 3 0 01-3 3V3z",
  layers: "M12 3l9 5-9 5-9-5 9-5zM3 13l9 5 9-5M3 18l9 5 9-5",
  code: "M8 6l-6 6 6 6M16 6l6 6-6 6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  check: "M5 12l5 5L20 7",
  thumbUp:
    "M7 11v9H4a1 1 0 01-1-1v-7a1 1 0 011-1h3zm0 0l4-7a2 2 0 012 2v3h5a2 2 0 012 2.3l-1.2 6A2 2 0 0118.8 20H7",
  thumbDown:
    "M17 13V4h3a1 1 0 011 1v7a1 1 0 01-1 1h-3zm0 0l-4 7a2 2 0 01-2-2v-3H6a2 2 0 01-2-2.3l1.2-6A2 2 0 016.2 4H17",
  sparkles: "M12 3l1.8 4.8L18 9.5l-4.2 1.7L12 16l-1.8-4.8L6 9.5l4.2-1.7L12 3z",
  file: "M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5zM14 3v5h5",
  help: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9.5a2.5 2.5 0 014.5 1.5c0 2-2.5 2-2.5 4M12 17h.01",
  globe: "M12 21a9 9 0 100-18 9 9 0 000 18zM3 12h18M12 3c2.5 2.7 2.5 15.3 0 18M12 3c-2.5 2.7-2.5 15.3 0 18",
  chat: "M21 12a8 8 0 01-11.5 7.2L4 20l1-4.5A8 8 0 1121 12z",
  shield: "M12 3l8 3v5c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V6l8-3z",
  refresh: "M21 12a9 9 0 11-2.6-6.4M21 4v5h-5",
  rocket:
    "M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 13l-3-3 4-7 8-2-2 8-7 4-3-3zM14 9h.01",
  lock: "M6 11h12a1 1 0 011 1v8a1 1 0 01-1 1H6a1 1 0 01-1-1v-8a1 1 0 011-1zM8 11V7a4 4 0 018 0v4",
  x: "M6 6l12 12M18 6L6 18",
};

export default function Icon({ name, size = 22, stroke = 1.8, style }) {
  const d = PATHS[name] || "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {d.split("M").filter(Boolean).map((seg, i) => (
        <path key={i} d={"M" + seg} />
      ))}
    </svg>
  );
}
