# O20 — Skeleton loadery (plán)

*Zaradené 2026-09-16. Zadal Ján: „chýbajú mi inteligentné pekné preloadery na
stránkach … ideálne v štýle Skeleton Loaders."*

---

## 1. Prečo

Merané na kóde, nie na dojme:

| miesto čakania | stav pred O20 |
|---|---|
| navigácia medzi stránkami | **0 `loading.tsx`**, **0 `Suspense`** na 34 routách. Prehliadač drží starú stránku, kým serverový komponent nedobehne celý. |
| `/ask` pred prvým slovom | `Answer.tsx:84` vykreslí `null`. Klasifikácia, prepis dotazu, vyhľadanie aj rerank bežia **pred** otvorením SSE (`api/chat/route.ts` tvorí `ReadableStream` až po nich), takže karta je prázdna celý ten čas. |
| formuláre a akcie | pending stav má jediný komponent — `AcknowledgeButton`. |

Najviac dotazov na jednu stránku: `library/[id]` 11, `organisation` 10,
`people/[id]` a `documents/[documentId]` po 7.

## 2. Čo sa stavia

**Kostra, nie točiace sa koliesko.** Kostra hovorí *čo* príde, koliesko len
*že* sa čaká. Tvar sa preto berie zo skutočných tried stránky (`.panel-row`,
`.card`), nie od oka — kostra, ktorá po načítaní preskočí, je horšia než
prázdne miesto.

1. **Primitív** — `.skeleton` v `globals.css` + `components/Skeleton.tsx`.
   Jeden shimmer, tokeny `--surface-2` a `--radius`, povinné
   `prefers-reduced-motion` (pri vypnutom pohybe zostane pokojná plocha).
2. **Tvarové kostry** — `SkeletonPanel` (hlavička + riadky), `SkeletonCard`,
   `SkeletonText`, `SkeletonForm`.
3. **`SkeletonShell`** — obrys `AppShell`. Nutný, lebo `AppShell` je
   **v stránke, nie v `layout.tsx`**: `loading.tsx` nahrádza stránku, takže
   navigácia by počas čakania zmizla a obsah by poskočil hore. Shell má preto
   vlastnú kostru v rovnakej geometrii — pás pre ≥ 940 px aj 44 px prepínač
   zásuvky pod tým.
4. **`loading.tsx` pre všetkých 34 rout**, podľa tvaru: zoznamové, detailné,
   formulárové, domov/`ask`, návod.
5. **`/ask` — skutočné fázy.** `api/chat/route.ts` sa prestaví tak, aby práca
   bežala **vnútri** streamu a posielala udalosti `phase`. Bez toho by hláška
   „hľadám v predpisoch" bola animácia bez vzťahu k tomu, čo sa deje — a to sa
   v tomto projekte nerobí.
6. **Prúžok priebehu** — 2 px pod hlavičkou, štart na kliknutie do
   same-origin odkazu, koniec pri zmene `pathname`.

## 3. Dotknuté súbory

- `app/src/app/globals.css` — nový blok `.skeleton*` a `.route-progress`
- `app/src/components/Skeleton.tsx` *(nový)*
- `app/src/components/RouteProgress.tsx` *(nový, klientsky)*
- `app/src/app/**/loading.tsx` *(34 nových)*
- `app/src/app/layout.tsx` — vloženie prúžka
- `app/src/app/api/chat/route.ts` — práca dovnútra streamu, udalosti `phase`
- `app/src/lib/ask.ts` (alebo kde býva `askQuestion`) — prijatie `phase`
- `app/src/components/Search.tsx`, `components/Answer.tsx` — kostra a fáza
- `app/src/lib/i18n.ts` — názvy fáz v troch jazykoch

## 4. Riziká

- **Bliknutie navigácie.** Ošetrené `SkeletonShell`-om v rovnakej geometrii.
  Overiť na jednej route pred plošným nasadením.
- **Prestavba `api/chat/route.ts` je v horúcej ceste** — ide ňou každá
  odpoveď. Správanie pri chybe a pri `AbortError` musí zostať rovnaké;
  klient, ktorý `phase` nepozná, ju musí ticho preskočiť.
- **Kostra pre stránku, ktorá sa načíta za 80 ms**, je blik navyše. Ak sa taká
  nájde, `loading.tsx` sa z nej odoberie — kostra nie je samoúčel.
- **Mobile first** — kostry sa kreslia najprv na šírke telefónu.

## 5. Rozhodnutia (Ján, 2026-09-16)

- Rozsah: **všetkých 34 rout naraz**, nie iba najpomalšie.
- `/ask`: **prestavať route a posielať skutočné fázy**, nie iba nemú kostru.
- Prúžok priebehu: **áno**, popri kostrách.
