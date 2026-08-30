# Contineo — pravidlá pre prácu v tomto repozitári

> Toto číta Claude Code pri každom spustení. Sú to pravidlá, ktoré sa
> **neopakujú v konverzácii** — keď je niečo tu, platí to bez pripomínania.

## Jazyk v kóde

**Identifikátory sú anglické. Komentáre a texty pre používateľa slovenské.**

| čo | jazyk | príklad |
|---|---|---|
| názvy súborov | angličtina | `departments.ts`, `folders.ts`, `TreeWithOrder.tsx` |
| funkcie, typy, premenné, komponenty | angličtina | `allDepartments()`, `interface Department` |
| polia a kolekcie v Mongu | angličtina | `departmentId`, `versions[]`, `document_chunks` |
| názvy `npm run` príkazov | angličtina | `npm run check`, `npm run reindex` |
| kľúče v adrese (`?tab=…`) | angličtina | `?tab=departments` |
| **komentáre** | **slovenčina** | `// Bez toho by sa audit dal spätne meniť.` |
| **texty na obrazovke, hlásenia, e-maily** | **slovenčina** | `„Zmeny boli uložené."` |
| **dokumentácia v `docs/`** | **slovenčina** | |

Prečo tak: celý ekosystém okolo (Next, Mongo, typy, chybové hlášky,
dokumentácia knižníc) je anglický a miešanie znamená prepínanie jazyka
v každom druhom riadku — a hlavne prekladanie medzi kódom a databázou
(`Oddelenie` verzus `departments`). Komentáre naopak vysvetľujú *prečo*,
často právne alebo organizačné dôvody, a tie sa presnejšie povedia po
slovensky.

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
- **Verejné cesty sú zmluva:** `app/**/page.tsx` a `app/api/**/route.ts`
  (cesta k súboru **je** adresa) a kľúče a hodnoty v adrese. Pri tých sa
  neprejmenúva, ale **prekladá** — starý tvar zostane fungovať cez tabuľku
  v `lib/urlParams.ts` a zmizne, keď prestane chodiť.
- **Názvy `npm run` príkazov a súborov v `scripts/` sú vnútorné.** Premenovať
  sa dajú naraz s dokumentáciou; nikto zvonku sa na ne neodkazuje.
- **Názvy polí v MongoDB a v uloženom profile tenanta sú dáta, nie kód.**
  Menia sa len migráciou, nie refaktorom.

Podrobne: `docs/AKO_TO_BEZI.md`.

## Zásady, ktoré sa v tomto projekte opakujú

- **Stav sa odvodzuje, neukladá** (D27). Výnimky sú dve a obe majú dôvod
  zapísaný priamo v kóde: `departmentPath` a `groupHistory` na osobe.
- **Dôkazné záznamy sa nemenia ani nemažú** (D24). Oprava je nový záznam,
  odvolanie je `revokedAt`, nie `deleteOne`.
- **Kópia, nie odkaz**, všade, kde má byť o rok čitateľné, čo sa vtedy stalo:
  názov dokumentu v potvrdení, názov oddelenia v pridelení, útvar v audite.
- **`companyCode` patrí do podmienky dotazu**, nie do kontroly nad ním (D32).
  Identifikátory sa dajú uhádnuť.
- **`redirect()` vyhadzuje výnimku.** Nikdy ho nevolaj vnútri `try`, ktorého
  `catch` hlási chybu zápisu — alebo použi `jePresmerovanie()` /
  `isRedirect()` ako prvý riadok toho `catch`.
- **Mobile first je povinnosť**, nie odporúčanie.

## Overenie pred commitom

```
cd app
npx tsc --noEmit      # bez chýb (riadky z .next/ sa ignorujú)
npx eslint .          # 0 errors (warnings sú v poriadku)
npx vitest run        # všetko zelené
npm run build         # prejde
```

Databázové invarianty: `npm run check` (predtým `kontrola`).
