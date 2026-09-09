repo: ltksolutions/contineo
branch: main
path: app/src

## Last sync
date: 2026-09-07T14:30:00Z

### Updated in this project
- Nový responzívny návrh intranetu (Contineo Intranet.dc.html) — 7 obrazoviek
- Multiselect s vyhľadávaním a pridávaním hodnôt (MultiSelect.dc.html)
- Tenant farba prevzatá z ColorSelect palety, aplikovaná cez --accent / --accent-strong
- Farebné tokeny a názvoslovie prevzaté z app/src/app/globals.css

## Screen map
| Obrazovka | Zdroj v repozitári |
| --- | --- |
| Prehľad (dashboard) | app/src/components/PendingWidget.tsx, docs/UDALOSTI_A_UPOZORNENIA_KONCEPCIA.md |
| Knižnica dokumentov | app/src/app/library/page.tsx, app/src/lib/libraryRead.ts, docs/KNIZNICA_DOKUMENTOV.md |
| Detail dokumentu | app/src/app/library/[id]/, app/src/components/AcknowledgeButton.tsx |
| Opýtať sa (RAG) | app/src/components/Answer.tsx, app/src/components/Search.tsx, docs/rag-architecture.md |
| Nahrávanie a schválenie | app/src/app/library/actions.ts, app/src/lib/libraryWrite.ts |
| Nastavenia organizácie | app/src/components/ColorSelect.tsx, app/src/lib/branding.ts, docs/SPRAVA_TENANTOV.md |
| Prihlásenie | app/src/components/SignIn.tsx, docs/PRIHLASENIE_A_SPRAVA_OSOB.md |
| Multiselect / štítky | app/src/components/TagSelect.tsx, app/src/components/Select.tsx |
| Farebné tokeny | app/src/app/globals.css |
