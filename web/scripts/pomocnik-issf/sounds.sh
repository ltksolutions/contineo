#!/bin/bash
# Zvukové efekty a vety intra z ElevenLabs: ./sounds.sh <voiceId> <výstupný priečinok>
# Kľúč z premennej prostredia alebo z Kľúčenky (ELEVENLABS_API_KEY), nikdy v súbore ani v príkazovom riadku.
set -euo pipefail
ELEVENLABS_API_KEY=${ELEVENLABS_API_KEY:-$(security find-generic-password -s ELEVENLABS_API_KEY -w 2>/dev/null || true)}
: "${ELEVENLABS_API_KEY:?chýba ELEVENLABS_API_KEY (prostredie ani Kľúčenka)}"
VOICE=$1; OUT=$2; mkdir -p "$OUT"
API=https://api.elevenlabs.io/v1

sfx() { # názov, opis, dĺžka v s
  body=$(python3 -c 'import json,sys;print(json.dumps({"text":sys.argv[1],"duration_seconds":float(sys.argv[2]),"prompt_influence":0.6}))' "$2" "$3")
  curl -sf -X POST "$API/sound-generation?output_format=mp3_44100_128" -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d "$body" -o "$OUT/$1.mp3"
  afconvert -f WAVE -d LEI16@48000 "$OUT/$1.mp3" "$OUT/$1.wav"; echo "$1 ok"
}
# Pokojný „business“ prednes: stabilnejší hlas, pomalšie tempo. Text pred
# a za vetou (previous_text/next_text) drží klesajúcu intonáciu na jej konci.
say() { # názov, text, predchádzajúca veta, nasledujúca veta
  body=$(python3 -c 'import json,sys;print(json.dumps({"text":sys.argv[1],"previous_text":sys.argv[2],"next_text":sys.argv[3],"model_id":"eleven_multilingual_v2","language_code":"sk","voice_settings":{"stability":0.75,"similarity_boost":0.8,"style":0,"use_speaker_boost":True,"speed":0.86}}))' "$2" "$3" "$4")
  curl -sf -X POST "$API/text-to-speech/$VOICE?output_format=mp3_44100_128" -H "xi-api-key: $ELEVENLABS_API_KEY" -H "Content-Type: application/json" -d "$body" -o "$OUT/$1.mp3"
  afconvert -f WAVE -d LEI16@48000 "$OUT/$1.mp3" "$OUT/$1.wav"; echo "$1 ok"
}

sfx draw "soft quick pencil swoosh drawing a circle, clean UI sound" 0.7
sfx swing "playful cartoon whoosh swing with a springy wobble at the end, clean" 1.0
sfx boing "small cute cartoon boing bounce, rubber ball landing, short" 0.6
sfx pop "tiny soft bubble pop, ui sound, very short" 0.5
sfx blink "tiny cute blink sound, soft click, cartoon" 0.5
sfx ding "gentle bright ui chime, success, warm, short" 1.2
sfx typing "soft quick laptop keyboard typing, short burst" 1.3
sfx torch "small flashlight button click on" 0.5
sfx switch "light switch click, room lights turning on with a soft electric hum" 1.0
sfx tiptoe "quiet curious pizzicato tiptoe music, sneaky searching in the dark, short" 2.2

# Hlas číta len texty, ktoré sú na obrazovke. Dva otázniky sú pokyn pre hlas: s jedným
# končila otázka plocho, na obrazovke a v titulkoch je jeden.
B1="Stále hľadáte a dostávate možnosti??"; B2="Opýtajte sa. Nehľadajte."
B3="Pýtajte sa, a dostávajte odpovede."; B4="Jedna overená odpoveď namiesto zoznamu odkazov."
say b1 "$B1" "" "$B2"
say b2 "$B2" "$B1" "$B3"
say b3 "$B3" "$B2" "$B4"
say b4 "$B4" "$B3" "Ďakujem."
