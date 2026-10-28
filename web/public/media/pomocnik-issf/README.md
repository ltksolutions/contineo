# Pomocník v ISSF — ukážka

Video s komentárom a osem snímok pomocníka (widget kanála) vloženého do
ISSF, k tomu animácie značky Contineo. Nahrané 28. 10. 2026 na `issf.futbalsfz.sk` s nasadeným skriptom
kanála (verzia `0.1.0 · ec7223d`).

**Je to ukážka, nie záznam skutočnej otázky.** Odpoveď a história otázok
boli podvrhnuté v prehliadači (nič neodišlo na server ani helpdesku),
meno v hlavičke ISSF a e-mail sú vymyslené (Peter Ukážka,
`peter.ukazka@example.com`). Komentár je syntetický hlas vytvorený v ElevenLabs.

| súbor | čo ukazuje |
|---|---|
| `pomocnik-issf-ukazka.mp4` | intro, celý priebeh v ISSF a záverečné logo, 66 s, 1600 px, H.264 + AAC |
| `contineo-intro-s-hlasom.mp4` | intro „Opýtajte sa. Nehľadajte.“ s hlasom, 16,8 s, 2312 px |
| `contineo-intro-bez-hlasu.mp4` | to isté intro len so zvukovými efektmi |
| `contineo-logo-animacia.mp4` | animácia značky: lupa v tme, rozsvietenie, premena na Contineo, 9 s, 2160 × 2160 |
| `contineo-zaverecne-logo.mp4` | záverečné logo so sloganom a contineo.app, 4,8 s |
| `poster-video.jpg` | náhľad videa na webe (koniec intra) |
| `titulky-sk.vtt`, `titulky-cs.vtt`, `titulky-en.vtt` | titulky celého videa; v intre sú slovenské vety priamo v obraze, preklady sú hore |
| `poster.jpg` | náhľad ukážky (odpoveď so zdrojmi) |
| `1-riadok-s-tipom.png` | riadok hore v strede a tip pri prvej návšteve |
| `2-otazka.png` | plachta s napísanou otázkou |
| `3-odpoved-so-zdrojmi.png` | odpoveď z predpisov a manuálov so zdrojmi |
| `4-napisat-helpdesku.png` | otázka prenesená do správy pre helpdesk |
| `5-zbalene-tlacidlo.png` | riadok zbalený na tlačidlo |
| `6-tlacidlo-v-rohu.png` | tlačidlo presunuté do rohu |
| `7-riadok-v-rohu.png` | riadok rozbalený na novom mieste |
| `8-tip-ziarovkou.png` | tip vyvolaný žiarovkou |

Snímky majú 2312 × 1514 px (Retina, 2×).

Video je na úvodnej stránke webu v sekcii za Manifestom (`web/components/VideoDemo.js`).
Zdroj animácií a postup výroby: `web/scripts/pomocnik-issf/README.md`.

Animácie sú vykreslené po snímkach z HTML a SVG, farby a značka podľa
`ContineoMark` (lupa sa premení na bublinu reči, ako to opisuje komentár
v `app/src/components/ContineoMark.tsx`). Zvukové efekty sú z ElevenLabs.
