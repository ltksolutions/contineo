#!/bin/bash
#
# datumy_sfz.sh — dátumy účinnosti deviatich noriem SFZ.
#
# Každý dátum je prevzatý z ustanovenia o účinnosti v texte samotnej normy;
# citácia ide do databázy spolu s ním (`versions[].effectiveFromSource`).
# Skript je tu preto, aby sa dalo dohľadať, odkiaľ sa dátumy vzali — nie
# preto, že by sa mal spúšťať opakovane.
#
# Dve poznámky, ktoré by sa inak stratili:
#
#   - **Stanovy a Súťažný poriadok** vlastný dátum účinnosti neuvádzajú
#     („dňom schválenia"). Použitý je deň schválenia poslednej novely
#     zo záhlavia — je to odvodenie z dvoch miest, nie citát z jedného.
#   - **Revízny poriadok** sa určiť nedá vôbec: hovorí „dňom schválenia
#     VV SFZ" a dátum schválenia v texte nie je. Zostáva zástupný, označený
#     v `effectiveFromSource`, a treba ho doplniť z uznesenia VV SFZ.
#
#   bash scripts/datumy_sfz.sh              # ukáže, čo by sa zmenilo
#   ZAPIS=--zapis bash scripts/datumy_sfz.sh
#
set -e
cd "$(dirname "$0")/.."
run() { npm run platnost --silent -- --doc "$1" --od "$2" --zdroj "$3" $ZAPIS; }

run sfz:disciplinarny_poriadok 2023-07-01 \
  "čl. 91: „Tento disciplinárny poriadok bol schválený výkonným výborom dňa 6. júna 2023 a nadobúda účinnosť 1. júla 2023.\""

run sfz:organizacny_navstevny_poriadok 2014-07-01 \
  "čl. 15 Účinnosť: „Tento poriadok nadobúda účinnosť 1. júla 2014.\""

run sfz:poriadok_komory_sporov 2021-12-07 \
  "čl. 41 Účinnosť: „Tento poriadok schválil výkonný výbor SFZ dňa 07. decembra 2021 a účinnosť nadobúda dňom jeho schválenia.\""

run sfz:registracny_prestupovy_poriadok 2026-06-01 \
  "čl. 46 Účinnosť: „Tento poriadok nadobúda účinnosť dňa 01. júna 2026.\""

run sfz:rokovaci_poriadok_konferencie 2016-06-04 \
  "čl. 31: „...schválený na konferencii dňa 3. júna 2016 a nadobúda účinnosť 4. júna 2016.\""

run sfz:volebny_poriadok 2016-06-04 \
  "čl. 11 Účinnosť: „...prerokovaný a schválený na konferencii dňa 3. júna 2016 a nadobúda účinnosť 4. júna 2016.\""

run sfz:stanovy 2026-02-27 \
  "Záhlavie: posledná novela „schválené na konferencii SFZ dňa 27.02.2026 v Bratislave\". Samostatné ustanovenie o účinnosti stanovy neuvádzajú — dátum je dňom schválenia poslednej novely."

run sfz:sutazny_poriadok 2026-06-24 \
  "čl. 95 Účinnosť: „nadobúda účinnosť dňom schválenia VV SFZ\" + záhlavie: posledná novela „schválené VV SFZ dňa 24. júna 2026\"."
