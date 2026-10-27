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
 * **Jazyk** (D290): kanál s viac jazykmi má v hlavičke výber jazyka; mení
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
  ".xw-row-go{display:grid;place-items:center;flex:none;width:36px;height:36px;border-radius:18px;background:var(--accent);color:var(--on-accent)}",
  ".xw-scrim{position:fixed;inset:0;background:rgba(20,28,42,.32);opacity:0;visibility:hidden;transition:opacity .28s ease,visibility .28s}",
  ".xw-scrim.is-open{opacity:1;visibility:visible}",
  ".xw-sheet{display:flex;flex-direction:column;background:var(--surface);border:1px solid var(--line);border-radius:18px;box-shadow:0 18px 48px rgba(20,28,42,.28);overflow:hidden;opacity:0;visibility:hidden;scale:.92;transition:scale .32s cubic-bezier(.2,.8,.2,1),opacity .2s ease,visibility .32s}",
  ".xw-sheet.is-open{opacity:1;visibility:visible;scale:1}",
  ".xw-head{display:flex;align-items:center;flex-wrap:wrap;gap:8px 10px;padding:8px 8px 8px 18px;border-bottom:1px solid var(--line)}",
  ".xw-head-title{flex:1;min-width:0;font-weight:650;font-size:17px;color:var(--ink)}",
  ".xw-close{display:grid;place-items:center;width:44px;height:44px;border:0;border-radius:22px;background:transparent;color:var(--ink);font:inherit;font-size:24px;line-height:1;cursor:pointer}",
  ".xw-close:hover{background:var(--surface-2)}",
  ".xw-lang{min-height:36px;padding:0 10px;border:1px solid var(--line-strong);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;font-size:var(--fs-small);cursor:pointer}",
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
  ".xw-foot{font-size:11px;color:var(--muted);text-align:center}",
  ".xw-q{align-self:flex-end;max-width:85%;padding:10px 14px;border-radius:14px;background:var(--accent);color:var(--on-accent);white-space:pre-wrap;overflow-wrap:anywhere}",
  ".xw-a{padding:14px 16px;border-radius:14px;background:var(--surface);border:1px solid var(--line);line-height:1.55;white-space:pre-wrap;overflow-wrap:anywhere}",
  ".xw-a-head{display:block;margin:0 0 6px;font-size:12.5px;font-weight:600;color:var(--muted);white-space:normal}",
  ".xw-src{margin-top:10px;font-size:13px;color:var(--muted);white-space:normal}",
  ".xw-src ul{margin:4px 0 0;padding-left:18px}",
  ".xw-rate{display:flex;gap:8px;margin-top:12px;white-space:normal}",
  ".xw-sys{align-self:center;max-width:92%;color:var(--muted);font-size:13px;text-align:center}",
  ".xw-sys a{color:var(--accent)}",
  ".xw-card{display:flex;flex-direction:column;gap:10px;padding:14px 16px;border-radius:14px;background:var(--surface);border:1px solid var(--line)}",
  ".xw-card h3{margin:0;font-size:17px;color:var(--ink)}",
  ".xw-card textarea{width:100%;min-height:96px;padding:10px;border:1px solid var(--control-line);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;resize:vertical}",
  ".xw-muted{color:var(--muted);font-size:13px;overflow-wrap:anywhere}",
]

/** Jazyk, ktorý skript pozná: texty, nastavené texty kanála a zdroje v ňom (D290). */
export interface WidgetLanguagePack {
  code: string
  /** Názov jazyka v ňom samom („Čeština") — vo výbere jazyka. */
  label: string
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
}

