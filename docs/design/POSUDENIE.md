# POSUDENIE.md — Na posúdenie (`/evaluation`) a Moje potvrdenia (`/acknowledgements`)

Dve obrazovky, ktoré spolu nesúvisia témou, ale majú spoločný tvar:
**zoznam záznamov, ktoré sa nedajú prepísať.**

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `HR.html` (časť 4–5).

---

## 1. Na posúdenie (`/evaluation`)

Fronta hodnotiteľa — odpovede, pri ktorých niekto povedal, že nesedia.
Odtiaľ sa pripravuje kurácia (`/library/curation`).

### Hotové
Zoznam nahlásených odpovedí s dôvodom, rozbaľovacie zdroje, formulár na
prípravu kurovaného páru (otázka, odpoveď, výber zdrojových úsekov),
šírka 860 px.

### Úloha 1.1 — Dva zoznamy na jednej obrazovke sa nerozlišujú
**Teraz:** hore „nahlásené odpovede", dole „pripraviť kuráciu" — obe ako
`.card` v tom istom rytme. Nadpis druhej sekcie je `<h2>` s
`var(--fs-section)`, ale medzi kartami zaniká.

**Má byť:** druhá sekcia oddelená čiarou a s úvodným odsekom, ktorý povie
**prečo sú tu dve** — prvá je „čo nesedí", druhá „čo z toho spraviť".

```css
.eval-split { margin: 32px 0 0; padding-top: 28px; border-top: 1px solid var(--line); }
```

### Úloha 1.2 — Pilulka „nahlásené" cez variant
`<span className="tag" style={{ background: "var(--bad-bg)", … }}>` —
inline prepis. Použi `.tag--expired` (červená) pre nahlásené a `.tag`
neutrálnu pre „posúdené".

**Nie `--bad` pre všetko.** Nahlásenie nie je porucha systému, je to
spätná väzba — červená patrí len tam, kde odpoveď bola vecne zlá.

### Úloha 1.3 — Prázdny stav
`.empty`: **„Nič nečaká na posúdenie"** / „Keď niekto pri odpovedi
povie, že nesedí, objaví sa tu aj s jeho dôvodom a zdrojmi, z ktorých
odpoveď vychádzala."

---

## 2. Moje potvrdenia (`/acknowledgements`)

Osobný výpis: čo som potvrdil, kedy a čím. **Je to dôkaz pre človeka
samotného**, nie pre HR.

### Hotové
Zoznam záznamov s formulkou, dátumom a verziou, export cez
`/api/acknowledgements/export`, šírka 820 px.

### Úloha 2.1 — Formulka je dôkaz, nie poznámka pod čiarou
**Teraz:** formulka je v `.quiet` `var(--fs-small)` pod dátumom — teda
najmenším písmom na karte.

**Má byť:** `var(--fs-body)` v `--ink`, v bloku s ľavým okrajom:

```css
.ack-formula {
  margin: 10px 0 0;
  padding: 10px 12px;
  border-left: 3px solid var(--line);
  font-size: var(--fs-body);
  line-height: 1.6;
}
```

Je to **doslovné znenie, ktoré sa uložilo** (D28) a nikdy sa spätne
nemení — preto má na karte najväčšiu váhu po názve dokumentu.

### Úloha 2.2 — Odvolané potvrdenie sa nemaže, ale musí byť vidieť
`revoke()` existuje (2026-09-12). Odvolaný záznam v zozname **zostáva** —
kolekcia je append-only (D24).

```css
.ack-record.is-revoked { opacity: .75; }
```

+ pilulka `.tag--archived` „Odvolané" a riadok „Odvolal personalista
12. 9. 2026 · dôvod: …". **Neškrtaj text** — prečiarknutá formulka by
vyzerala, že sa dá zmeniť.

### Úloha 2.3 — Prázdny stav
`.empty`: **„Zatiaľ ste nič nepotvrdili"** / „Keď potvrdíte prečítanie
normy, objaví sa tu záznam s presným znením, ktoré ste videli."

### Úloha 2.4 — Export patrí k obsahu, nie nad neho
Tlačidlo „Stiahnuť" je dnes nad zoznamom vedľa počtu. Nechaj ho tam —
**ale doplň, čo obsahuje**: „Stiahnuť (CSV, 12 záznamov)". Export, ktorý
nepovie, čo vyváža, sa sťahuje dvakrát.

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Kde | Údaj | Stav |
| --- | --- | --- |
| `/evaluation` | kto odpoveď nahlásil | ⚠️ v zázname je, na obrazovke nie — 🔴 rozhodnúť, či sa ukazuje (súkromie hodnotiteľa) |
| `/acknowledgements` | oprava vlastného potvrdenia | ❌ cesta neexistuje (`TODO.md`) |
| `/acknowledgements` | čas čítania pri zázname | ⚠️ `reading_times` existujú, ale sú **iná kolekcia** — spájať ich s dôkazom je rozhodnutie, nie prílepok |

🔴 Zmena schémy: **netreba žiadnu.**
