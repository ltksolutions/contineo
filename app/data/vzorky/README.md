# Vzorky dokumentov

Vstup pre chunker a ingesciu. **Markdown, nie PDF.**

## Prevod z PDF

```bash
cd app/data/vzorky
markitdown ~/Downloads/sutazny_poriadok.pdf > sutazny_poriadok.md
```

PDF originály sú v `.gitignore` — binárne súbory sa v gite zle verzujú a nedá sa v nich vidieť, čo sa zmenilo. Do repozitára ide len prevedený Markdown, ktorý je zároveň skutočným vstupom pre chunker.

## Pomenovanie

Kľúč zo `sectionKey` číselníka, aby bolo hneď zrejmé, o aký predpis ide:

```
sutazny_poriadok.md
registracny_prestupovy_poriadok.md
disciplinarny_poriadok.md
rozpis_sutazi_ssfz_2026.md
```

## Metadáta

Ku každému dokumentu patrí `.meta.json` s tagmi z číselníkov — chunker ich prevezme na všetky chunky:

```json
{
  "title": "Súťažný poriadok SFZ",
  "sectionKey": "sutazny_poriadok",
  "companyCode": "SFZ",
  "scope": "global",
  "accessLevel": "public",
  "language": "sk",
  "category": "norma",
  "sourceType": "pdf",
  "sourceUrl": "https://futbalsfz.sk/legislativa-predpisy-sfz/",
  "effectiveFrom": "2026-07-01"
}
```

Hodnoty musia byť z číselníkov v `app/src/codelists/` — čo tam nie je, import odmietne.
