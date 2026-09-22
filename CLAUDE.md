# Contineo — pravidlá pre prácu v tomto repozitári

> Toto číta Claude Code pri každom spustení. Sú to pravidlá, ktoré sa
> **neopakujú v konverzácii** — keď je niečo tu, platí to bez pripomínania.

## Rituály — pomenované príkazy

Štyri vety, ktoré Ján používa ako príkaz. Keď zaznejú, znamenajú toto:

**„Zorientuj sa"** — načítaj `CLAUDE.md`, `NEXT.md`, `git log -20` a aktuálnu
vetvu; zhrň stav v **max. 10 riadkoch** a navrhni ďalší krok. Nič sa nemení,
je to len čítanie. Keď si `NEXT.md` a `git log` protirečia, **platí git** —
a rozpor sa povie nahlas, nie zamlčí.

**„Poupratuj"** — zápis do `docs/DEVLOG.md` → prečisti `NEXT.md` a `docs/TODO.md`
proti `git log` → doplň `CHANGELOG.md` → prejdi TODO/FIXME v kóde → lint
a formát → commit podľa konvencie. **`NEXT.md` sa aktualizuje práve tu**, inde
nie — inak by sa z neho stal tretí zdroj pravdy, ktorý klame.

**„Odovzdaj"** — handover pre kolegu: čo je rozrobené a kde presne, čo treba
vedieť, čo nefungovalo a prečo.

**„Rozhodni"** — z diskusie vyrob ADR. Ján ich vedie v `docs/decisions/`, ten
v tomto repozitári **zatiaľ nie je** — ADR ležia priamo v `docs/` ako
`ADR-NNN-nazov.md`. Kým sa nerozhodne inak, nové ADR idú tam; presun je
samostatné rozhodnutie, nie úprava mimochodom.

### Čo je `NEXT.md`

Jedna strana: kde sme, čo čaká na Jánovo rozhodnutie, tri najbližšie kroky,
ako sa projekt overuje. **Nie backlog** — ten je `docs/TODO.md` a má stovky
riadkov s odôvodneniami. `NEXT.md` naň odkazuje a neduplikuje ho.

## Jazyk v kóde

**Identifikátory sú anglické. Komentáre a texty pre používateľa slovenské.**

| čo | jazyk | príklad |
|---|---|---|
| názvy súborov | angličtina | `departments.ts`, `folders.ts`, `TreeWithOrder.tsx` |
| funkcie, typy, premenné, komponenty | angličtina | `allDepartments()`, `interface Department` |
| polia a kolekcie v Mongu | angličtina | `departmentId`, `versions[]`, `document_chunks` |
| názvy `npm run` príkazov | angličtina | `npm run check`, `npm run chunking:status` |
| kľúče v adrese (`?tab=…`) | angličtina | `?tab=departments` |
| názvy CSS tried, `id`, kotvy, `@keyframes`, vlastné premenné | angličtina | `.button`, `.field-input`, `.tree-row`, `.is-active`, `#results`, `--level` |
| **komentáre** | **slovenčina** | `// Bez toho by sa audit dal spätne meniť.` |
| **texty na obrazovke, hlásenia, e-maily** | **slovenčina** | `„Zmeny boli uložené."` |
| **dokumentácia v `docs/`** | **slovenčina** | |

Prečo tak: celý ekosystém okolo (Next, Mongo, typy, chybové hlášky,
dokumentácia knižníc) je anglický a miešanie znamená prepínanie jazyka
v každom druhom riadku — a hlavne prekladanie medzi kódom a databázou
(`Oddelenie` verzus `departments`). Komentáre naopak vysvetľujú *prečo*,
často právne alebo organizačné dôvody, a tie sa presnejšie povedia po
slovensky.

**Stav sa píše `is-*`, nie `je-*`** (`.is-active`, `.is-on`, `.is-dragging`) —
prefix nesie, že ide o stav, nie o zložku názvu. Modifikátor je dvojitá
spojka (`.button--quiet`, `.tag--new`), teda BEM bez blokového prefixu.

**Historické kľúče sa neprepisujú, prekladajú.** Starý tvar (`?zalozka=utvary`)
zostane fungovať cez prekladovú tabuľku a zmizne, keď prestane chodiť.
Viď `lib/urlParams.ts`.

## Texty pre používateľa: vždy cez i18n, tri jazyky

**Žiadny text, ktorý uvidí človek, sa nepíše natvrdo do komponentu.** Ide cez
`lib/i18n.ts` a existuje v troch jazykoch: **`sk`, `cs`, `en`**. Platí to pre
nadpisy, popisy polí, nápovedy, hlásenia, tlačidlá, e-maily aj chybové vety.