const MARK = `<svg width="22" height="22" viewBox="0 0 48 48" fill="none" aria-hidden="true"><circle cx="24" cy="20" r="15" stroke="currentColor" stroke-width="6"/><circle cx="17.5" cy="20" r="3.4" fill="currentColor"/><circle cx="30.5" cy="20" r="3.4" fill="currentColor"/><path d="M17 32.5 L24 43 L29 31.5 Z" fill="currentColor"/></svg>`
const ARROW = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 19V5"/><path d="M5 12l7-7 7 7"/></svg>`
const CLOCK = `<svg width="15" height="15" viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="9" cy="9" r="6.6"/><path d="M9 5.4V9l2.4 1.6"/></svg>`
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
      ? `.xw-row{position:fixed;z-index:2147483000;${look.position === "top" ? "top" : "bottom"}:${EDGE}px;left:50%;transform:translateX(-50%);width:min(640px,calc(100vw - 32px))}`
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
  "@media (prefers-reduced-motion:reduce){.xw-sheet,.xw-scrim{transition:none}}",
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
var MARK=${JSON.stringify(MARK)}, ARROW=${JSON.stringify(ARROW)}, CLOCK=${JSON.stringify(CLOCK)}, CROSS=${JSON.stringify(CROSS)};

function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
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
var launcher,rowText=null;
if(ROW){
  launcher=el('button','xw-row');launcher.type='button';
  var rm=el('span','xw-row-mark');rm.appendChild(svg(MARK));rowText=el('span','xw-row-text');
  var go=el('span','xw-row-go');go.appendChild(svg(ARROW));
  launcher.appendChild(rm);launcher.appendChild(rowText);launcher.appendChild(go);
}else{launcher=el('button','fab');launcher.type='button'}
var scrim=el('div','xw-scrim');
var sheet=el('section','xw-sheet');sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');
/* Hlavička: značka, názov, jazyk, zdroje, zavrieť. */
var head=el('div','xw-head');var hm=el('span','xw-row-mark');hm.appendChild(svg(MARK));
head.appendChild(hm);head.appendChild(tx(el('span','xw-head-title'),'title'));
var langSel=null;
if(PACKS.length>1){
  langSel=el('select','xw-lang');tx(langSel,'language','aria-label');
  PACKS.forEach(function(p){var o=el('option',null,p.label);o.value=p.code;o.lang=p.code;langSel.appendChild(o)});
  langSel.value=P.code;head.appendChild(langSel);
}
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
cin.appendChild(moreForm);cin.appendChild(tx(el('div','xw-foot'),'poweredBy'));composer.appendChild(cin);
sheet.appendChild(body);sheet.appendChild(composer);
root.appendChild(launcher);root.appendChild(scrim);root.appendChild(sheet);
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
  syncScope();syncOwn();if(!started)loadHistory(first.input.value);
}
if(langSel)langSel.addEventListener('change',function(){setLanguage(langSel.value)});

/* Otvorenie: plachta vyrastie z miesta zatvoreného widgetu; ten sa medzitým skryje. */
function isOpen(){return sheet.classList.contains('is-open')}
function openPanel(){if(isOpen())return;sheet.classList.add('is-open');scrim.classList.add('is-open');launcher.hidden=true;
  if(!started)loadHistory(first.input.value);
  setTimeout(function(){var t=started?more.input:first.input;t.focus();t.setSelectionRange(t.value.length,t.value.length)},40)}
function closePanel(){sheet.classList.remove('is-open');scrim.classList.remove('is-open');launcher.hidden=false;syncOwn();launcher.focus()}
launcher.addEventListener('click',openPanel);
/* Písanie do zatvoreného riadku ho rozbalí a znak pokračuje v poli. */
launcher.addEventListener('keydown',function(e){if(!ROW||e.ctrlKey||e.metaKey||e.altKey||e.key.length!==1||e.key===' ')return;e.preventDefault();first.input.value+=e.key;openPanel();onFirstInput()});
close.addEventListener('click',closePanel);
scrim.addEventListener('click',closePanel);
sheet.addEventListener('keydown',function(e){if(e.key==='Escape'&&isOpen()){e.preventDefault();closePanel()}});
/* Odkazy „Pomoc" v cudzom systéme (D285): \`onclick="return !(window.ContineoHelpdesk&&ContineoHelpdesk.open())"\`
   pri \`href="mailto:…"\` — bez skriptu ostane e-mail. */
window.ContineoHelpdesk={open:function(){openPanel();return true}};

function scrollEnd(){body.scrollTop=body.scrollHeight}
function sys(text){var m=el('div','xw-sys',text);log.appendChild(m);scrollEnd();return m}
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
    start();log.appendChild(el('div','xw-q',j.question));var a=answerBox();a.body.textContent=j.answer;lastQuestion=j.question;
    showSources(a.box,j.sources||[]);conversation.push({recordId:id,question:j.question,verdict:null});rateButtons(id,a.box);syncOffer();scrollEnd();
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

