# Centrálne číselníky — vzory (seed)

Tieto súbory sú **zdroj pravdy** pre centrálne číselníky RAG. Runtime kópia žije v MongoDB kolekcii `codelists` (synchronizácia idempotentným seed skriptom — Fáza 4).

Plný návrh a governance: [`docs/CISELNIKY_governance.md`](../../../docs/CISELNIKY_governance.md).

## Súbory

| Súbor | Parameter | Closed | Hierarchický |
|---|---|---|---|
| `sectionKey.json` | sekcia obsahu (routing) | nie | **áno** |
| `companyCode.json` | pre koho platí (firma/organizácia) | nie | nie |
| `scope.json` | úroveň platnosti | **áno** | nie |
| `accessLevel.json` | viditeľnosť / RBAC | **áno** | nie |
| `language.json` | jazyk (ISO 639-1) | nie | nie |
| `category.json` | kategória dokumentu | nie | nie |
| `sourceType.json` | typ zdroja | **áno** | nie |
| `tags.json` | riadený slovník štítkov | nie | nie |

> **Stav:** vzory = kostra + 1–2 príklady. Plné sady (`sectionKey`, `companyCode`, `category`) sa doplnia prechodom reálneho korpusu (Fáza 4).

## Formát položky

```json
{
  "key": "sutazny_poriadok",   // strojová hodnota — ide do document_chunks, NEMENNÁ
  "label": "Súťažný poriadok", // zobrazované meno (SK, s diakritikou)
  "parent": "normy",          // hierarchia (len sectionKey); inak null
  "synonyms": ["SP"],          // voliteľné — pomôcka pre LLM klasifikátor
  "sortOrder": 11,             // poradie v UI
  "isActive": true             // default true; false = pripravené/deaktivované
}
```

## Pravidlá

- `key` je **nemenný**. Premenovanie = deaktivovať starý + pridať nový + migrovať chunky.
- `closed: true` → meniť len cez PR v repe. `closed: false` → rozšíriteľné aj cez admin UI.
- Seed skript **nikdy nemaže** — len `isActive: false`.
- `key`: `snake_case`, ASCII, bez diakritiky. **Výnimka:** `companyCode` používa zaužívané kódy organizácií (napr. `SFZ`, `SsFZ`) — povolené veľké písmená, stále bez diakritiky a medzier.