Prečo tri a prečo hneď: jazyk prostredia je na osobe (`persons.language`)
a tenant má zoznam zapnutých jazykov — český rozhodca už dnes môže mať české
rozhranie. Text napísaný natvrdo v komponente sa preloží až vtedy, keď ho
niekto nájde, a nájde ho spravidla zákazník.

- **Jazyk prostredia ≠ jazyk dokumentu.** Norma v češtine je samostatný
  dokument, nie preklad (`i18n.ts`). Neprekladáme obsah, len rozhranie.
- **Potvrdzovacia formulka** sa ukladá doslovne do záznamu v jazyku, v ktorom
  ju človek videl (D28) — preklad sa nikdy spätne nemení.
- Chýbajúci preklad **padá na slovenčinu**, nie na kľúč. Prázdne miesto alebo
  `pole.popis.nazov` na obrazovke je horšie než nepreložená veta.

## Premenovanie súborov

Rozhoduje, kto sa na cestu odkazuje — nie to, či sa niečo maže.

- **Vnútorné odkazy (importy) sa premenovať dajú.** Riešia sa pri preklade;
  zabudnutý odkaz zhodí `tsc` aj build menovite, takže nemôže vzniknúť stav,
  kde to prejde a rozbije sa až u zákazníka. `git mv` zachová históriu.
- **Verejné cesty sú zmluva:** `app/src/app/**/page.tsx` a
  `app/src/app/**/route.ts` (cesta k súboru **je** adresa) a kľúče a hodnoty
  v adrese. Pri tých sa neprejmenúva, ale **prekladá** — starý tvar zostane
  fungovať a zmizne, keď prestane chodiť. Sú to dve tabuľky: celé cesty
  prekladá `lib/legacyRoutes.ts` (presmerovanie v middlewari), kľúče
  a hodnoty v adrese `lib/urlParams.ts`.
- **Názvy `npm run` príkazov a súborov v `scripts/` sú vnútorné.** Premenovať
  sa dajú naraz s dokumentáciou; nikto zvonku sa na ne neodkazuje.
- **Názvy polí v MongoDB a v uloženom profile tenanta sú dáta, nie kód.**
  Menia sa len migráciou, nie refaktorom.

Podrobne: `docs/AKO_TO_BEZI.md`.

## Zásady, ktoré sa v tomto projekte opakujú

- **Stav sa odvodzuje, neukladá** (D27). Výnimky sú tri a všetky majú dôvod
  zapísaný priamo v kóde: `departmentPath`, `departmentHistory` a
  `groupHistory` na osobe.
- **Dôkazné záznamy sa nemenia ani nemažú** (D24). Oprava je nový záznam,
  odvolanie je `revokedAt`, nie `deleteOne`.
- **Kópia, nie odkaz**, všade, kde má byť o rok čitateľné, čo sa vtedy stalo:
  názov dokumentu v potvrdení, názov oddelenia v pridelení, útvar v audite.
- **`companyCode` patrí do podmienky dotazu**, nie do kontroly nad ním (D32).
  Identifikátory sa dajú uhádnuť.
- **`redirect()` vyhadzuje výnimku.** Nikdy ho nevolaj vnútri `try`, ktorého
  `catch` hlási chybu zápisu — alebo použi `isRedirect()` (`lib/redirects.ts`)
  ako prvý riadok toho `catch`.
- **Mobile first je povinnosť**, nie odporúčanie.
- **Flex, ktorý pod 640 px ide do stĺpca, má deti so `flex-basis: auto`** —
  v spoločnom bloku na konci `globals.css`, nie pri komponente. Základ
  z riadku (`flex: 1 1 160px`) sa inak v stĺpci stane výškou.

## Kto smie commitovať priamo do `main`

Ján Letko (a asistent, ktorý pracuje na jeho stroji pod jeho menom) smie commitovať
priamo do `main`. **Ktokoľvek iný ide cez pull request.** Pravidlo nie je o dôvere,
ale o tom, kto nesie zodpovednosť za to, čo sa nasadí: `main` je to, čo o pár minút
beží na `intranet.futbalsfz.sk`.

Nezmenené zostáva, že bez výslovného súhlasu sa nikdy nerobí `force push`, rebase
zdieľanej vetvy ani mazanie vetvy.

## Overenie pred commitom

```
cd app
npx tsc --noEmit      # bez chýb (riadky z .next/ sa ignorujú)
npx eslint .          # 0 errors (warnings sú v poriadku)
npx vitest run        # všetko zelené
npm run build         # prejde
```

Databázové invarianty: `npm run check` (predtým `kontrola`).
