# OSOBY.md — Osoby a ich karty (`/people` + 4 podstránky)

**Správa ľudí: kto do organizácie patrí, aké má role a či je stále vnútri.**
Od toho závisí, komu vznikajú povinnosti — takže vylúčenie osoby má dôsledky
v celom systéme.

Základ: `ZAKLAD.md` (PR 0). Statická referencia: `PEOPLE.html`.

---

## Rozcestník

| Routa | Čo robí | Šírka |
| --- | --- | --- |
| `/people` | zoznam osôb s hľadaním | 880 |
| `/people/[id]` | karta osoby — údaje, role, vylúčenie, dôkazy | 680 |
| `/people/new` | pridať jednu osobu a pozvať ju | 560 |
| `/people/invite` | rozposlať pozvánky tým, čo ešte neprišli | 720 |
| `/people/import` | import z CSV | 680 |

`/people` **nie je `/directory`.** Adresár je pre všetkých a len sa v ňom
hľadá; Osoby sú správa s právami. Nezjednocuj ich (`MASTER.md`).

---

## Čo je UŽ HOTOVÉ — nerob znova

| Obrazovka | Hotové |
| --- | --- |
| `/people` | hľadanie cez `LiveFilter` (bez JS funguje ako formulár), karty osôb, role ako pilulky, počet výsledkov |
| `/people/[id]` | celý formulár údajov, `.field-row` dvojice, role cez `.hr-choice`, skupiny a trasy, opätovné pozvanie, vylúčenie s **povinným prepísaním slova**, výpis dôkazov |
| `/people/new` | formulár + pozvanie jedným krokom, `.field-row`, predvyplnenie z adresy po chybe |
| `/people/invite` | zoznam nepozvaných, náhľad pred odoslaním, počet v tlačidle |
| `/people/import` | nahranie CSV, popis očakávaných stĺpcov |

**Vylúčenie osoby s potvrdzovacím slovom neprepisuj na obyčajné tlačidlo.**
Je to nevratná akcia s dopadom na pridelenia — preto to trvá dlhšie.

---

## Úloha 1 — Stav osoby nesie farbu, dnes je všetko sivé

**Teraz** na `/people`:

```tsx
<span className="tag" style={{ … }}>{stateLabel}</span>
{roles.map(r => <span key={r} className="tag">{r}</span>)}
```

Stav („aktívna", „pozvaná", „vylúčená") a role vyzerajú rovnako — pritom
prvé je stav a druhé sú vlastnosti. V zozname 210 ľudí sa nedá prebehnúť
očami, kto ešte nenastúpil.

**Má byť** — stav z variantov `ZAKLAD.md`, role zostávajú neutrálne:

| Stav | Trieda |
| --- | --- |
| Aktívna | `.tag--published` |
| Pozvaná, neprihlásená | `.tag--review` |
| Vylúčená | `.tag--archived` |
| Bez konta (len v adresári) | `.tag` neutrálna |

Role (`hr`, `admin`, `curator`) **zostávajú `.tag`** — je ich na osobe
viac a farebné by prebili stav.

Napíš `personTagClass(person)` a volaj ju z `/people` aj `/people/[id]`.

## Úloha 2 — Vylúčená osoba sa v zozname nemá schovávať, ale ani prekrikovať

**Teraz:** vylúčená osoba je v zozname rovnako výrazná ako aktívna.

**Má byť:** karta dostane `opacity: .75` — to isté, čo odvolané potvrdenie
v `/acknowledgements` (`POSUDENIE.md`, úloha 2.2). Rovnaký význam,
rovnaký prostriedok.

```css
.person-card.is-excluded { opacity: .75; }
```

**Neodstraňuj ju z filtra.** Vylúčená osoba musí byť dohľadateľná — jej
dôkazy o potvrdeniach zostávajú platné (D24) a niekto sa na ne bude
pýtať.

## Úloha 3 — `/people/[id]`: sedem kariet v jednom stĺpci (rovnako ako detail dokumentu)

**Teraz:** pod formulárom údajov stoja `.card` bloky — opätovné pozvanie,
vylúčenie/vrátenie, dôkazy — každý s `marginTop: 16` a rovnakou váhou.

**Má byť** ten istý vzor ako v `DETAIL.md` (úloha 1):

1. **Hlavička** — meno, e-mail, stav
2. **Formulár údajov** — hlavná práca, ostáva hore
3. **`<details>` „Prístup a členstvo"** — opätovné pozvanie, vylúčenie
4. **Dôkazy** — dole, ako referencia

Použi `.detail-tools` zo `DETAIL.md` (tá istá trieda, tá istá logika).
Vylúčenie schované v `<details>` je **správne**: je to vzácna a nevratná
akcia, nie súčasť úpravy telefónneho čísla.

## Úloha 4 — Prázdne stavy

| Obrazovka | Nadpis | Text |
| --- | --- | --- |
| `/people` bez filtra | Zatiaľ žiadne osoby | Prvú pridáte tlačidlom vyššie, alebo naraz importom z CSV. |
| `/people` s filtrom | Filtru nič nevyhovuje | Skúste časť mena alebo e-mailu. *(+ „Zrušiť filter")* |
| `/people/invite` | Všetci sú pozvaní | Nikto nečaká na pozvánku. |
| `/people/[id]` dôkazy | Žiadne pridelené normy | Tejto osobe zatiaľ nikto nepridelil normu na potvrdenie. |

## Úloha 5 — `/people/import`: povedz, čo sa stane s existujúcimi

**Teraz:** obrazovka popíše stĺpce CSV a má tlačidlo na nahranie.
**Nepovie, čo sa stane s riadkom, ktorý už v systéme je** — hoci to je prvá
otázka pri importe.

**Má byť** v `.notice` nad formulárom: či sa existujúca osoba **prepíše,
preskočí, alebo import spadne**.

🔴 **Toto je rozhodnutie pre Jána, nie CSS.** Zisti v `importPeopleAction`,
ako sa to chová dnes, a napíš to. Ak sa chová inak než by malo, **nemeň to**
— napíš to do PR.

---

## Rámy

| Šírka | Čo sa mení |
| --- | --- |
| **1440** | Šírky podľa obrazovky (560–880) zostávajú; `.field-row` dva stĺpce od 640 px |
| **390** | Karty; `.field-row` jeden stĺpec (už je tak); akcie na celú šírku 44 px |

---

## Údaje, ktoré v modeli NEEXISTUJÚ

| Údaj | Stav |
| --- | --- |
| Posledné prihlásenie | ❌ neukladá sa. Nekresliť. |
| Fotografia osoby | ❌ v modeli nie je — iniciály sú jediná možnosť |
| História zmien na osobe | ⚠️ audit je, výpis na karte nie — 🔴 rozhodnutie |

🔴 Zmena schémy: **netreba žiadnu** pre úlohy 1–4.
