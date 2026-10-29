/**
 * widgetMarkdown.ts — rozklad odpovede na bloky pre widget v cudzom systéme.
 *
 * Widget ukazoval odpoveď ako holý text, takže v ISSF stálo doslovné
 * „## Ako podať žiadosť" a „**Cez klub**" (Ján 29. 10. 2026). V intranete to
 * robí `toBlocks()` z `formatText.ts` a React; skript widgetu React nemá,
 * preto tu je ten istý rozklad ako **zdrojový text v JavaScripte**, ktorý
 * `widgetScript` vloží do skriptu doslova.
 *
 * Prečo text, nie `funkcia.toString()`: preklad TypeScriptu do funkcie
 * vkladá vlastných pomocníkov (`__name` pri tsx/esbuild) a v prehliadači
 * na ISSF by funkcia spadla. Text sa nemení podľa nástroja, ktorý ho zostaví —
 * a test ho spúšťa presne tak, ako ho spustí prehliadač.
 *
 * Bezpečnosť ako v `formatText.ts`: vstupom je výstup modelu nad cudzími
 * dokumentmi, takže výsledok sú dáta a skript z nich robí uzly cez
 * `textContent`, nikdy HTML. Odkaz `[text](/cesta)` je cesta v intranete —
 * v ISSF by viedla nikam, preto z neho ostáva len text.
 *
 * Tvary sa zhodujú s `toBlocks()` (nadpisy `#`, celý tučný riadok ako
 * medzititulok, odrážky, číslovanie s číslom z textu, odsek normy `(1)`,
 * tučné `**`) — test `widgetMarkdown` porovnáva oba rozklady.
 */

export interface WidgetSegment { bold: boolean; text: string }

export type WidgetBlock =
  | { kind: "p"; segments: WidgetSegment[] }
  | { kind: "h"; level: number; segments: WidgetSegment[] }
  | { kind: "list"; numbered: boolean; items: WidgetSegment[][]; values: (number | null)[] }

/** Výraz typu funkcia `(text) => WidgetBlock[]` v ES5, bez závislostí. */
export const WIDGET_MARKDOWN_JS = String.raw`function(text){
  var BULLET=/^\s*[-*•]\s+(.*)$/, NUMBERED=/^\s*(\d+)[.)]\s+(.*)$/, NORM=/^\(\d+[a-z]?\)\s/;
  var SUB=/^\*\*(?!\s)(.+?)\*\*[:：]?$/, HEADING=/^(#{1,6})\s+(.+?)\s*#*$/, LINK=/\[([^\]\n]+)\]\((\/(?!\/)[^)\s]*)\)/;
  function inline(line){var out=[],rest=line;
    for(;;){var link=LINK.exec(rest),start=rest.indexOf('**');
      if(link&&(start===-1||link.index<start)){if(link.index>0)out.push({bold:false,text:rest.slice(0,link.index)});out.push({bold:false,text:link[1]});rest=rest.slice(link.index+link[0].length);continue}
      if(start===-1)break;
      var end=rest.indexOf('**',start+2);if(end===-1)break;
      var inner=rest.slice(start+2,end);
      if(!inner){rest=rest.slice(0,start)+rest.slice(end+2);continue}
      if(start>0)out.push({bold:false,text:rest.slice(0,start)});
      out.push({bold:true,text:inner});rest=rest.slice(end+2)}
    if(rest)out.push({bold:false,text:rest});
    return out.length?out:[{bold:false,text:''}]}
  var blocks=[],paragraph=[],list=null;
  function closeParagraph(){if(!paragraph.length)return;blocks.push({kind:'p',segments:inline(paragraph.join(' '))});paragraph=[]}
  function closeList(){if(!list)return;blocks.push({kind:'list',numbered:list.numbered,items:list.items.map(inline),values:list.values});list=null}
  var lines=String(text).split(/\r\n|\r|\n/);
  for(var i=0;i<lines.length;i++){var line=lines[i],trimmed=line.trim();
    if(!trimmed){closeParagraph();closeList();continue}
    if(NORM.test(trimmed)){closeParagraph();closeList();paragraph.push(trimmed);continue}
    var h=HEADING.exec(trimmed);
    if(h){closeParagraph();closeList();blocks.push({kind:'h',level:h[1].length,segments:inline(h[2])});continue}
    var sub=SUB.exec(trimmed);
    if(sub){closeParagraph();closeList();blocks.push({kind:'h',level:3,segments:[{bold:false,text:sub[1].replace(/[:：]\s*$/,'')}]});continue}
    var bullet=BULLET.exec(line),number=NUMBERED.exec(line);
    if(bullet||number){closeParagraph();var numbered=!!number;
      var content=(bullet?bullet[1]:number[2]).trim();
      if(list&&list.numbered!==numbered)closeList();
      if(!list)list={numbered:numbered,items:[],values:[]};
      list.items.push(content);list.values.push(number?Number(number[1]):null);continue}
    if(list&&/^\s{2,}/.test(line)){list.items[list.items.length-1]+=' '+trimmed;continue}
    closeList();paragraph.push(trimmed)}
  closeParagraph();closeList();
  return blocks}`

