#!/usr/bin/env node
/**
 * export-artifact.mjs — design system Contineo ako artefakt v Claude
 * (typ „Design System", https://claude.ai/artifact/AGZnHYA4nCDzqsXZvw7Lzh).
 *
 * Prečo: samostatný Claude Design končí 14. 12. 2026 a `/design-sync` zatiaľ
 * zapisuje len do jeho projektov. Ján 24. 10. 2026 rozhodol prekladať ten
 * istý overený build (`ds-bundle/` z `/design-sync`) do formátu artefaktu
 * a publikovať ho nástrojom Artifact (docs/DESIGN.md, „Design system
 * v Claude"). Keď oficiálny `/design-sync` začne artefakty podporovať,
 * tento skript zanikne.
 *
 * Nič nepublikuje — len zapíše súbory do `--out/project/…` a vypíše JSON
 * s mapou súborov a cestami na zmazanie, ktoré sa podajú nástroju Artifact.
 *
 *   node .design-sync/export-artifact.mjs --bundle ds-bundle \
 *     --out .design-sync/.cache/artifact --sha <short sha> --by "Ján Letko" \
 *     [--published .design-sync/.cache/artifact-published.txt]
 *
 * `--published` je zoznam ciest, ktoré artefakt dnes má (jedna na riadok,
 * s `project/`); čo z nich export nevyrobí, ide na zmazanie (`null`).
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync } from "node:fs"
import { dirname, join } from "node:path"

const args = Object.fromEntries(process.argv.slice(2).reduce((acc, a, i, all) => {
  if (a.startsWith("--")) acc.push([a.slice(2), all[i + 1] && !all[i + 1].startsWith("--") ? all[i + 1] : "1"])
  return acc
}, []))
const BUNDLE = args.bundle ?? "ds-bundle"
const OUT = args.out ?? ".design-sync/.cache/artifact"
const CSS = args.css ?? "app/src/app/globals.css"
const CONVENTIONS = args.conventions ?? ".design-sync/conventions.md"
const SHA = args.sha ?? "unknown"
const BY = args.by ?? "Ján Letko"
const NAMESPACE = "Contineo"
const TITLE = "Contineo — design system"

const written = []
function put(path, content) {
  const full = join(OUT, "project", path)
  mkdirSync(dirname(full), { recursive: true })
  writeFileSync(full, content)
  written.push(`project/${path}`)
}
const read = p => readFileSync(p, "utf8")

/* ── Tokeny z globals.css: svetlá téma je `:root`, tmavá `html[data-theme="dark"]` ── */

const css = read(CSS)
const rootBlock = css.slice(css.indexOf(":root {"), css.indexOf('html[data-theme="dark"] {'))
const darkStart = css.indexOf('html[data-theme="dark"] {')
const darkBlock = css.slice(darkStart, css.indexOf("\n}", darkStart))
const vars = block => Object.fromEntries([...block.matchAll(/\n\s*(--[\w-]+):\s*([^;]+);/g)].map(m => [m[1].slice(2), m[2].trim().replace(/\s+/g, " ")]))
const light = vars(rootBlock)
const dark = vars(darkBlock)

