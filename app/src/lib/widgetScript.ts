/**
 * widgetScript.ts — skript widgetu pre cudzí systém (ADR-028, D166).
 *
 * Jeden súbor bez závislostí, ktorý si ISSF vloží značkou `<script>`.
 * Vykreslí zatvorený widget a plachtu v Shadow DOM (štýly ISSF naň nesiahnu
 * a naopak), otázku pošle na `/api/widget/<kanál>/chat` s tokenom, odpoveď
 * číta po kúskoch (SSE), ukáže zdroje a palce; po negatívnych hodnoteniach
 * v rozhovore ponúkne ticket (D166) — po koľkých, je nastavenie kanála. Token berie z atribútu
 * `data-token`, pri vypršaní si vyžiada nový z `data-token-url` (adresa na
 * strane ISSF, rovnaký pôvod ako stránka).
 *
 * Texty prichádzajú zo servera pre všetky jazyky kanála (`dictionary().widget`),
 * farba z brandingu organizácie — web ostáva webom, farba je organizácie
 * (CLAUDE.md).
 *
 * **Design system v Shadow DOM** (KANAL-widget-zdroje, 23. 10. 2026):
 * `globals.css` sa do widgetu nedostane, preto sú tokeny (`WIDGET_TOKENS`)
 * a pravidlá (`WIDGET_CSS`: `.button*`, `.form-row*`, `.lnote*`,
 * `.ask-sheet-mine*`, `.ask-sheet-examples` a triedy externého widgetu
 * `.xw-*`) prenesené doslova. Menia sa len spolu s `globals.css` — test
 * `widgetTokens` porovná tokeny s `:root` a test `widgetCss`, že každé
 * pravidlo `WIDGET_CSS` v `globals.css` je.
 *
 * **Výber zdrojov:** „Zdroje: Knižnica, Sportnet dokumentácia ▾" v hlavičke
 * plachty (vždy vymenované), rozbalí sa pod ňou. Zmena nič nespúšťa —
 * výber ide s ďalšou otázkou. Hlavičku odpovede skladá server (udalosť
 * `scope`), skript ju len vypíše.
 *
 * **Tvar a správanie z nastavenia kanála** (ADR-042, Dodatok 1 a 2,
 * KANAL-widget-riadok-otazky 27. 10. 2026): hore a dole v strede je zatvorený
 * widget **riadok otázky** (značka, nápoveda, šípka), na ostatných šiestich
 * miestach tlačidlo (D286). Klik, Enter alebo písanie ho rozbalí do plachty —
 * pri veľkosti `xl` 80 % × 80 % so závojom (D287), inak na mieste tlačidla.
 * Prázdna plachta má veľké pole, nedávne otázky osoby a vzory otázok (D288);
 * po prvej otázke je pole pod rozhovorom. Pod 640 px je plachta celá
 * obrazovka. Esc, „×" alebo klik na závoj zavrie; rozpísaný text ostane
 * v riadku.
 *
 * **Posúvanie riadku** (Ján 27. 10. 2026): za úchyt na ľavom okraji riadku
 * (myš, dotyk, šípky — Shift po 64 px); Home alebo dvojklik ho vráti na
 * miesto z nastavenia. Miesto si pamätá prehliadač človeka (`localStorage`,
 * podiel šírky a výšky okna), nastavenie kanála sa nemení; riadok ostáva
 * vždy celý na obrazovke. Plachta sa neposúva.
 *
 * **Zbalenie na tlačidlo** (Ján 28. 10. 2026): „⤡" na pravom okraji riadku ho
 * zbalí na tlačidlo „Opýtajte sa…", ktoré sa ťahá celé (pohyb pod 5 px je
 * klik); klik ho rozbalí späť na riadok. Miesto sa drží okraja, ku ktorému
 * je bližšie — riadok sa rozbalí od toho istého okraja a zbalením sa nič
 * neposunie. Tvar aj miesto si pamätá prehliadač, predvolený je riadok.
 *
 * **Tip na požiadanie** (Ján 28. 10. 2026): žiarovka vedľa „⤡" ukáže úvodný
 * tip znova, aj keď ho kanál pri prvej návšteve vypol; druhý klik ho zavrie.
 *
 * **Úvodný tip** (D291, `TipKit` — popover tip): pri prvej návšteve bublina
 * pod zatvoreným widgetom — čo pomocník je a ako ho posunúť (úchyt zatiaľ
 * bliká), „Vyskúšať" ho otvorí, „Rozumiem", „×" alebo Esc zavrie. Raz
 * v prehliadači: zmizne aj otvorením widgetu. Bez závoja a bez krádeže
 * fokusu — čítačka ho ohlási (`role="status"`). Vypína sa v nastavení kanála.
 *
 * **Jazyk** (D290): kanál s viac jazykmi má v hlavičke prepínač jazyka —
 * skratky SK / CZ / EN v tvare `Picker(.segmented)` (Ján 27. 10. 2026); mení
 * texty widgetu aj jazyk odpovede. Prvý je voľba z minulej návštevy
 * (`localStorage`), potom `lang` z tokenu, potom prvý jazyk kanála.
 *
 * **Ponuka správy helpdesku** (ADR-042, D275, D283, D285): po neúspechoch
 * (prah z nastavenia), cez stále viditeľný tichý odkaz „Napísať helpdesku"
 * pod poľom otázky (dá sa vypnúť) a hneď pri fráze zo zoznamu — vtedy sa
 * asistent nepýta. Formulár je predvyplnený poslednou otázkou a ukazuje,
 * kam príde odpoveď (`email` z tokenu; obsah tokenu nie je tajný, je to
 * údaj prihláseného človeka). `ContineoHelpdesk.open()` otvorí plachtu
 * z odkazu v cudzom systéme a vráti `true`; keď skript nenabehol, odkaz
 * ostane obyčajným `mailto:` (`docs/WIDGET_ISSF.md`).
 */

import { WIDGET_MARKDOWN_JS } from "./widgetMarkdown"
import { DEFAULT_WIDGET_APPEARANCE, WIDGET_SIZE_PX, appearanceForScript, isRowPosition, type WidgetAppearanceForScript, type WidgetPosition } from "./widgetAppearance"

/** Odstup od okraja obrazovky — ako doteraz pri pravom dolnom rohu. */
const EDGE = 16

function corner(position: WidgetPosition): [string, string] {
  return position === "top" ? ["center", "top"]
    : position === "bottom" ? ["center", "bottom"]
    : position.split("-") as [string, string]
}

/**
 * Ukotvenie tlačidla aj plachty k miestu na obrazovke (D282). Stredy strán
 * sa centrujú posunom, rohy len odstupom od dvoch okrajov.
 */
export function anchorCss(position: WidgetPosition): string {
  const [x, y] = corner(position)
  const parts: string[] = []
  const shift: string[] = []
  if (x === "left") parts.push(`left:${EDGE}px`)
  else if (x === "right") parts.push(`right:${EDGE}px`)
  else { parts.push("left:50%"); shift.push("translateX(-50%)") }
  if (y === "top") parts.push(`top:${EDGE}px`)
  else if (y === "bottom") parts.push(`bottom:${EDGE}px`)
  else { parts.push("top:50%"); shift.push("translateY(-50%)") }
  parts.push(`transform:${shift.length ? shift.join(" ") : "none"}`)
  return parts.join(";")
}

/** Odkiaľ plachta vyrastá pri otvorení — od miesta zatvoreného widgetu. */
export function originCss(position: WidgetPosition): string {
  const [x, y] = corner(position)
  return `${x === "middle" ? "center" : x} ${y === "middle" ? "center" : y}`
}

/** Svetlé tokeny z `:root` v `globals.css` — widget tmavú tému nemá. */
export const WIDGET_TOKENS: Record<string, string> = {
  "--bg": "#f5f6f8",
  "--surface": "#ffffff",
  "--surface-2": "#eceef1",
  "--ink": "#161b22",
  "--muted": "#5c6675",
  "--line": "rgba(20, 28, 42, 0.12)",
  "--line-strong": "rgba(20, 28, 42, 0.18)",
  "--control-line": "rgba(20, 28, 42, 0.42)",
  "--on-accent": "#ffffff",
  "--ok-bg": "#ecfdf5",
  "--ok-fg": "#047857",
  "--fs-small": "13px",
  "--control-h": "40px",
  "--seg-track": "rgba(118, 118, 128, 0.12)",
  "--seg-thumb": "#ffffff",
  "--seg-shadow": "0 3px 8px rgba(0, 0, 0, 0.12), 0 3px 1px rgba(0, 0, 0, 0.04)",
}

/**
 * Pravidlá design systému vo widgete — **doslova z `globals.css`** (test
 * `widgetCss` ich tam hľadá). Triedy `.xw-*` sú externý widget kanála
 * (KANAL-widget-riadok-otazky, `conventions.md`); ostatné sú prevzaté
 * z aplikácie. Poloha a veľkosť sa dopĺňajú zvlášť (`widgetScript`).
 */
