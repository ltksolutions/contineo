export default function Logo({ size = 30, withWordmark = true }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10, color: "var(--ink)" }}>
      {/*
        Značka je zhodná s `app/src/components/ContineoMark.tsx` v intranete.
        Zdieľať sa nedá — sú to dve samostatné aplikácie — takže kópia tu
        zostane. Pri zmene kresby treba prejsť obe, plus `lib/og.js`
        a `app/icon.svg`; zoznam je v komente tam.

        Chvostík visí **zvisle dole**, nie šikmo vpravo: kružnica s ručkou pod
        45° je silueta lupy, a to je pri značke, ktorá má hovoriť „opýtajte sa,
        nehľadajte", presne opačný odkaz.
      */}
      <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden="true">
        <circle cx="24" cy="20" r="15" stroke="currentColor" strokeWidth="6" />
        <circle cx="17.5" cy="20" r="3.4" fill="currentColor" />
        <circle cx="30.5" cy="20" r="3.4" fill="currentColor" />
        <path d="M17 32.5 L24 43 L29 31.5 Z" fill="currentColor" />
      </svg>
      {withWordmark && (
        <span style={{ fontWeight: 700, fontSize: size >= 30 ? 18 : 16, letterSpacing: "-0.02em" }}>
          Contineo
        </span>
      )}
    </span>
  );
}