/** Kde sa token používa — poznámka pri každom (craft.md). */
const USAGE = {
  bg: "Pozadie stránky pod kartami.",
  surface: "Karta, plachta, tiché tlačidlo; text `ink` na nej.",
  "surface-2": "Hover riadku a tichého tlačidla, podklad značky v hláške.",
  ink: "Text na `surface` a `bg`.",
  muted: "Tlmený text (`.quiet`, podnadpisy riadkov, nápovedy) na `surface` a `bg`.",
  line: "Okraj karty a oddeľovač riadkov.",
  "line-strong": "Okraj tichého tlačidla a ovládačov.",
  "tv-bar": "Priesvitná lišta podmenu (`TabsBar`).",
  "seg-track": "Dráha prepínača pohľadu `.view-switch`.",
  "seg-thumb": "Zvolená voľba prepínača pohľadu.",
  "seg-sep": "Oddeľovač medzi voľbami prepínača pohľadu.",
  "control-line": "Okraj poľa a krúžku výberu (`.select-row`).",
  "toggle-off": "Vypnutý prepínač `.toggle`.",
  "toggle-knob": "Gombík prepínača `.toggle`.",
  accent: "Farba organizácie — plné tlačidlo, podmenu, zvolený riadok. Na obale stránky ju prepíše `tenantStyle`.",
  "accent-strong": "Hover plného tlačidla.",
  "on-accent": "Text na `accent` (plné tlačidlo).",
  "accent-soft": "Jemný podklad zvoleného prvku vo farbe organizácie.",
  "teal-50": "Starý odtieň stupnice (historický názov), podklad.",
  "teal-100": "Starý odtieň stupnice (historický názov), podklad.",
  "teal-500": "Starý odtieň stupnice (historický názov), text.",
  "teal-600": "Starý odtieň stupnice (historický názov), rovnaký ako `accent`.",
  "teal-700": "Starý odtieň stupnice (historický názov), rovnaký ako `accent-strong`.",
  "ok-bg": "Podklad hlášky a štítku „v poriadku“ (`.lnote`, `.tag--published`).",
  "ok-fg": "Text hlášky a štítku „v poriadku“ na `ok-bg`.",
  "bad-bg": "Podklad chyby (`.lnote--bad`).",
  "bad-fg": "Text chyby a nevratnej akcie (`.button--danger`) na `bad-bg` aj `surface`.",
  "warn-bg": "Podklad upozornenia (`.lnote--warn`, `.tag--draft`).",
  "warn-fg": "Text upozornenia na `warn-bg`.",
  radius: "Karta, plachta, väčšie plochy.",
  "radius-lg": "Veľké plochy a plachty.",
  shadow: "Tieň karty a popoveru.",
  "tv-shadow": "Tieň lišty podmenu.",
  "seg-shadow": "Tieň zvolenej voľby prepínača pohľadu.",
  "pad-main": "Okraj obsahu stránky.",
  "card-pad": "Vnútorný okraj karty.",
  "list-py": "Zvislé odsadenie riadku zoznamu.",
  gap: "Medzera medzi kartami a blokmi.",
  "row-py": "Zvislé odsadenie riadku tabuľky.",
  "control-h": "Výška poľa a tlačidla (pod 640 px terč 44 px).",
  "control-h-sm": "Výška malého tlačidla `.button--sm`.",
  maxw: "Šírka textovej stránky.",
  "shell-maxw": "Šírka obsahu v ráme aplikácie.",
  "shell-maxw-wide": "Šírka širokej stránky (Knižnica — tabuľka).",
}
const usage = name => USAGE[name] ?? "Token z `globals.css`."

