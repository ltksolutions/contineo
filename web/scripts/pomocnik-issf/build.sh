#!/bin/bash
# Vykreslí logo, intro a záverečné logo, pridá zvuk a spojí intro s ukážkou ISSF.
# ./build.sh <priečinok so zvukmi zo sounds.sh a jingle.wav z jingle.py> <ukážka ISSF s komentárom, HD mp4> <výstupný priečinok>
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
SND=$(cd "$1" && pwd); DEMO=$2; OUT=$3; mkdir -p "$OUT"
PORT=8765

# render.swift číta stránku cez http (file:// nespustí skript s parametrami)
python3 -m http.server $PORT --bind 127.0.0.1 --directory "$HERE" >/dev/null 2>&1 &
SERVER=$!; trap 'kill $SERVER' EXIT; sleep 1
for m in logo intro outro; do swift "$HERE/render.swift" "http://127.0.0.1:$PORT/index.html?mode=$m&render" "$OUT/$m-obraz.mp4" 60 2; done

s=$SND
# Časy zvukov sedia na časovú os v index.html (M, OFF, F, I).
LOGO="$s/tiptoe.wav@0.1@0.45,$s/torch.wav@0.2@0.7,$s/switch.wav@2.42@0.7,$s/swing.wav@3.7@0.6,$s/pop.wav@4.85@0.25,$s/pop.wav@5.1@0.25,$s/pop.wav@5.35@0.25,$s/boing.wav@5.4@0.35,$s/boing.wav@5.57@0.35,$s/boing.wav@5.65@0.45,$s/boing.wav@5.82@0.45,$s/boing.wav@5.9@0.7,$s/boing.wav@6.07@0.7,$s/blink.wav@5.97@0.6,$s/typing.wav@6.9@0.3,$s/pop.wav@7.8@0.2,$s/jingle.wav@6.1@0.9"
INTRO="$s/draw.wav@0.0@0.5,$s/typing.wav@1.0@0.25,$s/pop.wav@1.6@0.15,$s/pop.wav@2.3@0.15,$s/pop.wav@3.0@0.15,$s/swing.wav@4.1@0.6,$s/pop.wav@5.6@0.25,$s/pop.wav@5.85@0.25,$s/pop.wav@6.1@0.25,$s/boing.wav@5.8@0.35,$s/boing.wav@5.97@0.35,$s/boing.wav@6.05@0.45,$s/boing.wav@6.22@0.45,$s/boing.wav@6.3@0.65,$s/boing.wav@6.47@0.65,$s/blink.wav@6.35@0.5,$s/typing.wav@7.35@0.5,$s/pop.wav@8.9@0.5,$s/pop.wav@10.25@0.4,$s/pop.wav@10.47@0.4,$s/typing.wav@12.45@0.5,$s/ding.wav@13.0@0.5"
VOICE="$s/b1.wav@0.9@1,$s/b2.wav@5.15@1,$s/b3.wav@7.6@1,$s/b4.wav@13.2@1"
# Jingle (zvukové logo) nahrádza v logu aj v závere cinknutie; v závere jeho posledný tón doznie s koncom.
OUTRO="$s/pop.wav@0.1@0.3,$s/blink.wav@2.95@0.5,$s/blink.wav@3.3@0.5,$s/jingle.wav@0.48@0.9"

swift "$HERE/mix.swift" "$OUT/logo-obraz.mp4" "$OUT/contineo-logo-animacia.mp4" "$LOGO"
swift "$HERE/mix.swift" "$OUT/outro-obraz.mp4" "$OUT/contineo-zaverecne-logo.mp4" "$OUTRO"
swift "$HERE/mix.swift" "$OUT/intro-obraz.mp4" "$OUT/contineo-intro-s-hlasom.mp4" "$INTRO,$VOICE"
swift "$HERE/mix.swift" "$OUT/intro-obraz.mp4" "$OUT/contineo-intro-bez-hlasu.mp4" "$INTRO"
swift "$HERE/mix.swift" "$OUT/intro-obraz.mp4" "$OUT/cele-hd.mp4" "$INTRO,$VOICE" "$DEMO" "$OUT/contineo-zaverecne-logo.mp4"
swift "$HERE/transcode.swift" "$OUT/cele-hd.mp4" "$OUT/pomocnik-issf-ukazka.mp4" 1500000
