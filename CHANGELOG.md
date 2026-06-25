# Changelog

Všetky podstatné zmeny projektu Contineo. Formát vychádza z [Keep a Changelog](https://keepachangelog.com/sk/).

## [Unreleased]

### Changed
- **Zjednodušený diagram architektúry** (`web/public/contineo_diagram.png`, `docs/contineo_diagram.png`) — z piatich vrstiev na tri + dva spätné cykly:
  vstupné kanály → worker (chunking + značkovanie) → MongoDB Atlas (jadro: embedding, hybrid search, rerank) → rozhrania;
  cykly: kurácia (kontrola kvality) a eskalácia na ticket. Pridaný editovateľný zdroj `contineo_diagram.svg`.
- **Zlúčenie „zdroje obsahu" + „integrácie"** do jednej vrstvy **„Vstupné kanály"** (pilier na stránke `/technologia`). ISSF/Sportnet je explicitne zdroj identity, nie obsahu; e-mail je obojsmerný kanál.
- **Premenovanie „Učiaci cyklus" → „Kontrola kvality a kurácia"** naprieč webom (pilier aj dátový tok na `/technologia`, krok „Podpora a kurácia" na úvodnej stránke). Dôvod: nejde o strojové učenie modelu, ale o ľudskú kuráciu obsahu — schválenie/oprava odpovede a jej uloženie ako `qa_pair`.
- `architectureCaption`: embedding, hybrid search a rerank sú popísané ako súčasť jadra MongoDB Atlas (Voyage Automated Embedding), nie ako samostatná vrstva.
- Zmeny aplikované v SK aj EN slovníku (`web/lib/dictionaries.js`).

### Notes / na rozhodnutie
- **Nejednotné názvoslovie dátového modelu** medzi implementáciou a verejnou stránkou — pozri `docs/DATA_MODEL_konzistencia.md`. Treba zvoliť kanonické názvy kolekcií a polí.