const isColor = v => /^#[0-9a-f]{3,8}$/i.test(v) || /^rgba?\(/i.test(v)
const isShadow = v => /\d+px/.test(v) && /rgba?\(/.test(v) && !isColor(v)
const colorTokens = []
const shadowTokens = []
const spacing = []
const radius = []
const layout = []
const typeStyles = []
for (const [name, value] of Object.entries(light)) {
  const d = dark[name]
  if (isColor(value)) colorTokens.push({ name, value: d && d !== value ? { light: value.toLowerCase(), dark: d.toLowerCase() } : value.toLowerCase(), usage: usage(name) })
  else if (isShadow(value)) shadowTokens.push({ name, value: d && d !== value ? { light: value, dark: d } : value, usage: usage(name) })
  else if (/^radius/.test(name)) radius.push({ name, value, usage: usage(name) })
  else if (/maxw/.test(name)) layout.push({ name, value, usage: usage(name) })
  else if (/^(fs-|font-row)/.test(name)) typeStyles.push({ name, value })
  else if (/^-?\d/.test(value)) spacing.push({ name, value, usage: usage(name) })
}
const FONT_STACK = 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif'
const TYPE_USAGE = {
  "fs-title": ["Nadpis stránky `.page-title`.", 700], "fs-section": ["Nadpis sekcie a plachty.", 650],
  "fs-lead": ["Úvodný odsek `.page-lead`.", 400], "fs-body": ["Bežný text.", 400], "fs-small": ["Malý text, malé tlačidlo.", 400],
  "fs-micro": ["Drobné popisy, nadpisy skupín.", 400], "fs-label": ["Popis poľa `.field-label`.", 600],
  "fs-control": ["Text v poli a tlačidle (16 px na telefóne, 15 px od 640).", 400], "font-row": ["Text riadku tabuľky.", 400],
}
const tokens = {
  name: TITLE,
  version: 1,
  meta: { source: "github", repo: "ltksolutions/contineo", ref: `main@${SHA}`, package: "app", paths: { tokens: [CSS] }, synced: new Date().toISOString().slice(0, 10) },
  color: { themes: [{ id: "light", name: "Svetlá" }, { id: "dark", name: "Tmavá" }], tokens: colorTokens },
  type: {
    fonts: [],
    families: { sans: FONT_STACK },
    groups: [{ name: "Text", family: "sans", styles: typeStyles.map(s => ({ name: s.name, fontSize: s.value, fontWeight: TYPE_USAGE[s.name]?.[1] ?? 400, lineHeight: 1.5, usage: TYPE_USAGE[s.name]?.[0] ?? "Veľkosť písma." })) }],
  },
  spacing: { tokens: spacing },
  radius: { tokens: radius },
  shadow: { tokens: shadowTokens },
  layout: { note: "Šírky obsahu.", tokens: layout },
}
put("tokens.json", JSON.stringify(tokens, null, 2) + "\n")

// tokens.css — synchronizovaný systém si ho píše pri každom behu (craft.md: One source).
const val = (t, theme) => (typeof t.value === "string" ? t.value : t.value[theme] ?? t.value.light)
let tcss = `/* ${TITLE} — generated from tokens.json */\n:root, [data-theme="light"] {\n`
for (const t of [...colorTokens, ...shadowTokens]) tcss += `  --${t.name}: ${val(t, "light")};\n`
tcss += `}\n[data-theme="dark"] {\n`
for (const t of [...colorTokens, ...shadowTokens]) if (typeof t.value !== "string") tcss += `  --${t.name}: ${t.value.dark};\n`
tcss += `}\n:root {\n`
for (const t of [...spacing, ...radius, ...layout]) tcss += `  --${t.name}: ${t.value};\n`
tcss += `  --font-sans: ${FONT_STACK};\n}\n`
for (const s of tokens.type.groups[0].styles) tcss += `.${s.name} { font-family: var(--font-sans); font-size: ${s.fontSize}; font-weight: ${s.fontWeight}; line-height: ${s.lineHeight}; }\n`
put("tokens.css", tcss)

/* ── Brand book: conventions.md bez nadpisu (stránka nesie názov systému) ── */

const conventions = read(CONVENTIONS).replace(/^# [^\n]*\n+/, "")
put("README.md", conventions.trimEnd() + "\n")

/* ── Komponenty z ds-bundle ── */

const compRoot = join(BUNDLE, "components")
const comps = []
for (const group of readdirSync(compRoot)) {
  for (const name of readdirSync(join(compRoot, group))) comps.push({ group, name, dir: join(compRoot, group, name) })
}
comps.sort((a, b) => a.name.localeCompare(b.name))

// Balík: hlavička vo formáte 4, inak bez zmeny (číta window.React / ReactDOM).
let bundle = read(join(BUNDLE, "_ds_bundle.js"))
bundle = bundle.replace(/^\/\* @ds-bundle: .*?\*\/\n?/, "")
const header = { format: 4, namespace: NAMESPACE, components: comps.map(c => ({ name: c.name })) }
bundle = `/* @ds-bundle: ${JSON.stringify(header)} */\n` + bundle
for (const [label, text] of [["bundle.js", bundle]]) {
  if (/<\/script|<!--/i.test(text)) throw new Error(`${label}: obsahuje </script alebo <!-- — artefakt by ho nevedel vložiť`)
}
put("components/bundle.js", bundle)
const bundleCss = read(join(BUNDLE, "_ds_bundle.css"))
if (/<\/style/i.test(bundleCss)) throw new Error("bundle.css: obsahuje </style")
put("components/bundle.css", bundleCss)

// React 19 z aplikácie (useFormStatus v SubmitButton) — nie 18 z jsDelivr.
const reactJs = read(join(BUNDLE, "_vendor/react.js"))
if (/<\/script|<!--/i.test(reactJs)) throw new Error("react.js: obsahuje </script alebo <!--")
put("components/lib/react.js", reactJs)
put("components/lib/react-dom.js", "/* ReactDOM je v react.js (window.ReactDOM) — súbor je tu, lebo typ chce oba alebo žiadny. */\n")
const reactVersion = JSON.parse(read("app/node_modules/react/package.json")).version

// Typy: jeden index.d.ts pre karty api/, plus súbor pri každom komponente.
let dts = "import * as React from 'react';\n"
for (const c of comps) {
  const d = read(join(c.dir, `${c.name}.d.ts`))
  put(`components/${c.name}/${c.name}.d.ts`, d)
  dts += "\n" + d.replace(/^import \* as React from 'react';\n/m, "")
}
put("components/index.d.ts", dts)

const PREVIEW_STYLE = `body{margin:0;padding:16px;background:var(--surface);color:var(--ink);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.ds-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:16px;align-items:start}
.ds-cell{border:1px solid var(--line);border-radius:8px;padding:12px;min-width:0;overflow:hidden}
.ds-cell>h4{margin:0 0 8px;font:600 12px ui-sans-serif,system-ui;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}`
const MOUNT = `
;(function(){var h=React.createElement,g=document.getElementById('g'),P=window.__dsPreview||{};
Object.keys(P).filter(function(k){return typeof P[k]==='function'&&/^[A-Z]/.test(k)}).forEach(function(k){
var c=document.createElement('div');c.className='ds-cell';var t=document.createElement('h4');t.textContent=k;var r=document.createElement('div');
c.appendChild(t);c.appendChild(r);g.appendChild(c);try{ReactDOM.createRoot(r).render(h(P[k]))}catch(e){r.textContent='⚠ '+(e&&e.message||e)}})})();
`
const heights = (() => { try { return Object.fromEntries(JSON.parse(read(join(BUNDLE, ".render-check.json"))).map(x => [x.name, x.maxHeight])) } catch { return {} } })()
for (const c of comps) {
  const prompt = read(join(c.dir, `${c.name}.prompt.md`))
  // Prvý riadok prompt.md je technická veta o balíku; README začína opisom.
  const readme = prompt.replace(/^[^\n]*Use via `window\.[^\n]*\n+/, "").trim()
  put(`components/${c.name}/README.md`, `${readme || c.name}\n`)
  const pv = join(BUNDLE, "_preview", `${c.name}.js`)
  if (existsSync(pv)) {
    const js = read(pv) + MOUNT
    if (/<\/script|<!--/i.test(js)) throw new Error(`${c.name} preview: obsahuje </script alebo <!--`)
    put(`components/${c.name}/preview.js`, js)
    const h = Math.max(120, Math.min(800, Math.round((heights[c.name] ?? 160) + 40)))
    put(`components/${c.name}/preview.html`, `<!-- @dsCard group="Komponenty" height=${h} -->\n<!doctype html>\n<html><head><meta charset="utf-8"><style>${PREVIEW_STYLE}</style></head>\n<body><div class="ds-grid" id="g"></div><script src="./preview.js"></script></body></html>\n`)
  }
}

/* ── Obálka (cover.md): pás dlaždíc navrchu, názov pod ním. Triedy s prefixom `cover-`,
   lebo bundle.css (globals.css) má `.tag` a rámec ho načíta pred obálkou. ── */
put("components/Cover/preview.html", `<!-- @dsCard height=300 -->
<!doctype html>
<html><head><meta charset="utf-8"><style>
body{margin:0;background:var(--bg);font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif}
.cover{position:relative;width:960px;height:300px;overflow:hidden}
svg{position:absolute;left:0;top:0}
.accent{fill:var(--accent)}.ink{fill:var(--ink)}.surface2{fill:var(--surface-2)}.ok{fill:var(--ok-fg)}.warn{fill:var(--warn-fg)}.surface{fill:var(--surface)}
.line{stroke:var(--line-strong);stroke-width:1;fill:none}
.cover-text{position:absolute;left:32px;top:136px;max-width:860px}
.cover-name{margin:0;font-size:64px;line-height:.95;font-weight:700;letter-spacing:-.02em;color:var(--ink)}
.cover-tagline{margin:12px 0 0;font-size:14px;color:var(--muted)}
</style></head><body><div class="cover">
<svg width="960" height="112" viewBox="0 0 960 112" aria-hidden="true">
<!-- Odvodenie:
     bloky: accent (graphite, veľký pás), ink, surface-2 (svetlý odtieň), ok-fg a warn-fg malé — farby stavov len ako signál;
     usporiadanie: horný pás (skeleton top-band), lebo názov „Contineo — design system“ sa do 440 px nezmestí;
     vzor: „geometric, modular, dense UI → tiles cut by the radius tokens, some merged two-wide“ — Contineo sú karty a riadky zoznamu (List, 44 px);
     kroky a polomery: dlaždice 44 px (terč), medzera gap 14 → 12, polomer radius 12, pás 112 px. -->
<rect class="accent" x="0" y="0" width="372" height="112"/>
<rect class="ink" x="384" y="0" width="100" height="44" rx="12"/>
<rect class="surface2" x="496" y="0" width="212" height="44" rx="12"/>
<rect class="surface2" x="720" y="0" width="100" height="44" rx="12"/>
<rect class="accent" x="832" y="0" width="128" height="44" rx="12"/>
<rect class="surface2" x="384" y="56" width="212" height="44" rx="12"/>
<rect class="ok" x="608" y="56" width="44" height="44" rx="12"/>
<rect class="surface2" x="664" y="56" width="156" height="44" rx="12"/>
<rect class="warn" x="832" y="56" width="44" height="44" rx="12"/>
<rect class="ink" x="888" y="56" width="72" height="44" rx="12"/>
<line class="line" x1="0" y1="111.5" x2="960" y2="111.5"/>
</svg>
<div class="cover-text"><p class="cover-name">Contineo —<br>design system</p><p class="cover-tagline">Triedy a tokeny intranetu Contineo. Vzor Apple HIG, farba organizácie.</p></div>
</div></body></html>
`)

/* ── Index ── */
const index = {
  v: 3,
  layout: "files",
  createdOnFiles: { at: "2026-10-15T21:45:05.414Z", v: 1 },
  title: TITLE,
  namespace: NAMESPACE,
  editing: "code",
  libraries: [
    { name: "react", version: reactVersion, global: "React", file: "components/lib/react.js" },
    { name: "react-dom", version: reactVersion, global: "ReactDOM", file: "components/lib/react-dom.js" },
  ],
  sections: {},
  groups: [],
  assetGroups: {},
  blobs: {},
  docs: { readme: "project/README.md", sections: [] },
  lastChange: { by: BY, at: new Date().toISOString(), via: `Claude Code · ltksolutions/contineo@${SHA}`, note: "synchronizované z kódu (/design-sync + export-artifact.mjs)" },
}
put("design-system.json", JSON.stringify(index, null, 2) + "\n")

/* ── Výstup pre nástroj Artifact ── */
const published = args.published && existsSync(args.published)
  ? read(args.published).split("\n").map(s => s.trim()).filter(p => p.startsWith("project/")) : []
// Starý manifest.json sa maže, nie prepisuje (craft.md: No stale manifest) — stránka si ho vyrobí;
// karty api/ generuje stránka a nechávajú sa.
const deletes = published.filter(p => !written.includes(p) && !p.startsWith("project/api/"))
writeFileSync(join(OUT, "publish.json"), JSON.stringify({ files: written, deletes }, null, 2))
console.log(JSON.stringify({ files: written.length, deletes: deletes.length, out: OUT }))