export const WIDGET_CSS: string[] = [
  ".button:hover:not(:disabled){background:var(--accent-strong)}",
  ".button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}",
  ".button--quiet{background:var(--surface);color:var(--ink);border-color:var(--line-strong)}",
  ".button--quiet:hover:not(:disabled){background:var(--surface-2)}",
  ".lnote{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border-radius:9px;background:var(--ok-bg);border:1px solid var(--line)}",
  ".lnote-mark{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;flex:0 0 auto;font-weight:800;font-size:12px;background:var(--ok-bg);color:var(--ok-fg)}",
  ".lnote-text{font-size:13px;color:var(--ok-fg);line-height:1.45}",
  ".lnote--info{background:var(--surface)}",
  ".lnote--info .lnote-mark{background:var(--surface-2);color:var(--ink)}",
  ".lnote--info .lnote-text{color:var(--ink)}",
  ".ask-sheet-examples h3{margin:0 10px 4px;font-size:10.5px;font-weight:650;letter-spacing:0.07em;text-transform:uppercase;color:var(--muted)}",
  ".ask-sheet-examples > button{display:flex;align-items:center;gap:12px;width:100%;min-height:40px;padding:0 10px;border:0;border-radius:9px;background:transparent;color:var(--ink);font:inherit;font-size:14px;text-align:left;cursor:pointer}",
  ".ask-sheet-examples > button:hover{background:var(--surface-2)}",
  ".ask-sheet-examples > button:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}",
  ".ask-sheet-examples > button > svg{flex:none;color:var(--muted)}",
  ".ask-sheet-examples > button > span{flex:1;min-width:0}",
  ".ask-sheet-examples > button > i{font-style:normal;font-size:12px;color:var(--muted);opacity:0}",
  ".ask-sheet-mine ul{margin:0;padding:0;list-style:none}",
  ".ask-sheet-mine li{display:flex;align-items:center;border-radius:9px}",
  ".ask-sheet-mine li:hover, .ask-sheet-mine li.is-active{background:var(--surface-2)}",
  ".ask-sheet-mine-open > svg{flex:none;color:var(--muted)}",
  ".ask-sheet-mine-open > span{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  ".ask-sheet-mine-open > time{flex:none;font-size:12px;color:var(--muted);font-variant-numeric:tabular-nums}",
  ".xw-row{display:flex;align-items:center;gap:12px;width:100%;min-height:52px;padding:0 8px 0 16px;background:var(--surface);border:1px solid var(--line-strong);border-radius:26px;box-shadow:0 1px 2px rgba(20,28,42,.08),0 12px 32px rgba(20,28,42,.18);font:inherit;font-size:15px;text-align:left;color:var(--muted);cursor:text;transition:box-shadow .2s ease}",
  ".xw-row:hover{box-shadow:0 1px 2px rgba(20,28,42,.08),0 16px 40px rgba(20,28,42,.24)}",
  ".xw-row:focus-visible{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft),0 12px 32px rgba(20,28,42,.18)}",
  ".xw-row-mark{display:grid;flex:none;color:var(--accent)}",
  ".xw-row-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}",
  ".xw-row-text.is-draft{color:var(--ink)}",
  ".xw-row--grip{padding-left:48px}",
  ".xw-grip{position:absolute;left:6px;top:50%;translate:0 -50%;display:grid;place-items:center;width:36px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--muted);cursor:grab;touch-action:none}",
  ".xw-grip:hover{background:var(--surface-2);color:var(--ink)}",
  ".xw-grip:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}",
  ".xw-dock.is-dragging .xw-grip{cursor:grabbing}",
  ".xw-dock.is-dragging .xw-row{box-shadow:0 1px 2px rgba(20,28,42,.08),0 20px 48px rgba(20,28,42,.28)}",
  ".xw-row--fold{padding-right:52px}",
  ".xw-fold{position:absolute;right:6px;top:50%;translate:0 -50%;display:grid;place-items:center;width:40px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--muted);cursor:pointer}",
  ".xw-fold:hover{background:var(--surface-2);color:var(--ink)}",
  ".xw-fold:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}",
  ".xw-row--help{padding-right:92px}",
  ".xw-help{position:absolute;right:46px;top:50%;translate:0 -50%;display:grid;place-items:center;width:40px;height:44px;border:0;border-radius:10px;background:transparent;color:var(--muted);cursor:pointer}",
  ".xw-help:hover,.xw-help[aria-expanded=true]{background:var(--surface-2);color:var(--ink)}",
  ".xw-help:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}",
  ".xw-dock.is-compact{width:max-content}",
  ".xw-pill{display:inline-flex;align-items:center;gap:8px;min-height:44px;padding:0 18px 0 12px;background:var(--surface);border:1px solid var(--line-strong);border-radius:22px;box-shadow:0 1px 2px rgba(20,28,42,.08),0 12px 32px rgba(20,28,42,.18);font:inherit;font-size:15px;font-weight:600;color:var(--ink);white-space:nowrap;cursor:grab;touch-action:none;transition:box-shadow .2s ease}",
  ".xw-pill:hover{box-shadow:0 1px 2px rgba(20,28,42,.08),0 16px 40px rgba(20,28,42,.24)}",
  ".xw-pill:focus-visible{outline:none;border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft),0 12px 32px rgba(20,28,42,.18)}",
  ".xw-dock.is-dragging .xw-pill{cursor:grabbing;box-shadow:0 1px 2px rgba(20,28,42,.08),0 20px 48px rgba(20,28,42,.28)}",
  ".xw-row-go{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:18px;background:var(--accent);color:var(--on-accent)}",
  ".xw-scrim{position:fixed;inset:0;background:rgba(20,28,42,.32);opacity:0;visibility:hidden;transition:opacity .28s ease,visibility .28s}",
  ".xw-scrim.is-open{opacity:1;visibility:visible}",
  ".xw-sheet{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 48px rgba(20,28,42,.28);overflow:hidden;opacity:0;visibility:hidden;scale:.92;transition:scale .32s cubic-bezier(.2,.8,.2,1),opacity .2s ease,visibility .32s}",
  ".xw-sheet.is-open{opacity:1;visibility:visible;scale:1}",
  ".xw-head{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:8px 8px 8px 18px;border-bottom:1px solid var(--line)}",
  ".xw-head-title{flex:1;min-width:0;font-weight:650;font-size:17px;color:var(--ink)}",
  ".xw-close{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:22px;background:transparent;color:var(--ink);font:inherit;font-size:24px;line-height:1;cursor:pointer}",
  ".xw-close:hover{background:var(--surface-2)}",
  ".xw-langs{display:inline-flex;gap:2px;padding:2px;border-radius:10px;background:var(--seg-track)}",
  ".xw-lang{min-width:44px;min-height:40px;padding:0 10px;border:0;border-radius:8px;background:transparent;color:var(--ink);font:inherit;font-size:var(--fs-small);font-weight:600;letter-spacing:0.04em;cursor:pointer}",
  ".xw-lang:hover{background:var(--surface)}",
  ".xw-lang:focus-visible{outline:2px solid var(--accent);outline-offset:-2px}",
  ".xw-lang.is-on{background:var(--seg-thumb);box-shadow:var(--seg-shadow)}",
  ".xw-body{flex:1;min-height:0;overflow:auto;background:var(--bg)}",
  ".xw-col{max-width:720px;margin:0 auto;padding:24px 20px;display:flex;flex-direction:column;gap:14px}",
  ".xw-empty{display:flex;flex-direction:column;gap:16px}",
  ".xw-empty h2{margin:0;font-size:22px;color:var(--ink)}",
  ".xw-lead{margin:0;color:var(--muted);white-space:pre-wrap}",
  ".xw-form{display:flex;flex-direction:column;gap:10px}",
  ".xw-field{display:grid;grid-template-columns:auto minmax(0,1fr);gap:12px;align-items:start;padding:12px 14px;border:1px solid var(--control-line);border-radius:14px;background:var(--surface)}",
  ".xw-field:focus-within{border-color:var(--accent);box-shadow:0 0 0 3px var(--accent-soft)}",
  ".xw-field-mark{display:grid;padding-top:3px;color:var(--accent)}",
  ".xw-field textarea{width:100%;min-height:0;padding:0;border:0;outline:0;resize:none;background:transparent;color:var(--ink);font:inherit;font-size:17px;line-height:1.5}",
  ".xw-bar{display:flex;align-items:center;flex-wrap:wrap;gap:10px}",
  ".xw-hint{flex:1;font-size:12.5px;color:var(--muted)}",
  ".xw-log{display:flex;flex-direction:column;gap:14px}",
  ".xw-composer{border-top:1px solid var(--line);background:var(--surface)}",
  ".xw-composer-in{max-width:720px;margin:0 auto;padding:12px 20px 10px;display:flex;flex-direction:column;gap:8px}",
  ".xw-foot{display:flex;flex-wrap:wrap;justify-content:center;align-items:center;gap:2px 14px;padding:4px 16px 8px;background:var(--surface);font-size:12px;color:var(--muted)}",
  ".xw-foot a{display:inline-flex;align-items:center;gap:5px;min-height:24px;color:var(--muted);text-decoration:none}",
  ".xw-foot a:hover{color:var(--ink);text-decoration:underline}",
  ".xw-foot a:focus-visible{outline:2px solid var(--accent);outline-offset:2px;border-radius:4px}",
  ".xw-foot-brand b{color:var(--ink);font-weight:600}",
  ".xw-q{align-self:flex-end;max-width:85%;padding:10px 14px;border-radius:14px;background:var(--accent);color:var(--on-accent);white-space:pre-wrap;overflow-wrap:anywhere}",
  ".xw-a{padding:14px 16px;border-radius:14px;background:var(--surface);border:1px solid var(--line);line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}",
  ".xw-a-head{display:block;margin:0 0 6px;font-size:12.5px;font-weight:600;color:var(--muted);white-space:normal}",
  ".xw-md{white-space:normal}.xw-md>*{margin:0 0 12px}.xw-md>:last-child{margin-bottom:0}",
  ".xw-md ul,.xw-md ol{padding-left:22px}",
  ".xw-wait{display:flex;align-items:center;gap:2px;font-weight:600;color:var(--ink)}.xw-wait .button-spinner{color:var(--accent)}.xw-a>.lnote{margin-top:12px}",
  ".xw-rate .button[aria-pressed=\"true\"]{opacity:1;background:var(--surface-2);border-color:var(--control-line)}",
  ".button-spinner{display:inline-block;width:12px;height:12px;margin-right:8px;vertical-align:-1px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:button-spin 0.7s linear infinite}",
  "@keyframes button-spin{to{transform:rotate(360deg)}}",
  ".xw-md-h{font-size:15.5px;font-weight:700}.xw-md>.xw-md-h{margin:18px 0 8px}.xw-md>.xw-md-h:first-child{margin-top:0}.xw-md-h--lg{font-size:16.5px}",
  ".xw-src{margin-top:10px;font-size:13px;color:var(--muted);white-space:normal}",
  ".xw-src ul{margin:4px 0 0;padding-left:18px}",
  ".xw-rate{display:flex;gap:8px;margin-top:12px;white-space:normal}",
  ".xw-sys{align-self:center;max-width:92%;color:var(--muted);font-size:13px;text-align:center}",
  ".xw-sys a{color:var(--accent)}",
  ".xw-card{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:14px;background:var(--surface);border:1px solid var(--line)}",
  ".xw-card h3{margin:0;font-size:17px;color:var(--ink)}",
  ".xw-card textarea{width:100%;min-height:96px;padding:10px;border:1px solid var(--control-line);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;resize:vertical}",
  ".xw-muted{color:var(--muted);font-size:13px;overflow-wrap:anywhere}",
  ".xw-tip{position:fixed;z-index:2147483002;width:min(360px,calc(100vw - 32px));padding:14px 14px 12px 16px;display:flex;flex-direction:column;gap:8px;background:var(--surface);border:1px solid var(--line);border-radius:14px;box-shadow:0 12px 32px rgba(20,28,42,.22)}",
  ".xw-tip::before{content:\"\";position:absolute;top:-7px;left:var(--tip-x,22px);width:12px;height:12px;background:var(--surface);border-left:1px solid var(--line);border-top:1px solid var(--line);transform:rotate(45deg)}",
  ".xw-tip.is-above::before{top:auto;bottom:-7px;transform:rotate(225deg)}",
  ".xw-tip-head{display:flex;align-items:flex-start;gap:8px}",
  ".xw-tip-title{flex:1;font-weight:650;font-size:15px;color:var(--ink)}",
  ".xw-tip-close{display:grid;place-items:center;flex:none;width:44px;height:44px;margin:-12px -10px -8px 0;border:0;border-radius:22px;background:transparent;color:var(--muted);font:inherit;font-size:20px;line-height:1;cursor:pointer}",
  ".xw-tip-close:hover{background:var(--surface-2);color:var(--ink)}",
  ".xw-tip p{margin:0;font-size:14px;line-height:1.5;color:var(--ink)}",
  ".xw-tip .xw-tip-move{display:flex;gap:8px;align-items:flex-start;color:var(--muted)}",
  ".xw-tip-move svg{flex:none;margin-top:1px}",
  ".xw-tip-actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:4px}",
  ".xw-dock.is-tip .xw-grip{animation:xw-pulse 1.6s ease-in-out infinite}",
  "@keyframes xw-pulse{0%,100%{background:transparent}50%{background:var(--accent-soft)}}",
]

