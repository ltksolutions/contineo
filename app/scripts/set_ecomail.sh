#!/bin/bash
#
# set_ecomail.sh — nastaví a OVERÍ kľúč k Ecomailu.
#
#     bash scripts/set_ecomail.sh 'kluc-z-ecomailu'
#
# Kľúč sa najprv vyskúša priamo proti Ecomailu a až potom uloží do Vercelu.
# Opačné poradie by znamenalo nasadiť a čakať, kým sa niekto pokúsi prihlásiť.
#
# Pozor na dve veci, na ktorých sme už raz stroskotali:
#   · hodnota nesmie mať úvodzovky ani koncový nový riadok — `vercel env add`
#     ich berie doslova a Mongo aj Ecomail potom hlásia nezmysly;
#   · `vercel env add` potrebuje `--yes`, inak spotrebuje rúru na potvrdenie
#     a uloží prázdnu hodnotu.
set -u
export PATH=/opt/homebrew/bin:/usr/local/bin:$PATH

KLUC="${1:-}"
if [ -z "$KLUC" ]; then
  echo "Použitie: bash scripts/set_ecomail.sh 'kluc-z-ecomailu'"
  exit 1
fi

# Očistenie: obklopujúce úvodzovky a biele znaky vrátane nového riadku.
KLUC="$(printf '%s' "$KLUC" | tr -d '\r\n' | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' -e 's/^"\(.*\)"$/\1/' -e "s/^'\(.*\)'\$/\1/")"
echo "Kľúč má ${#KLUC} znakov."

echo ""
echo "== 1. skúška proti Ecomailu =="
ODPOVED=$(curl -s -o /tmp/eco.txt -w '%{http_code}' -X POST \
  https://api2.ecomailapp.cz/transactional/send-message \
  -H "key: $KLUC" -H 'Content-Type: application/json' \
  -d '{"message":{"subject":"Contineo — skúška kľúča","from_name":"Contineo","from_email":"noreply@contineo.app","text":"Skúška odosielania. Ak vám tento e-mail prišiel, kľúč aj doména fungujú.","to":[{"email":"jan.letko@futbalsfz.sk"}],"options":{"click_tracking":false,"open_tracking":false}}}' \
  --max-time 30)

echo "   HTTP $ODPOVED"
echo "   $(head -c 200 /tmp/eco.txt)"
rm -f /tmp/eco.txt

if [ "$ODPOVED" != "200" ]; then
  echo ""
  echo "✘ Ecomail kľúč neprijal — do Vercelu sa nič neuložilo."
  echo "  401 = zlý kľúč · 403 = neoverená odosielacia doména alebo neplatený účet"
  exit 1
fi

echo ""
echo "== 2. uloženie do Vercelu =="
cd ~/Documents/GitHub/contineo/app || exit 1
vercel env rm ECOMAIL_API_KEY production --yes >/dev/null 2>&1
printf '%s' "$KLUC" | vercel env add ECOMAIL_API_KEY production --yes >/dev/null 2>&1 \
  && echo "   ok" || { echo "   ZLE"; exit 1; }

echo ""
echo "== 3. nasadenie =="
vercel deploy --prod --yes 2>&1 | tail -3
