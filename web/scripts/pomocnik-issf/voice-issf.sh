#!/bin/bash
# Vety komentára ukážky ISSF hlasom ElevenLabs: ./voice-issf.sh <voiceId> <výstupný priečinok>
# Kľúč z premennej prostredia alebo z Kľúčenky (ELEVENLABS_API_KEY), nikdy v súbore ani v príkazovom riadku.
set -euo pipefail
ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY:-$(security find-generic-password -s ELEVENLABS_API_KEY -w 2>/dev/null || true)}
: "${ELEVENLABS_API_KEY:?chýba ELEVENLABS_API_KEY (prostredie ani Kľúčenka)}"
VOICE=$1; OUT=$2; mkdir -p "$OUT"
S=(
"V systéme íesesef pribudne hore riadok pomocníka. Pri prvej návšteve ho predstaví krátky tip."
"Otázku stačí napísať vlastnými slovami."
"Odpoveď príde z predpisov a manuálov Slovenského futbalového zväzu, aj so zdrojmi."
"Keď odpoveď nepomôže, kliknite na Napísať helpdesku. Otázka sa prenesie do správy a odpoveď vám pošle človek e-mailom."
"Riadok sa dá zbaliť na malé tlačidlo a odložiť kamkoľvek na obrazovke. Miesto si zapamätá."
"Tip sa dá kedykoľvek vyvolať žiarovkou a dvojklik vráti riadok na pôvodné miesto."
)
# Vety sa čítajú s textom pred a za sebou (previous_text/next_text). Bez neho
# ostane hlas na konci vety hore, ako keby veta pokračovala; za poslednou
# vetou stojí krátke „Ďakujem.“, aby aj ona klesla.
for i in "${!S[@]}"; do
  n=$((i+1)); prev=""; next="Ďakujem."
  [ "$i" -gt 0 ] && prev=${S[$((i-1))]}
  [ "$n" -lt "${#S[@]}" ] && next=${S[$n]}
  body=$(python3 -c 'import json,sys;print(json.dumps({"text":sys.argv[1],"previous_text":sys.argv[2],"next_text":sys.argv[3],"model_id":"eleven_multilingual_v2","language_code":"sk","voice_settings":{"stability":0.5,"similarity_boost":0.8}}))' "${S[$i]}" "$prev" "$next")
  curl -sf -X POST "https://api.elevenlabs.io/v1/text-to-speech/$VOICE?output_format=mp3_44100_128" \
    -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d "$body" -o "$OUT/s$n.mp3"
  afconvert -f WAVE -d LEI16@48000 "$OUT/s$n.mp3" "$OUT/s$n.wav"
  echo "s$n ok"
done