/** Jazyk, ktorý skript pozná: texty, nastavené texty kanála a zdroje v ňom (D290). */
export interface WidgetLanguagePack {
  code: string
  /** Názov jazyka v ňom samom („Čeština") — pre čítačku a bublinu nad skratkou. */
  label: string
  /** Skratka na prepínači („CZ"); chýba = kód veľkými písmenami. */
  short?: string
  texts: Record<string, string>
  appearance?: WidgetAppearanceForScript
  sources?: { id: string; name: string; sub: string }[]
}

export interface WidgetScriptConfig {
  apiBase: string
  channel: string
  accent: string
  texts: Record<string, string>
  language: string
  /** Komu sa ozvať, keď widget nefunguje (kanál, inak kontakt organizácie). */
  contact: string | null
  /** Hover plného tlačidla (`--accent-strong`). */
  accentStrong?: string
  /** Jemný podklad vo farbe organizácie (prstenec fokusu, `--accent-soft`). */
  accentSoft?: string
  /** Povolené zdroje kanála; pri jedinom sa výber nekreslí. */
  sources?: { id: string; name: string; sub: string }[]
  /** Vzhľad a správanie z nastavenia kanála; chýbajúce = predvolené (D282, D283). */
  appearance?: WidgetAppearanceForScript
  /** Všetky jazyky kanála (D290); chýba alebo jeden = bez výberu jazyka. */
  languages?: WidgetLanguagePack[]
  /** Verzia a revízia nasadenia pre pätku, napr. `0.1.0 · 937ed63`. */
  version?: string
  /** Ochrana osobných údajov organizácie (`/privacy` na jej doméne). */
  privacyUrl?: string
}

const MARK = `<svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="20" r="15" stroke="currentColor" stroke-width="6"/><circle cx="17.5" cy="20" r="3.4" fill="currentColor"/><circle cx="30.5" cy="20" r="3.4" fill="currentColor"/><path d="M17 32.5 L24 43 L29 31.5 Z" fill="currentColor"/></svg>`
const ARROW = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>`
const CLOCK = `<svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="6.6"/><path d="M9 5.4V9l2.4 1.6"/></svg>`
const GRIP = `<svg width="14" height="20" viewBox="0 0 14 20" fill="currentColor" aria-hidden="true"><circle cx="4" cy="4" r="1.6"/><circle cx="10" cy="4" r="1.6"/><circle cx="4" cy="10" r="1.6"/><circle cx="10" cy="10" r="1.6"/><circle cx="4" cy="16" r="1.6"/><circle cx="10" cy="16" r="1.6"/></svg>`
/** Značka GitHubu — tá istá ako v pätičke aplikácie (`GitHubMark`). */
const GITHUB = `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 2-.27c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8z"/></svg>`
/** Tip znova — `lightbulb` zo SF Symbols (TipKit). */
const BULB = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.6 10.8c.7.5 1.1 1.3 1.1 2.2h5c0-.9.4-1.7 1.1-2.2A6 6 0 0 0 12 3z"/></svg>`
/** Zbaliť — `arrow.down.right.and.arrow.up.left` zo SF Symbols. */
const FOLD = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M14 10l7-7M14 10V5M14 10h5M10 14l-7 7M10 14v5M10 14H5"/></svg>`
const CROSS = `<svg width="14" height="14" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M5 5l8 8M13 5l-8 8"/></svg>`

