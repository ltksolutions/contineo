# ADR-015 — Názov dokumentu sa pri platnom znení mení len novým znením

> **Stav:** prijaté · **Dátum:** 2026-09-24
> **Zadal:** Ján Letko cez rám z Claude Design `KNIZNICA-uprava-dokumentu`
> **Odsúhlasil:** Ján Letko (2026-09-24) — Q3 v
> `docs/design/KNIZNICA-uprava-dokumentu.md`: „Názov sa mení len novým znením."
> **Nadväzuje na:** D28 (formulka potvrdenia), D45 (kópia, nie odkaz),
> ADR-011 D96, ADR-013 D107 (identita konceptu), ADR-014 (postup znenia)
> **Mení:** úprava údajov o dokumente — názov sa pri zverejnenom znení
> v nej už meniť nedá.

---

## 1. Kontext

Názov dokumentu je doslova vo formulke potvrdenia (D28). Úprava údajov
o dokumente ho dovtedy menila kedykoľvek. Staré potvrdenia si nesú kópiu
(D45), ale **nové potvrdenia platného znenia** by niesli iný názov, než má
schválené PDF — človek by potvrdil „Pracovný poriadok SFZ 2026" pri PDF,
ktoré sa volá inak a ktoré nikto so zmeneným názvom neschválil.

## 2. Rozhodnutie

### D112 — Názov ako súčasť nového znenia

- **Dokument so zverejneným znením:** v úprave dokumentu je Názov len na
  čítanie (🔒, odkaz na nové znenie). Server zmenu odmietne
  (`library.titleLocked` v `saveMetadata()`), nestačí, že pole nie je vidieť.
- **Bez zverejneného znenia** (len koncept) sa názov upraviť dá ako doteraz.
- **Nové znenie** má v kroku 1 prípravy pole Názov, predvyplnené z dokumentu.
  Iný názov sa uloží ako `draftTitle` (`saveDraftTitle()`); rovnaký = bez zmeny.
- `draftTitle` **vstupuje do identity konceptu** — len keď je, ako údaje
  o znení v D107. Koncept bez nového názvu si identitu zachová a bežiace
  kolá platia. Zámok je ten istý: počas kola a po schválení sa nemení.
- Schvaľovateľ vidí na `/approvals` nový názov; krok 2 na detaile ho uvádza
  medzi tým, čo sa schvaľuje.
- **Zverejnením** sa `draftTitle` stane názvom dokumentu (a úsekov na
  vyhľadávanie) a z konceptu zmizne. Audit zverejnenia zapíše starý aj nový názov.

### Priečinok v úprave dokumentu (Q2)

Priečinok je v tom istom formulári ako ostatné údaje. Presun ide cez
`assignDocument()` — ten istý auditný záznam ako samostatný presun (kto,
kedy, odkiaľ kam, názvami). Samostatný formulár v Správe odpadol; hromadný
presun v knižnici ostáva.

## 3. Dôsledky

- Úprava dokumentu je samostatný pohľad (`?edit=document`) s úsekmi ako pri
  nahratí a vetou „Mení údaje o dokumente, nie znenie. Schválenie ani
  potvrdenia sa tým nerušia." — po D112 to platí aj pre názov.
- Import a skripty, ktoré zapisujú priamo do databázy, pravidlo neobchádzajú
  zámerne — názov pri importe nie je úprava platného znenia.
