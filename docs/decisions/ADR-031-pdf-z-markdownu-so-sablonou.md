# ADR-031 — PDF z Markdownu so šablónou organizácie; DIČ, IČ DPH a kontakt na dokumentoch

> **Stav:** prijaté · **Dátum:** 2026-10-10
> **Rozhodol:** Ján Letko (2026-10-10) — „Automaticky", „Dátum vytvorenia
> znenia", „Doplniť 3 polia a do nastavení organizácie doplniť DIČ a IČ DPH,
> budú potrebné k vystavovaniu faktúr za služby v budúcnosti".
> **Nadväzuje na:** ADR-011 (PDF je schvaľovaný dokument, D94, D95),
> ADR-029 (PDF z Markdownu pri importe z konektora, `markdownPdf.ts`),
> ADR-012 (prevádzkovateľ v profile organizácie).
> **Implementácia:** `lib/documentPdf.ts` (hlavička a päta, logo ako PNG),
> `PdfLetterhead` v `lib/markdownPdf.ts`, `withGeneratedPdf()`
> v `app/library/actions.ts` (nový dokument aj nové znenie), `UploadFiles`
> (PDF nie je povinné pri zdroji `.md`), polia `controller.taxId`,
> `controller.vatId` a `contact.{web,email,phone}` v profile organizácie
> (`lib/tenants.ts`, `lib/tenantAdmin.ts`, Organizácia → Vzhľad).

## 1. Kontext

Čoraz viac dokumentov vzniká priamo ako Markdown — manuály ISSF (10. 10. 2026
nahratých desať), návody, FAQ. Schvaľuje a potvrdzuje sa však PDF (D94), takže
autor musel PDF vyrobiť mimo Continea a nahrať oba súbory. Výsledok vyzeral
zakaždým inak a nemal nič, podľa čoho by bolo vidieť, kto dokument vydal.

Generátor PDF z Markdownu už existuje (`markdownPdf.ts`, ADR-029) — pre import
z konektora, bez hlavičky a päty organizácie.

## 2. Rozhodnutia

### D187 — Zdroj `.md` bez PDF: PDF vyrobí Contineo

Pri nahratí nového dokumentu aj nového znenia platí:

- nahraté PDF má **vždy prednosť** — správanie sa nemení;
- **bez PDF so zdrojom `.md`** vyrobí Contineo PDF zo šablóny organizácie
  a uloží ho ako schvaľovanú podobu; `.md` ostáva vedľa neho ako upraviteľný
  zdroj (D95);
- bez PDF so zdrojom Word/Excel/text sa nahrávanie odmietne
  (`library.pdfOrMarkdownRequired`) — z Wordu PDF nevyrábame, rozloženie
  dokumentu by sa stratilo.

Vyrobené PDF je **obyčajné PDF znenia**: ide do schvaľovania, potvrdzuje sa
a jeho odtlačok je odtlačok znenia. ADR-011 platí bez výnimky.

### D188 — Šablóna: hlavička s logom, päta s údajmi organizácie, dátumom a stranou

- **Hlavička** (každá strana): logo organizácie vľavo, názov organizácie
  vpravo, linka. Názov je **právny názov**, inak názov portálu —
  `branding.displayName` býva názov aplikácie („Intranet SFZ"), na dokumente
  má stáť, kto ho vydal.
- **Päta** (každá strana), najviac tri riadky vľavo: právny názov a sídlo ·
  IČO, DIČ, IČ DPH · web, e-mail, telefón. Prázdny údaj sa vynechá. Vpravo
  „strana N z M" a dátum.
- **Dátum** je deň vytvorenia znenia; keď je vyplnená účinnosť, pribudne
  „Účinné od …". Deň, nie okamih: ten istý text v ten istý deň dá ten istý
  súbor, a teda ten istý odtlačok.
- Texty päty sú v **jazyku dokumentu**, nie prostredia — päta je súčasť
  dokumentu.
- Údaje sú v PDF **natlačené** (kópia, nie odkaz): keď sa o rok zmení
  adresa, staré znenie ostane také, aké sa schvaľovalo.
- Logo ide z profilu organizácie ako PNG (pdf-lib nevie SVG ani WebP);
  poškodené alebo chýbajúce logo = hlavička bez loga, PDF kvôli tomu
  nezlyhá.

### D189 — DIČ, IČ DPH a kontakt na dokumentoch v profile organizácie

- `controller.taxId` (DIČ, 8 až 12 číslic) a `controller.vatId` (IČ DPH,
  kód krajiny a 8 až 12 znakov) — pri právnom subjekte, lebo ich budú
  potrebovať aj **faktúry za služby**.
- `contact.web`, `contact.email`, `contact.phone` — kontakt, ktorý
  organizácia uvádza **na dokumentoch**. Nie `branding.supportEmail`: ten je
  pre ľudí v aplikácii, tento ide von na papier.
- Všetko nepovinné; prázdne pole sa zapíše prázdne (údaj sa dá zmazať),
  overuje sa len tvar.

## 3. Čo zostáva

- Tučné písmo, odkazy a tabuľky v PDF z Markdownu (dnes obyčajný text,
  tabuľka ako riadky s „·").
- Ligatúra „fi" a šípka „→" v písme PDF (samostatná úloha).
- Faktúry za služby — DIČ a IČ DPH sú pripravené, samotná fakturácia nie.