/** Poloha a veľkosť podľa nastavenia kanála — mimo design systému, mení sa s nastavením. */
export function placementCss(look: WidgetAppearanceForScript): string[] {
  const row = isRowPosition(look.position)
  const anchor = anchorCss(look.position)
  // Veľkosť plachty (D283, D287): `xl` je 80 % × 80 % v strede, inak na mieste zatvoreného widgetu.
  const sheetPlace = look.size === "xl"
    ? "left:10vw;top:10vh;width:80vw;height:80vh;transform:none"
    : `${anchor};width:min(${WIDGET_SIZE_PX[look.size].width}px,calc(100vw - 32px));height:min(${WIDGET_SIZE_PX[look.size].height}px,calc(100vh - 32px))`
  return [
    row
      ? `.xw-dock{position:fixed;z-index:2147483000;${look.position === "top" ? "top" : "bottom"}:${EDGE}px;left:50%;transform:translateX(-50%);width:min(640px,calc(100vw - 32px))}`
      : `.fab{position:fixed;${anchor};z-index:2147483000;min-height:44px;padding:0 18px;border:0;border-radius:22px;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18)}`,
    ".xw-scrim{z-index:2147483000}",
    // Závoj len pri plachte cez obrazovku; menšia plachta stojí pri tlačidle bez neho.
    ...(look.size === "xl" ? [] : [".xw-scrim{display:none}"]),
    `.xw-sheet{position:fixed;z-index:2147483001;${sheetPlace};transform-origin:${originCss(look.position)}}`,
  ]
}

/**
 * Tlačidlo widgetu má terč 44 px aj na počítači — stojí v cudzej stránke
 * (aplikácia má `--control-h` 40 px, `.button--sm` 36 px). Ide **pred**
 * `WIDGET_CSS`, aby `.button--quiet` prebilo podklad `.button`.
 */
const BUTTON_CSS = [
  ".button{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--accent);color:var(--on-accent);border:1px solid var(--accent);border-radius:10px;min-height:44px;padding:0 18px;font:inherit;font-size:15px;font-weight:600;line-height:1.2;cursor:pointer;transition:background .15s ease;text-decoration:none}",
  ".button--sm{padding:0 14px;font-size:var(--fs-small)}",
  ".button:disabled{opacity:.5;cursor:not-allowed}",
]

/** Pravidlá len pre widget (Shadow DOM bez `globals.css`): reset, výber zdrojov, telefón. */
const SHADOW_CSS = [
  "*{box-sizing:border-box}",
  /* `hidden` musí vyhrať nad display z tried — časti sa skrývajú atribútom. */
  "[hidden]{display:none!important}",
  "button.ask-sheet-mine-open{flex:1;min-width:0;display:flex;align-items:center;gap:12px;min-height:40px;padding:0 4px 0 10px;border:0;background:transparent;color:var(--ink);font:inherit;font-size:14px;text-align:left;cursor:pointer}",
  ".ask-sheet-mine-hide{display:grid;place-items:center;flex:none;width:36px;height:36px;margin-right:4px;border:0;border-radius:7px;background:transparent;color:var(--muted);cursor:pointer}",
  ".ask-sheet-mine-hide:hover{background:var(--surface);color:var(--ink)}",
  ".scope-pane{display:grid;gap:8px;padding:10px 10px 12px;border-bottom:1px solid var(--line)}",
  ".scope-card{display:grid;border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}",
  ".scope-foot{display:flex;align-items:center;gap:10px}.scope-foot p{flex:1;margin:0;font-size:12.5px;color:var(--muted)}",
  ".form-row{position:relative;display:flex;align-items:center;gap:12px;min-height:44px;padding:9px 16px;margin:0;font-size:15px;line-height:1.35;color:var(--ink);cursor:pointer;overflow-wrap:anywhere}",
  ".form-row-main{flex:1 1 auto;min-width:0;display:grid;gap:1px}.form-row-sub{font-size:12.5px;color:var(--muted)}",
  '.form-row+.form-row::before{content:"";position:absolute;top:0;left:50px;right:0;border-top:1px solid var(--line)}',
  ".form-row:hover{background:var(--surface-2)}",
  ".form-row>input{appearance:none;-webkit-appearance:none;flex:none;margin:0;cursor:pointer;display:grid;place-items:center;font:inherit;color:inherit;width:22px;height:22px;border-radius:50%;border:1.5px solid var(--control-line)}",
  ".form-row>input:checked{background:var(--accent);border-color:var(--accent)}",
  '.form-row>input:checked::after{content:"";width:6px;height:11px;border:solid var(--on-accent);border-width:0 2.2px 2.2px 0;transform:translateY(-1px) rotate(45deg)}',
  ".form-row:has(> input:focus-visible){outline:2px solid var(--accent);outline-offset:-2px}",
  ".form-row:has(> input:disabled){cursor:default;opacity:.5}",
  ".lnote--action{align-items:center;flex-wrap:wrap}.lnote--action .lnote-text{flex:1 1 180px}",
]

/** Na konci — musí prebiť polohu a veľkosť z nastavenia (`placementCss`). */
const MEDIA_CSS = [
  /* Telefón: plachta je celá obrazovka, závoj netreba. */
  "@media (max-width:640px){.xw-sheet{top:0;right:0;bottom:0;left:0;transform:none;width:100vw;height:100vh;height:100dvh;border-radius:0;border:0}.xw-scrim{display:none}.xw-col{padding:20px 16px}.xw-composer-in{padding:12px 16px 10px}}",
  "@media (prefers-reduced-motion:reduce){.xw-sheet,.xw-scrim{transition:none}.button-spinner{animation:none}.xw-dock.is-tip .xw-grip{animation:none;background:var(--accent-soft)}}",
]

