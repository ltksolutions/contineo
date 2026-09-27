# Písma pre PDF certifikátu

Noto Sans (Regular, SemiBold), Noto Serif (Regular), Noto Sans Mono (Regular),
licencia SIL Open Font License 1.1 (`OFL.txt`). Zdroj:
`github.com/notofonts/notofonts.github.io`, `fonts/*/unhinted/ttf/`.

Súbory sú **orezané** na znaky, ktoré certifikát potrebuje (latinka vrátane
slovenčiny, češtiny a strednej Európy, typografické úvodzovky a pomlčky):

```
pyftsubset <písmo>.ttf \
  --unicodes="U+0020-007E,U+00A0-017F,U+2010-2027,U+2030-203A,U+20AC,U+2116,U+2122" \
  --layout-features='kern,liga'
```

Prečo vopred, a nie pri tvorbe PDF: `@pdf-lib/fontkit` pri `subset: true`
z Noto stráca znaky. Celé písmo by PDF nafúklo na 1 MB. Znak mimo rozsahu
(napr. azbuka v mene) sa vykreslí ako prázdny obdĺžnik. Keď to bude treba,
rozsah sa rozšíri tu a súbory sa vyrobia znova.
