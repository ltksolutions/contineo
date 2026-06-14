export default function Logo({ size = 30, withWordmark = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "var(--ink)" }}>
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="18" cy="18" r="13" stroke="currentColor" strokeWidth="4" />
        <circle cx="13" cy="18" r="2.3" fill="currentColor" />
        <circle cx="23" cy="18" r="2.3" fill="currentColor" />
        <path d="M28 27 L41 41 L29 38 Z" fill="currentColor" />
      </svg>
      {withWordmark && (
        <span style={{ fontWeight: 700, fontSize: size >= 30 ? 18 : 16, letterSpacing: "-0.02em" }}>
          Contineo
        </span>
      )}
    </span>
  );
}
