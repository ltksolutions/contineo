# Contineo — ako stavať obrazovky

Contineo je intranet organizácie (predpisy, potvrdenia, vzdelávanie). Vzhľad nesú
**triedy a tokeny z `styles.css`** (globals.css aplikácie); komponenty z `window.Contineo`
sú len doplnok. Texty sú po slovensky.

## Nastavenie
- Bez providera. Téma: `<html data-theme="light|dark">` — tokeny sa prepnú samy.
- Farba organizácie: prepíš `--accent` (a `--accent-soft`, `--on-accent`) na obale stránky;
  nikdy systémová modrá.

## Tokeny (`var(--…)`)
- Plochy: `--bg` (stránka), `--surface` (karta), `--surface-2` (hover), `--line`, `--line-strong`.
- Text: `--ink`, `--muted`; stavy `--ok-fg/--ok-bg`, `--warn-fg/--warn-bg`, `--bad-fg/--bad-bg`.
- Písmo: `--fs-title` (26), `--fs-section` (17), `--fs-lead` (15), `--fs-body` (14),
  `--fs-small` (13), `--fs-micro` (12). Rozmery: `--radius` (12), `--gap`, `--card-pad`,
  `--control-h` (40), `--control-h-sm` (36).

## Pravidlo ovládačov (vzor Apple HIG / SwiftUI)
| Čo | Prvok |
|---|---|
| kam idem (časti sekcie) | `<nav class="tabs"><TabsBar><a class="tab is-active">…</a>…</TabsBar></nav>` |
| ako to vidím (pohľad) | `<nav class="view-switch"><a class="view-switch-item is-on">…</a>…</nav>` — sivý, bez farby |
| čo urobím | `.button` — **najviac jedno plné**, vpravo v `.page-head`; ostatné `.button button--quiet` |
| odkiaľ som prišiel | cesta pod hlavičkou; **nikdy „← Späť…"** |

## Triedy
- Stránka: `.page-head` (riadok nadpisu, `flex-wrap`) s `.page-title`, `.page-head-spacer`,
  akcie; pod ním `p.quiet.page-lead`.
- Obsah: `.card`; prázdny stav `.empty` > `.empty-title`, `.empty-text`, `.empty-action`.
- Formulár: `label.field` > `.field-label`, `.field-input`, `.field-hint`; nastavenia
  `.set-form` > `section.set-sec`.
- Štítky: `.tag`, `.tag--draft` (upozornenie); tlmený text `.quiet`.
- Hľadanie v zozname: komponent `SearchStrip` vo `<form method="get">`.
- Na telefóne terč aspoň 44 px; zoznamy pod 1024 px ako karty, od 1024 px tabuľka.

## Príklad
```jsx
<div>
  <div className="page-head">
    <h1 className="page-title">Pridelené dokumenty</h1>
    <span className="page-head-spacer" />
    <a className="button" href="/hr/assign">Prideliť dokument</a>
  </div>
  <nav className="tabs"><Contineo.TabsBar>
    <a className="tab is-active" href="/hr">Pridelenia</a>
    <a className="tab" href="/hr/overview">Výkaz potvrdení</a>
  </Contineo.TabsBar></nav>
  <p className="quiet page-lead">Čo bolo komu uložené a kto to už potvrdil.</p>
  <div className="empty">
    <div className="empty-title">Zatiaľ nič nepridelené</div>
    <div className="empty-text">Dokument pridelíte tlačidlom vpravo hore.</div>
  </div>
</div>
```
