# Video pomocníka v ISSF — ako vzniklo

Zdroj videí v `web/public/media/pomocnik-issf/` (popis súborov je v tamojšom
`README.md`). Všetko beží na Macu: Swift s AVFoundation a WebKit, `afconvert`,
`screencapture`, žiadny ffmpeg. Zvuky a hlas sú z ElevenLabs.

**Kľúč ElevenLabs sa do repozitára nedáva.** Skripty ho čítajú z premennej
`ELEVENLABS_API_KEY` alebo z Kľúčenky:

```
security add-generic-password -a "$USER" -s ELEVENLABS_API_KEY -w
```

Voice ID hlasu „LTK“ je `ZBmvz7pM2hkKUTvijLfe` — bez kľúča účtu sa použiť nedá.

**Koniec vety má ísť hlasom dole.** Samostatne čítaná veta ostáva na konci
plochá alebo stúpa, ako keby pokračovala, preto obe skripty posielajú aj
susedné vety (`previous_text`, `next_text`). Hlas nevyjde zakaždým rovnako;
vetu, ktorej koniec neklesne, treba vyrobiť znova a vybrať lepší záber
(29. 10. 2026 tak boli opakované vety s5, s6 a b1). Otázka v intre potrebuje
v texte pre hlas dva otázniky, inak jej koniec nestúpne.

## 1. Ukážka v ISSF

Nahrávka obrazovky panela prehliadača s widgetom kanála na `issf.futbalsfz.sk`.
Odpoveď, história a meno používateľa boli v prehliadači podvrhnuté (nič
neodišlo na server); tento krok je ručný a jeho skript v repozitári nie je,
lebo je viazaný na produkčné ISSF.

```
screencapture -v -V 72 -x -R 553,260,1156,764 rec.mov        # výrez panela v bodoch
./voice-issf.sh ZBmvz7pM2hkKUTvijLfe voice                   # šesť viet komentára
swift narrate.swift rec.mov <začiatok+0,6> "s1:…,s6:…,end:…" voice ukazka-hd.mp4 1.0
swift still.swift ukazka-hd.mp4 <čas> snimka.png && swift crop.swift snimka.png snimka.png 14
```

Značky scén (`s1`–`s6`, `end`, milisekundy epochy) zapisoval režisér v stránke
(`window.__m`), začiatok nahrávky je čas spustenia `screencapture` posunutý
o oneskorenie nahrávania (~0,6 s, overené podľa snímky, keď zmizne tip).

## 2. Animácie značky a intro

`index.html` kreslí tri animácie ako čistú funkciu času (`render(t)`):

| režim | čo | dĺžka |
|---|---|---|
| `?mode=logo` | lupa v tme, rozsvietenie, premena na Contineo, vypísaná odpoveď | 9 s, 1080 × 1080 |
| `?mode=intro` | „Stále hľadáte a dostávate možnosti?“ → „Opýtajte sa. Nehľadajte.“ → odpoveď | 16,8 s, 1156 × 764 |
| `?mode=outro` | záverečné logo s pohľadom a žmurknutím | 4,8 s, 1156 × 764 |

Náhľad v prehliadači (bez `&render` sa prehráva v slučke):

```
python3 -m http.server 8765 --directory web/scripts/pomocnik-issf
open "http://127.0.0.1:8765/index.html?mode=logo"
```

Výroba videí (v 2× rozlíšení, 60 snímok/s):

```
./sounds.sh ZBmvz7pM2hkKUTvijLfe snd           # efekty a štyri vety intra
python3 jingle.py snd/jingle.wav                # zvukové logo (melódia m1, bez ElevenLabs)
./build.sh snd ukazka-hd.mp4 out                # logo, obe intrá, záver, celé video
```

Časy zvukov v `build.sh` sedia na časovú os v `index.html` (`M`, `OFF`, `F`, `I`);
pri zmene časovania treba posunúť obe. Titulky `titulky-*.vtt` majú časy celého
videa (intro 16,8 s + ukážka + záver).

Zvukové logo hrá v animácii loga od 6,1 s (posledný tón pri vypísaní odpovede) a v záverečnom
logu od 0,48 s, aby posledný tón dozvučal s koncom. Zvuk, ktorý presahuje video, `mix.swift`
odstrihne a posledných 0,4 s stíši. Pravidlá použitia značky: `.design-sync/conventions.md`.

Kontrola časovania bez prehrávania: `swift contact-sheet.swift video.mp4 "1,2,3" pas.png`.