export function widgetScript(cfg: WidgetScriptConfig): string {
  const look = cfg.appearance ?? appearanceForScript(DEFAULT_WIDGET_APPEARANCE, "sk")
  const packs: WidgetLanguagePack[] = cfg.languages?.length
    ? cfg.languages
    : [{ code: cfg.language, label: cfg.language, texts: cfg.texts, appearance: look, sources: cfg.sources }]
  const config = JSON.stringify({ ...cfg, appearance: look, languages: packs })
  const tokens = Object.entries(WIDGET_TOKENS).map(([k, v]) => `${k}:${v}`).join(";")
  const row = isRowPosition(look.position)
  const css = JSON.stringify([...BUTTON_CSS, ...WIDGET_CSS, ...SHADOW_CSS, ...placementCss(look), ...MEDIA_CSS].join(""))
  return `(function(){
"use strict";
var CFG=${config};
var PACKS=CFG.languages;
var LOOK=CFG.appearance;
var ROW=${row ? "true" : "false"};
var STORE='contineo-widget-lang:'+CFG.channel;
var script=document.currentScript||(function(){var s=document.querySelectorAll('script[data-token]');return s[s.length-1]})();
var token=script&&script.getAttribute('data-token')||'';
var tokenUrl=script&&script.getAttribute('data-token-url')||'';
var negatives=0, conversation=[], busy=false, lastQuestion='', started=false;
var GITHUB=${JSON.stringify(GITHUB)}, GRIP=${JSON.stringify(GRIP)}, MARK=${JSON.stringify(MARK)}, ARROW=${JSON.stringify(ARROW)}, CLOCK=${JSON.stringify(CLOCK)}, CROSS=${JSON.stringify(CROSS)}, FOLD=${JSON.stringify(FOLD)}, BULB=${JSON.stringify(BULB)};

function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
/* Odpoveď je ľahký Markdown — rozklad ako v intranete (widgetMarkdown.ts), uzly len cez textContent. */
var mdBlocks=${WIDGET_MARKDOWN_JS};
function segs(n,list){list.forEach(function(x){n.appendChild(x.bold?el('strong',null,x.text):document.createTextNode(x.text))});return n}
function renderMd(box,text){box.textContent='';mdBlocks(text).forEach(function(b){
  if(b.kind==='h')box.appendChild(segs(el('div','xw-md-h'+(b.level<=2?' xw-md-h--lg':'')),b.segments));
  else if(b.kind==='p')box.appendChild(segs(el('p'),b.segments));
  else{var l=el(b.numbered?'ol':'ul');b.items.forEach(function(it,j){var li=segs(el('li'),it);if(b.values[j]!=null)li.value=b.values[j];l.appendChild(li)});box.appendChild(l)}})}
function svg(html,size){var s=el('span');s.innerHTML=html;var g=s.firstChild;if(size){g.setAttribute('width',size);g.setAttribute('height',size)}return g}
/* Ten istý tvar ako normalizePhrase() na serveri — frázy prichádzajú už v ňom. */
function norm(s){return String(s).toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g,'').replace(/\\s+/g,' ').trim()}
function wantsHelpdesk(q){var n=norm(q);return (LOOK.phrases||[]).some(function(p){return p&&n.indexOf(p)>=0})}
function claims(){try{var p=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');var b=atob(p);var u=new Uint8Array(b.length);for(var i=0;i<b.length;i++)u[i]=b.charCodeAt(i);return JSON.parse(new TextDecoder().decode(u))||{}}catch(e){return {}}}
/* Kam príde odpoveď: claim email z tokenu (D275). */
function replyAddress(){return claims().email||''}

/* Jazyk (D290): voľba z minulej návštevy, potom lang z tokenu, potom prvý jazyk kanála. */
function pack(code){for(var i=0;i<PACKS.length;i++)if(PACKS[i].code===code)return PACKS[i];return null}
var saved=null;try{saved=localStorage.getItem(STORE)}catch(e){}
var P=pack(saved)||pack(claims().lang)||pack(CFG.language)||PACKS[0];
var T=P.texts;
/* Texty, ktoré sa pri zmene jazyka prepíšu: [prvok, kľúč, atribút]. */
var LABELS=[];
function label(e,key,attr){var v=T[key]||'';if(attr)e.setAttribute(attr,v);else e.textContent=v}
function tx(e,key,attr){LABELS.push([e,key,attr]);label(e,key,attr);return e}
function own(key){return (P.appearance&&P.appearance[key])||''}

var host=el('div');host.setAttribute('data-contineo-helpdesk','');
var root=host.attachShadow({mode:'open'});
var style=document.createElement('style');
style.textContent=':host{all:initial;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--ink);${tokens};--accent:'+CFG.accent+';--accent-strong:'+(CFG.accentStrong||CFG.accent)+';--accent-soft:'+(CFG.accentSoft||'rgba(20,28,42,.12)')+'}'+${css};
root.appendChild(style);

/* Zatvorený widget: riadok otázky (hore/dole v strede, D286) alebo tlačidlo. */
var launcher,rowText=null,dock,grip=null,fold=null,pill=null,help=null;
if(ROW){
  /* Úchyt a zbalenie sú vedľa riadku v obale, nie v ňom — tlačidlo v tlačidle nie je platné HTML. */
  dock=el('div','xw-dock');
  launcher=el('button','xw-row xw-row--grip xw-row--fold xw-row--help');launcher.type='button';
  grip=el('button','xw-grip');grip.type='button';grip.appendChild(svg(GRIP));tx(grip,'move','aria-label');tx(grip,'move','title');
  /* Tip na požiadanie (Ján 28. 10. 2026): ten istý ako pri prvej návšteve. */
  help=el('button','xw-help');help.type='button';help.appendChild(svg(BULB));tx(help,'tipShow','aria-label');tx(help,'tipShow','title');help.setAttribute('aria-expanded','false');
  fold=el('button','xw-fold');fold.type='button';fold.appendChild(svg(FOLD));tx(fold,'fold','aria-label');tx(fold,'fold','title');
  var rm=el('span','xw-row-mark');rm.appendChild(svg(MARK));rowText=el('span','xw-row-text');
  var go=el('span','xw-row-go');go.appendChild(svg(ARROW));
  launcher.appendChild(rm);launcher.appendChild(rowText);launcher.appendChild(go);
  /* Zbalený tvar: tlačidlo „Opýtajte sa…" — ťahá sa celé, klik rozbalí riadok. */
  pill=el('button','xw-pill');pill.type='button';pill.hidden=true;tx(pill,'unfold','title');
  var pm=el('span','xw-row-mark');pm.appendChild(svg(MARK,20));pill.appendChild(pm);pill.appendChild(tx(el('span'),'pill'));
  dock.appendChild(launcher);dock.appendChild(grip);dock.appendChild(help);dock.appendChild(fold);dock.appendChild(pill);
}else{launcher=el('button','fab');launcher.type='button';dock=launcher}
var scrim=el('div','xw-scrim');
var sheet=el('section','xw-sheet');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
/* Hlavička: značka, názov, jazyk, zdroje, zavrieť. */
var head=el('div','xw-head');var hm=el('span','xw-row-mark');hm.appendChild(svg(MARK));
head.appendChild(hm);head.appendChild(tx(el('span','xw-head-title'),'title'));
/* Prepínač jazyka: skratky SK / CZ / EN, plný názov pre čítačku (D290). */
var langBtns=[];
if(PACKS.length>1){
  var langs=el('div','xw-langs');langs.setAttribute('role','group');tx(langs,'language','aria-label');
  PACKS.forEach(function(p){var b=el('button','xw-lang',p.short||p.code.toUpperCase());b.type='button';b.lang=p.code;b.title=p.label;b.setAttribute('aria-label',p.label);
    b.addEventListener('click',function(){setLanguage(p.code)});langBtns.push([b,p.code]);langs.appendChild(b)});
  head.appendChild(langs);syncLangs();
}
function syncLangs(){langBtns.forEach(function(x){var on=x[1]===P.code;x[0].classList.toggle('is-on',on);x[0].setAttribute('aria-pressed',String(on))})}
var scopeBtn=null,scopeVal=null,pane=null,boxes=[],hint=null,rowNames=[],rowSubs=[];
function SRC(){return P.sources||[]}
var on=SRC().map(function(x){return x.id});
var last={question:null,ids:null,from:'',answer:null,note:null};
function names(ids){return SRC().filter(function(x){return ids.indexOf(x.id)>=0}).map(function(x){return x.name}).join(', ')}
function same(a,b){return a.length===b.length&&a.every(function(x){return b.indexOf(x)>=0})}
if(SRC().length>1){
  scopeBtn=el('button','button button--quiet button--sm');scopeBtn.type='button';scopeBtn.setAttribute('aria-expanded','false');scopeBtn.setAttribute('aria-controls','scope-pane');
  scopeVal=el('span');var arrow=el('span',null,'\\u25be');arrow.setAttribute('aria-hidden','true');
  scopeBtn.appendChild(scopeVal);scopeBtn.appendChild(arrow);head.appendChild(scopeBtn);
}
var close=el('button','xw-close','\\u00d7');close.type='button';tx(close,'close','aria-label');head.appendChild(close);
sheet.appendChild(head);
if(scopeBtn){
  pane=el('div','scope-pane');pane.id='scope-pane';pane.setAttribute('role','group');tx(pane,'scopeLabel','aria-label');pane.hidden=true;
  var card=el('div','scope-card');
  SRC().forEach(function(x){var row=el('label','form-row');var cb=el('input');cb.type='checkbox';cb.value=x.id;cb.checked=true;
    var main=el('span','form-row-main');var nm=el('span',null,x.name);var sb=el('span','form-row-sub',x.sub);rowNames.push(nm);rowSubs.push(sb);main.appendChild(nm);main.appendChild(sb);
    row.appendChild(cb);row.appendChild(main);card.appendChild(row);boxes.push(cb)});
  var sf=el('div','scope-foot');hint=el('p');var done=tx(el('button','button button--quiet'),'scopeDone');done.type='button';sf.appendChild(hint);sf.appendChild(done);
  pane.appendChild(card);pane.appendChild(sf);sheet.appendChild(pane);
  var setOpen=function(o){pane.hidden=!o;scopeBtn.setAttribute('aria-expanded',String(o));if(o&&boxes[0])boxes[0].focus({preventScroll:true})};
  scopeBtn.addEventListener('click',function(){setOpen(pane.hidden)});
  done.addEventListener('click',function(){setOpen(false);scopeBtn.focus()});
  pane.addEventListener('keydown',function(e){if(e.key==='Escape'){e.stopPropagation();setOpen(false);scopeBtn.focus()}});
  boxes.forEach(function(cb){cb.addEventListener('change',syncScope)});
}
/* Posledný zapnutý riadok sa zamkne — výber nesmie byť prázdny. */
function syncScope(){
  if(!scopeBtn)return;
  on=boxes.filter(function(b){return b.checked}).map(function(b){return b.value});
  var lbl=T.scopeButton.replace('{names}',names(on));
  scopeVal.textContent=lbl;scopeBtn.setAttribute('aria-label',lbl);
  boxes.forEach(function(b){b.disabled=b.checked&&on.length===1});
  hint.textContent=on.length===1?T.scopeLast+' '+T.scopeHint:T.scopeHint;
  syncNote();
}
function syncNote(){if(!last.note)return;last.note.hidden=!last.ids||same(on,last.ids)}

/* Telo: prázdny stav (pole, nedávne otázky, vzory), potom rozhovor. */
var body=el('div','xw-body');var col=el('div','xw-col');body.appendChild(col);
var empty=el('div','xw-empty');
var lead=el('p','xw-lead');
function field(rows,key){var f=el('div','xw-field');var m=el('span','xw-field-mark');m.appendChild(svg(MARK,20));var t=el('textarea');t.rows=rows;tx(t,key,'placeholder');tx(t,key,'aria-label');f.appendChild(m);f.appendChild(t);return {box:f,input:t}}
var first=field(4,'placeholder');
var firstForm=el('form','xw-form');var firstBar=el('div','xw-bar');var firstSend=tx(el('button','button'),'send');firstSend.type='submit';
firstBar.appendChild(tx(el('span','xw-hint'),'enterHint'));firstBar.appendChild(firstSend);firstForm.appendChild(first.box);firstForm.appendChild(firstBar);
var mine=el('div','ask-sheet-examples ask-sheet-mine');mine.hidden=true;var mineH=el('h3');var mineList=el('ul');mine.appendChild(mineH);mine.appendChild(mineList);
var examples=el('div','ask-sheet-examples');
empty.appendChild(tx(el('h2'),'emptyTitle'));empty.appendChild(lead);empty.appendChild(firstForm);empty.appendChild(mine);empty.appendChild(examples);
var log=el('div','xw-log');log.hidden=true;
var esc=el('div','xw-card');esc.hidden=true;var escIntro=el('div','xw-muted');var escTa=el('textarea');tx(escTa,'escalateMessage','placeholder');tx(escTa,'escalateMessage','aria-label');var escTo=el('div','xw-muted');escTo.hidden=true;
var escActions=el('div','xw-bar');var escBtn=tx(el('button','button'),'escalateSubmit');escBtn.type='button';var escCancel=tx(el('button','button button--quiet'),'escalateCancel');escCancel.type='button';
escActions.appendChild(escBtn);escActions.appendChild(escCancel);esc.appendChild(tx(el('h3'),'writeHelpdesk'));esc.appendChild(escIntro);esc.appendChild(escTa);esc.appendChild(escTo);esc.appendChild(escActions);
col.appendChild(empty);col.appendChild(log);col.appendChild(esc);
/* Pole pod rozhovorom po prvej otázke. */
var composer=el('div','xw-composer');composer.hidden=true;var cin=el('div','xw-composer-in');
var more=field(1,'askMore');var moreForm=el('form','xw-form');
var moreBar=el('div','xw-bar');var offerBtn=tx(el('button','button button--quiet button--sm'),'writeHelpdesk');offerBtn.type='button';offerBtn.hidden=true;
var moreSend=tx(el('button','button'),'send');moreSend.type='submit';
moreBar.appendChild(offerBtn);moreBar.appendChild(el('span','xw-hint'));moreBar.appendChild(moreSend);moreForm.appendChild(more.box);moreForm.appendChild(moreBar);
cin.appendChild(moreForm);composer.appendChild(cin);
/* Pätka (Ján 27. 10. 2026): na čom pomocník beží, ochrana osobných údajov
   organizácie, zdrojový kód a verzia — ako pätička intranetu (Footer.tsx).
   Človek v cudzom systéme inak nevie, čí je to nástroj a komu hlásiť chybu.
   Stojí pod plachtou vždy, aj v prázdnom stave. */
var foot=el('div','xw-foot');
function ext(href){var a=el('a');a.href=href;a.target='_blank';a.rel='noreferrer';return a}
var brand=ext('https://contineo.app');brand.className='xw-foot-brand';brand.appendChild(tx(el('span'),'runsOn'));brand.appendChild(svg(MARK,16));brand.appendChild(el('b',null,'Contineo'));
foot.appendChild(brand);
if(CFG.privacyUrl)foot.appendChild(tx(ext(CFG.privacyUrl),'privacyLink'));
var src=ext('https://github.com/ltksolutions/contineo');src.appendChild(svg(GITHUB,13));src.appendChild(tx(el('span'),'sourceCode'));foot.appendChild(src);
if(CFG.version){var ver=el('span');var vl=tx(el('span'),'version');ver.appendChild(vl);ver.appendChild(document.createTextNode(' '+CFG.version));foot.appendChild(ver)}
sheet.appendChild(body);sheet.appendChild(composer);sheet.appendChild(foot);
root.appendChild(dock);root.appendChild(scrim);root.appendChild(sheet);
document.body.appendChild(host);

/* Texty nastavené v kanáli (riadok, tlačidlo, privítanie, vzory) — v aktuálnom jazyku. */
function syncOwn(){
  if(ROW){var d=first.input.value.trim();var ph=own('placeholder')||T.rowPlaceholder;rowText.textContent=d||ph;rowText.classList.toggle('is-draft',!!d);launcher.setAttribute('aria-label',T.title+': '+ph)}
  else launcher.textContent=own('launcher')||T.open;
  lead.textContent=own('greeting')||T.emptyLead;
  sheet.setAttribute('aria-label',T.title);
  renderExamples();
}
function renderExamples(){
  examples.textContent='';var list=(P.appearance&&P.appearance.examples)||[];
  examples.hidden=!list.length||!!first.input.value.trim();if(examples.hidden)return;
  examples.appendChild(el('h3',null,T.examplesLabel));
  list.forEach(function(x){var b=el('button');b.type='button';b.appendChild(svg(MARK,15));b.appendChild(el('span',null,x));b.appendChild(el('i',null,T.insert));
    /* Vzor otázku vloží, neodošle — človek ju má vidieť a môže ju upraviť. */
    b.addEventListener('click',function(){first.input.value=x;first.input.focus();onFirstInput()});examples.appendChild(b)});
}

function setLanguage(code){
  var p=pack(code);if(!p)return;P=p;T=p.texts;
  try{localStorage.setItem(STORE,code)}catch(e){}
  LABELS.forEach(function(l){label(l[0],l[1],l[2])});
  SRC().forEach(function(x,i){if(rowNames[i]){rowNames[i].textContent=x.name;rowSubs[i].textContent=x.sub}});
  syncScope();syncOwn();syncLangs();if(!started)loadHistory(first.input.value);
}

/* Otvorenie: plachta vyrastie z miesta zatvoreného widgetu; ten sa medzitým skryje. */
function isOpen(){return sheet.classList.contains('is-open')}
function openPanel(){hideTip();if(isOpen())return;sheet.classList.add('is-open');scrim.classList.add('is-open');dock.hidden=true;
  if(!started)loadHistory(first.input.value);
  setTimeout(function(){var t=started?more.input:first.input;t.focus();t.setSelectionRange(t.value.length,t.value.length)},40)}
function closePanel(){sheet.classList.remove('is-open');scrim.classList.remove('is-open');dock.hidden=false;syncOwn();(compact?pill:launcher).focus()}
launcher.addEventListener('click',openPanel);

/* Posúvanie za úchyt riadku alebo za celé zbalené tlačidlo. Miesto = podiel
   okna a strana, ku ktorej sa drží (ľavý alebo pravý okraj) — riadok aj
   tlačidlo potom stoja pri tom istom okraji a prepínanie ich nerozháže. */
var POS='contineo-widget-pos:'+CFG.channel,MODE='contineo-widget-mode:'+CFG.channel,anchor=null,compact=false,dragEnd=0;
function clampTo(x,y){var r=dock.getBoundingClientRect();return [Math.max(8,Math.min(x,innerWidth-r.width-8)),Math.max(8,Math.min(y,innerHeight-r.height-8))]}
function place(x,y){var c=clampTo(x,y);dock.style.left=c[0]+'px';dock.style.top=c[1]+'px';dock.style.bottom='auto';dock.style.transform='none';positionTip();return c}
function applyAnchor(){if(!anchor)return;var w=dock.getBoundingClientRect().width;place(anchor.s==='r'?anchor.x*innerWidth-w:anchor.x*innerWidth,anchor.y*innerHeight)}
function savePos(c){var w=dock.getBoundingClientRect().width,right=c[0]+w/2>innerWidth/2;
  anchor={x:(right?c[0]+w:c[0])/innerWidth,y:c[1]/innerHeight,s:right?'r':'l'};try{localStorage.setItem(POS,JSON.stringify(anchor))}catch(e){}}
function resetPos(){anchor=null;dock.style.left=dock.style.top=dock.style.bottom=dock.style.transform='';try{localStorage.removeItem(POS)}catch(e){}positionTip()}
function restorePos(){var p=null;try{p=JSON.parse(localStorage.getItem(POS)||'null')}catch(e){}if(p&&typeof p.x==='number'&&typeof p.y==='number'){anchor={x:p.x,y:p.y,s:p.s==='r'?'r':'l'};applyAnchor()}}
/* Dva tvary zatvoreného widgetu: riadok a tlačidlo. Voľbu si pamätá prehliadač. */
function setCompact(on,focus){if(!pill)return;compact=on;dock.classList.toggle('is-compact',on);
  launcher.hidden=grip.hidden=help.hidden=fold.hidden=on;pill.hidden=!on;
  try{if(on)localStorage.setItem(MODE,'button');else localStorage.removeItem(MODE)}catch(e){}
  applyAnchor();positionTip();if(focus)(on?pill:launcher).focus()}
/* Ťahanie: kým sa ukazovateľ nepohne o 5 px, je to klik. */
function draggable(h){var drag=null;
  h.addEventListener('pointerdown',function(e){if(e.button!==0)return;var r=dock.getBoundingClientRect();drag={sx:e.clientX,sy:e.clientY,dx:e.clientX-r.left,dy:e.clientY-r.top,moved:false};h.setPointerCapture(e.pointerId);e.preventDefault()});
  h.addEventListener('pointermove',function(e){if(!drag)return;if(!drag.moved){if(Math.abs(e.clientX-drag.sx)+Math.abs(e.clientY-drag.sy)<5)return;drag.moved=true;dock.classList.add('is-dragging')}drag.c=place(e.clientX-drag.dx,e.clientY-drag.dy)});
  function end(){if(!drag)return;if(drag.moved&&drag.c){savePos(drag.c);dragEnd=Date.now()}drag=null;dock.classList.remove('is-dragging')}
  h.addEventListener('pointerup',end);h.addEventListener('pointercancel',end);
  h.addEventListener('dblclick',resetPos);
  h.addEventListener('keydown',function(e){
    if(e.key==='Home'){e.preventDefault();resetPos();return}
    var step=e.shiftKey?64:16,d={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]}[e.key];if(!d)return;
    e.preventDefault();var r=dock.getBoundingClientRect();savePos(place(r.left+d[0],r.top+d[1]))})}
if(grip){
  draggable(grip);draggable(pill);
  fold.addEventListener('click',function(){hideTip();setCompact(true,true)});
  help.addEventListener('click',function(){if(tip)hideTip();else showTip(true)});
  pill.addEventListener('click',function(){if(Date.now()-dragEnd<400)return;setCompact(false,true)});
  /* Po zmene veľkosti okna ostane widget celý na obrazovke. */
  addEventListener('resize',applyAnchor);
}
/* Písanie do zatvoreného riadku ho rozbalí a znak pokračuje v poli. */
function typeToOpen(e){if(!ROW||e.ctrlKey||e.metaKey||e.altKey||e.key.length!==1||e.key===' ')return;e.preventDefault();first.input.value+=e.key;openPanel();onFirstInput()}
launcher.addEventListener('keydown',typeToOpen);if(pill)pill.addEventListener('keydown',typeToOpen);
close.addEventListener('click',closePanel);
scrim.addEventListener('click',closePanel);
sheet.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen()){e.preventDefault();closePanel()}});
/* Odkazy „Pomoc" v cudzom systéme (D285): \`onclick="return !(window.ContineoHelpdesk&&ContineoHelpdesk.open())"\`
   pri \`href="mailto:…"\` — bez skriptu ostane e-mail. */
window.ContineoHelpdesk={open:function(){openPanel();return true}};

function scrollEnd(){body.scrollTop=body.scrollHeight}
function sys(text){var m=el('div','xw-sys',text);log.appendChild(m);scrollEnd();return m}
/* Potvrdenie, ktoré si človek musí všimnúť (poďakovanie, odoslaná správa) — zelený .lnote, nie sivý riadok (Ján 29. 10. 2026). */
function done(text,parent){var m=el('div','lnote');m.setAttribute('role','status');m.appendChild(el('span','lnote-mark','\u2713'));m.appendChild(el('span','lnote-text',text));(parent||log).appendChild(m);scrollEnd();return m}
/* Hľadanie beží — točiaci sa kruh priamo v karte odpovede, kam sa človek pozerá. */
function waiting(box){var w=el('div','xw-wait');w.setAttribute('role','status');w.appendChild(el('span','button-spinner'));w.appendChild(document.createTextNode(T.thinking));box.appendChild(w);scrollEnd();return w}
var contactShown=false;
function contact(){if(contactShown||!CFG.contact)return;contactShown=true;var m=el('div','xw-sys');m.appendChild(document.createTextNode(T.contact+' '));var a=el('a',null,CFG.contact);a.href='mailto:'+CFG.contact;m.appendChild(a);log.appendChild(m);scrollEnd()}

function refreshToken(){
  if(!tokenUrl)return Promise.resolve(false);
  return fetch(tokenUrl,{credentials:'same-origin'}).then(function(r){return r.ok?r.text():''}).then(function(t){t=(t||'').trim();if(t){try{var j=JSON.parse(t);t=j.token||t}catch(e){}token=t;return true}return false}).catch(function(){return false});
}
function api(path,body,retry){
  return fetch(CFG.apiBase+'/api/widget/'+encodeURIComponent(CFG.channel)+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({token:token},body))}).then(function(r){
    if(r.status===401&&!retry){return refreshToken().then(function(ok){if(ok)return api(path,body,true);throw new Error('expired')})}
    return r;
  });
}

/* Nedávne otázky osoby (D288) — pomôcka, nie podmienka: pri chybe sa časť nekreslí. */
var histTimer=null,histSeq=0;
function loadHistory(q){clearTimeout(histTimer);q=(q||'').trim();histTimer=setTimeout(function(){var seq=++histSeq;
  api('history',{action:'list',q:q}).then(function(r){return r.ok?r.json():{items:[]}}).then(function(j){if(seq===histSeq&&!started)renderHistory(j.items||[],!!q)}).catch(function(){mine.hidden=true})},q?250:0)}
function when(iso){var d=new Date(iso);if(isNaN(d.getTime()))return '';return d.toLocaleDateString(P.code==='en'?'en-GB':P.code,{day:'numeric',month:'numeric'})}
function renderHistory(items,filtered){
  mineList.textContent='';mine.hidden=!items.length;if(!items.length)return;
  mineH.textContent=filtered?T.historyMatching:T.historyRecent;
  items.forEach(function(it){var li=el('li');var b=el('button','ask-sheet-mine-open');b.type='button';b.appendChild(svg(CLOCK));b.appendChild(el('span',null,it.question));var t=el('time',null,when(it.createdAt));t.setAttribute('datetime',it.createdAt);b.appendChild(t);
    b.addEventListener('click',function(){openSaved(it.id)});
    var x=el('button','ask-sheet-mine-hide');x.type='button';x.setAttribute('aria-label',T.historyHide);x.title=T.historyHide;x.appendChild(svg(CROSS));
    /* × skryje otázku z histórie, nie z hodnotenia (H2). */
    x.addEventListener('click',function(){li.remove();if(!mineList.firstChild)mine.hidden=true;api('history',{action:'hide',id:it.id}).catch(function(){})});
    li.appendChild(b);li.appendChild(x);mineList.appendChild(li)});
}
/* Uložená odpoveď sa otvorí v plachte ako časť rozhovoru, s palcami. */
function openSaved(id){
  api('history',{action:'open',id:id}).then(function(r){if(!r.ok)throw new Error('http');return r.json()}).then(function(j){
    start();log.appendChild(el('div','xw-q',j.question));var a=answerBox();renderMd(a.body,j.answer);lastQuestion=j.question;
    showSources(a.box,j.sources||[]);conversation.push({recordId:id,question:j.question,verdict:null,answer:j.answer||''});rateButtons(id,a.box);syncOffer();scrollEnd();
  }).catch(function(e){start();sys(e&&e.message==='expired'?T.expired:T.error)});
}

function start(){if(started)return;started=true;empty.hidden=true;log.hidden=false;composer.hidden=false;setTimeout(function(){more.input.focus()},0)}

/* Formulár správy (D275): úvod podľa toho, prečo sa otvoril, predvyplnená
   posledná otázka, adresa odpovede. Odkaz sa medzitým skryje. */
function offerEscalation(direct){
  start();
  escIntro.textContent=direct?T.escalateIntroDirect:T.escalateIntro;
  if(!escTa.value.trim()&&lastQuestion)escTa.value=lastQuestion;
  var to=replyAddress();escTo.textContent=to?T.replyTo.replace('{email}',to):'';escTo.hidden=!to;
  esc.hidden=false;offerBtn.hidden=true;scrollEnd();
  escTa.focus();escTa.setSelectionRange(escTa.value.length,escTa.value.length);
}
function closeEscalation(){esc.hidden=true;syncOffer();more.input.focus()}
function syncOffer(){offerBtn.hidden=!LOOK.offerLink||!conversation.length||!esc.hidden}
offerBtn.addEventListener('click',function(){offerEscalation(true)});
escCancel.addEventListener('click',closeEscalation);

function answerBox(){var a=el('div','xw-a');var h=el('span','xw-a-head');h.hidden=true;var b=el('div','xw-md');a.appendChild(h);a.appendChild(b);log.appendChild(a);return {box:a,head:h,body:b}}
function showSources(box,sources){if(!sources.length)return;var s=el('div','xw-src',T.sources);var ul=el('ul');var seen={};
  sources.forEach(function(x){var k=(x.title||'')+'|'+(x.articleRef||'');if(seen[k])return;seen[k]=1;ul.appendChild(el('li',null,(x.title||'')+(x.articleRef?' ('+x.articleRef+')':'')))});s.appendChild(ul);box.appendChild(s)}
function rateButtons(recordId,answerEl){
  var rate=el('div','xw-rate');var up=el('button','button button--quiet button--sm',T.helpful);up.type='button';var down=el('button','button button--quiet button--sm',T.notHelpful);down.type='button';
  function pick(v){up.disabled=down.disabled=true;(v===1?up:down).setAttribute('aria-pressed','true');
    conversation.forEach(function(c){if(c.recordId===recordId)c.verdict=v});
    api('feedback',{id:recordId,verdict:v}).catch(function(){});
    if(v===0){negatives++;if(negatives>=LOOK.escalateAfter){sys(T.tryAgain);offerEscalation(false)}}else{done(T.thanks,answerEl)}}
  up.addEventListener('click',function(){pick(1)});down.addEventListener('click',function(){pick(0)});
  rate.appendChild(up);rate.appendChild(down);answerEl.appendChild(rate);
}

function ask(q){
  busy=true;firstSend.disabled=moreSend.disabled=true;if(scopeBtn)scopeBtn.disabled=true;lastQuestion=q;
  if(last.note){last.note.remove();last.note=null}
  log.appendChild(el('div','xw-q',q));
  var A=answerBox();var ran=null;
  var thinking=waiting(A.body);
  var text='',sources=[],recordId=null;
  /* Posledné kolá toho istého okna — model vie, na čo otázka nadväzuje. */
  var history=conversation.slice(-3).map(function(c){return {question:c.question,answer:c.answer||''}});
  api('chat',{query:q,language:P.code,sources:on.slice(),history:history}).then(function(r){
    if(!r.ok||!r.body){throw new Error(r.status===429?'rate':'http')}
    var reader=r.body.getReader(),dec=new TextDecoder(),buf='';
    function pump(){return reader.read().then(function(res){
      if(res.done)return;
      buf+=dec.decode(res.value,{stream:true});
      var parts=buf.split('\\n\\n');buf=parts.pop()||'';
      parts.forEach(function(p){var line=p.split('\\n').filter(function(l){return l.indexOf('data: ')===0})[0];if(!line)return;var ev;try{ev=JSON.parse(line.slice(6))}catch(e){return}
        if(ev.type==='scope'){ran=ev;A.head.textContent=ev.kicker||'';A.head.hidden=!ev.kicker}
        else if(ev.type==='token'){text+=ev.token;renderMd(A.body,text);thinking.remove();scrollEnd()}
        else if(ev.type==='done'){sources=ev.sources||[]}
        else if(ev.type==='recorded'){recordId=ev.id}
        else if(ev.type==='error'){text=text||T.error;A.body.textContent=text}
      });
      return pump();
    })}
    return pump();
  }).then(function(){
    thinking.remove();
    if(!text.trim()||!sources.length){A.body.textContent=T.noAnswer;negatives++;conversation.push({recordId:null,question:q,verdict:0,answer:''});if(negatives>=LOOK.escalateAfter)offerEscalation(false);return}
    showSources(A.box,sources);
    conversation.push({recordId:recordId,question:q,verdict:null,answer:text});
    if(recordId)rateButtons(recordId,A.box);
    if(ran&&scopeBtn){
      last={question:q,ids:ran.ids||[],from:ran.from||'',answer:A.box,note:null};
      var n=el('div','lnote lnote--info lnote--action');n.setAttribute('role','status');
      var mk=el('span','lnote-mark','!');mk.setAttribute('aria-hidden','true');
      var nt=el('span','lnote-text',(last.ids.length===1?T.scopeChangedOnly:T.scopeChanged).replace('{from}',last.from));
      var rb=el('button','button button--quiet button--sm',T.reask);rb.type='button';
      rb.addEventListener('click',function(){if(!busy)ask(last.question)});
      n.appendChild(mk);n.appendChild(nt);n.appendChild(rb);A.box.insertAdjacentElement('afterend',n);last.note=n;syncNote();
    }
  }).catch(function(e){thinking.remove();A.body.textContent=e&&e.message==='expired'?T.expired:(e&&e.message==='rate'?(T.rateLimited||T.error):T.error);if(!e||e.message!=='rate')contact()}).then(function(){busy=false;firstSend.disabled=moreSend.disabled=false;if(scopeBtn)scopeBtn.disabled=false;syncOffer();scrollEnd()});
}

/* Fráza zo zoznamu (D275): správa sa ponúkne hneď, asistent sa nepýta. */
function submitQuestion(input){var q=input.value.trim();if(!q||busy)return;input.value='';
  start();
  if(wantsHelpdesk(q)){log.appendChild(el('div','xw-q',q));scrollEnd();offerEscalation(true);return}
  ask(q)}
function onFirstInput(){renderExamples();loadHistory(first.input.value)}
firstForm.addEventListener('submit',function(ev){ev.preventDefault();submitQuestion(first.input)});
moreForm.addEventListener('submit',function(ev){ev.preventDefault();submitQuestion(more.input)});
first.input.addEventListener('input',onFirstInput);
[first.input,more.input].forEach(function(t){t.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();t.form.dispatchEvent(new Event('submit',{cancelable:true}))}})});
escBtn.addEventListener('click',function(){var m=escTa.value.trim();if(!m)return;escBtn.disabled=true;
  api('ticket',{message:m,language:P.code,page:location.href.split('#')[0],conversation:conversation.map(function(c){return {recordId:c.recordId,question:c.question,verdict:c.verdict}})}).then(function(r){if(!r.ok)throw new Error('http');esc.hidden=true;escTa.value='';done(T.escalated);negatives=0;syncOffer()}).catch(function(e){sys(e&&e.message==='expired'?T.expired:T.error);contact()}).then(function(){escBtn.disabled=false})});

/* Úvodný tip (D291): raz v prehliadači. Bez úložiska sa neukáže — inak by
   sa ukazoval pri každom načítaní stránky. */
var TIPKEY='contineo-widget-tip:'+CFG.channel,tip=null;
function tipSeen(){try{return localStorage.getItem(TIPKEY)==='1'}catch(e){return true}}
function hideTip(){if(!tip)return;tip.remove();tip=null;dock.classList.remove('is-tip');if(help)help.setAttribute('aria-expanded','false');try{localStorage.setItem(TIPKEY,'1')}catch(e){}}
function positionTip(){
  if(!tip)return;var r=dock.getBoundingClientRect();
  /* Pod riadkom má tip jeho šírku; pod tlačidlom a v rohu ostáva úzky. */
  tip.style.width=grip&&!compact?r.width+'px':'';var w=tip.offsetWidth,h=tip.offsetHeight;
  var below=r.bottom+12+h<=innerHeight-8,left=Math.max(8,Math.min(r.left,innerWidth-w-8));
  tip.style.left=left+'px';tip.style.top=(below?r.bottom+12:r.top-12-h)+'px';tip.classList.toggle('is-above',!below);
  /* Šípka bubliny mieri na úchyt (pri tlačidle na jeho začiatok). */
  var gr=grip&&!compact,g=gr?grip.getBoundingClientRect():r;tip.style.setProperty('--tip-x',Math.max(12,Math.min((gr?g.left+g.width/2:r.left+22)-left-6,w-24))+'px');
}
/* Sám od seba raz v prehliadači (ak ho kanál nevypol); ikonou kedykoľvek. */
function showTip(asked){
  if(tip||isOpen()||dock.hidden||!asked&&(!LOOK.tip||tipSeen()))return;
  tip=el('div','xw-tip');tip.setAttribute('role','status');
  var th=el('div','xw-tip-head');th.appendChild(tx(el('span','xw-tip-title'),'tipTitle'));
  var tc=el('button','xw-tip-close','\u00d7');tc.type='button';tx(tc,'tipClose','aria-label');tc.addEventListener('click',hideTip);th.appendChild(tc);
  tip.appendChild(th);tip.appendChild(tx(el('p'),'tipBody'));
  /* Pre každú voľbu riadok s ikonou ovládača, ako ho človek uvidí v riadku. */
  if(grip){[[GRIP,'tipMove'],[FOLD,'tipFold']].forEach(function(x){var mv=el('p','xw-tip-move');mv.appendChild(svg(x[0],x[0]===FOLD?16:null));mv.appendChild(tx(el('span'),x[1]));tip.appendChild(mv)})}
  var ta=el('div','xw-tip-actions');var tt=tx(el('button','button button--sm'),'tipTry');tt.type='button';var to=tx(el('button','button button--quiet button--sm'),'tipOk');to.type='button';
  tt.addEventListener('click',function(){hideTip();openPanel()});to.addEventListener('click',hideTip);
  ta.appendChild(tt);ta.appendChild(to);tip.appendChild(ta);
  tip.addEventListener('keydown',function(e){if(e.key==='Escape'){e.preventDefault();hideTip()}});
  root.appendChild(tip);dock.classList.add('is-tip');if(help)help.setAttribute('aria-expanded','true');positionTip();
}
addEventListener('resize',positionTip);

syncScope();syncOwn();
if(grip){var m=null;try{m=localStorage.getItem(MODE)}catch(e){}if(m==='button')setCompact(true,false);restorePos()}
setTimeout(function(){showTip(false)},1000);
})();`
}