function answerBox(){var a=el('div','xw-a');var h=el('span','xw-a-head');h.hidden=true;var b=el('div');a.appendChild(h);a.appendChild(b);log.appendChild(a);return {box:a,head:h,body:b}}
function showSources(box,sources){if(!sources.length)return;var s=el('div','xw-src',T.sources);var ul=el('ul');var seen={};
  sources.forEach(function(x){var k=(x.title||'')+'|'+(x.articleRef||'');if(seen[k])return;seen[k]=1;ul.appendChild(el('li',null,(x.title||'')+(x.articleRef?' ('+x.articleRef+')':'')))});s.appendChild(ul);box.appendChild(s)}
function rateButtons(recordId,answerEl){
  var rate=el('div','xw-rate');var up=el('button','button button--quiet button--sm',T.helpful);up.type='button';var down=el('button','button button--quiet button--sm',T.notHelpful);down.type='button';
  function pick(v){up.disabled=down.disabled=true;(v===1?up:down).setAttribute('aria-pressed','true');
    conversation.forEach(function(c){if(c.recordId===recordId)c.verdict=v});
    api('feedback',{id:recordId,verdict:v}).catch(function(){});
    if(v===0){negatives++;if(negatives>=LOOK.escalateAfter){sys(T.tryAgain);offerEscalation(false)}}else{sys(T.thanks)}}
  up.addEventListener('click',function(){pick(1)});down.addEventListener('click',function(){pick(0)});
  rate.appendChild(up);rate.appendChild(down);answerEl.appendChild(rate);
}

function ask(q){
  busy=true;firstSend.disabled=moreSend.disabled=true;if(scopeBtn)scopeBtn.disabled=true;lastQuestion=q;
  if(last.note){last.note.remove();last.note=null}
  log.appendChild(el('div','xw-q',q));
  var A=answerBox();var ran=null;
  var thinking=sys(T.thinking);
  var text='',sources=[],recordId=null;
  api('chat',{query:q,language:P.code,sources:on.slice()}).then(function(r){
    if(!r.ok||!r.body){throw new Error(r.status===429?'rate':'http')}
    var reader=r.body.getReader(),dec=new TextDecoder(),buf='';
    function pump(){return reader.read().then(function(res){
      if(res.done)return;
      buf+=dec.decode(res.value,{stream:true});
      var parts=buf.split('\\n\\n');buf=parts.pop()||'';
      parts.forEach(function(p){var line=p.split('\\n').filter(function(l){return l.indexOf('data: ')===0})[0];if(!line)return;var ev;try{ev=JSON.parse(line.slice(6))}catch(e){return}
        if(ev.type==='scope'){ran=ev;A.head.textContent=ev.kicker||'';A.head.hidden=!ev.kicker}
        else if(ev.type==='token'){text+=ev.token;A.body.textContent=text;thinking.remove();scrollEnd()}
        else if(ev.type==='done'){sources=ev.sources||[]}
        else if(ev.type==='recorded'){recordId=ev.id}
        else if(ev.type==='error'){text=text||T.error;A.body.textContent=text}
      });
      return pump();
    })}
    return pump();
  }).then(function(){
    thinking.remove();
    if(!text.trim()||!sources.length){A.body.textContent=T.noAnswer;negatives++;conversation.push({recordId:null,question:q,verdict:0});if(negatives>=LOOK.escalateAfter)offerEscalation(false);return}
    showSources(A.box,sources);
    conversation.push({recordId:recordId,question:q,verdict:null});
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
  api('ticket',{message:m,language:P.code,page:location.href.split('#')[0],conversation:conversation.map(function(c){return {recordId:c.recordId,question:c.question,verdict:c.verdict}})}).then(function(r){if(!r.ok)throw new Error('http');esc.hidden=true;escTa.value='';sys(T.escalated);negatives=0;syncOffer()}).catch(function(e){sys(e&&e.message==='expired'?T.expired:T.error);contact()}).then(function(){escBtn.disabled=false})});

syncScope();syncOwn();
})();`
}
