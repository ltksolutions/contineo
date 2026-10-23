/**
 * widgetScript.ts — skript widgetu pre cudzí systém (ADR-028, D166).
 *
 * Jeden súbor bez závislostí, ktorý si ISSF vloží značkou `<script>`.
 * Vykreslí plávajúce tlačidlo a panel v Shadow DOM (štýly ISSF naň nesiahnu
 * a naopak), otázku pošle na `/api/widget/<kanál>/chat` s tokenom, odpoveď
 * číta po kúskoch (SSE), ukáže zdroje a palce; po **dvoch** negatívnych
 * hodnoteniach v rozhovore ponúkne ticket (D166). Token berie z atribútu
 * `data-token`, pri vypršaní si vyžiada nový z `data-token-url` (adresa na
 * strane ISSF, rovnaký pôvod ako stránka).
 *
 * Texty prichádzajú zo servera podľa jazyka kanála (`dictionary().widget`),
 * farba z brandingu organizácie — web ostáva webom, farba je organizácie
 * (CLAUDE.md).
 *
 * **Design system v Shadow DOM** (KANAL-widget-zdroje, 23. 10. 2026):
 * `globals.css` sa do widgetu nedostane, preto sú tokeny (`WIDGET_TOKENS`)
 * a pravidlá `.button*`, `.form-row*`, `.select-row`, `.lnote*` prenesené
 * doslova. Menia sa len spolu s `globals.css` — test `widgetTokens` porovná
 * hodnoty tokenov s `:root`.
 *
 * **Výber zdrojov:** pás pod hlavičkou „Zdroje: Knižnica, Sportnet
 * dokumentácia ▾" (vždy vymenované), rozbalí sa v paneli. Zmena nič
 * nespúšťa — výber ide s ďalšou otázkou. Hlavičku odpovede skladá server
 * (udalosť `scope`), skript ju len vypíše.
 */

/** Svetlé tokeny z `:root` v `globals.css` — widget tmavú tému nemá. */
export const WIDGET_TOKENS: Record<string, string> = {
  "--bg": "#f5f6f8",
  "--surface": "#ffffff",
  "--surface-2": "#eceef1",
  "--ink": "#161b22",
  "--muted": "#5c6675",
  "--line": "rgba(20, 28, 42, 0.12)",
  "--line-strong": "rgba(20, 28, 42, 0.18)",
  "--control-line": "rgba(20, 28, 42, 0.42)",
  "--on-accent": "#ffffff",
  "--ok-bg": "#ecfdf5",
  "--ok-fg": "#047857",
  "--fs-small": "13px",
  "--control-h": "40px",
}

export interface WidgetScriptConfig {
  apiBase: string
  channel: string
  accent: string
  texts: Record<string, string>
  language: string
  /** Komu sa ozvať, keď widget nefunguje (kanál, inak kontakt organizácie). */
  contact: string | null
  /** Hover plného tlačidla (`--accent-strong`). */
  accentStrong?: string
  /** Povolené zdroje kanála; pri jedinom sa výber nekreslí. */
  sources?: { id: string; name: string; sub: string }[]
}

export function widgetScript(cfg: WidgetScriptConfig): string {
  const config = JSON.stringify(cfg)
  const tokens = Object.entries(WIDGET_TOKENS).map(([k, v]) => `${k}:${v}`).join(";")
  return `(function(){
"use strict";
var CFG=${config};
var T=CFG.texts;
var script=document.currentScript||(function(){var s=document.querySelectorAll('script[data-token]');return s[s.length-1]})();
var token=script&&script.getAttribute('data-token')||'';
var tokenUrl=script&&script.getAttribute('data-token-url')||'';
var negatives=0, conversation=[], busy=false;

function el(tag,cls,text){var e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=text;return e}
function esc(s){return String(s)}

var host=el('div');host.setAttribute('data-contineo-helpdesk','');
var root=host.attachShadow({mode:'open'});
var style=document.createElement('style');
style.textContent=[
':host{all:initial;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:var(--ink);${tokens};--accent:'+CFG.accent+';--accent-strong:'+(CFG.accentStrong||CFG.accent)+'}',
'*{box-sizing:border-box}',
/* \`hidden\` musí vyhrať nad display z tried (.lnote, .a-head) — oznam a hlavička sa skrývajú atribútom. */
'[hidden]{display:none!important}',
'.fab{position:fixed;right:16px;bottom:16px;z-index:2147483000;min-height:44px;padding:0 18px;border:0;border-radius:22px;background:var(--accent);color:var(--on-accent);font:inherit;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18)}',
'.panel{position:fixed;right:16px;bottom:72px;z-index:2147483000;width:min(400px,calc(100vw - 32px));height:min(600px,calc(100vh - 100px));display:none;flex-direction:column;background:var(--surface);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden}',
'.panel.is-open{display:flex}',
'@media (max-width:640px){.panel{right:0;bottom:0;width:100vw;height:100vh;border-radius:0}}',
'.head{display:flex;align-items:center;gap:10px;padding:0 0 0 14px;min-height:52px;background:var(--accent);color:var(--on-accent);font-weight:600}',
'.head button{margin-left:auto;background:transparent;border:0;color:var(--on-accent);font-size:22px;line-height:1;cursor:pointer;min-width:44px;min-height:44px}',
/* Prenesené z globals.css: tlačidlá (W1 — .btn nahradené .button). */
'.button{display:inline-flex;align-items:center;justify-content:center;gap:8px;background:var(--accent);color:var(--on-accent);border:1px solid var(--accent);border-radius:10px;min-height:44px;padding:0 18px;font:inherit;font-size:15px;font-weight:600;line-height:1.2;cursor:pointer;transition:background .15s ease;text-decoration:none}',
'.button:hover:not(:disabled){background:var(--accent-strong)}',
'.button:focus-visible{outline:2px solid var(--accent);outline-offset:2px}',
'.button--quiet{background:var(--surface);color:var(--ink);border-color:var(--line-strong)}',
'.button--quiet:hover:not(:disabled){background:var(--surface-2)}',
'.button--sm{padding:0 14px;font-size:var(--fs-small)}',
'.button:disabled{opacity:.5;cursor:not-allowed}',
/* Pás zdrojov a výber v paneli (Q1 A). Terč 44 px na všetkých šírkach. */
'.scope{border-bottom:1px solid var(--line);background:var(--surface)}',
'.scope-bar{display:flex;padding:6px 10px}',
'.scope-bar .button{max-width:100%;justify-content:flex-start;gap:6px}',
'.scope-val{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}',
'.scope-pane{display:grid;gap:8px;padding:0 10px 12px}',
'.scope-pane[hidden]{display:none}',
'.scope-card{border:1px solid var(--line);border-radius:10px;background:var(--surface);overflow:hidden}',
'.scope-foot{display:flex;align-items:center;gap:10px}',
'.scope-foot p{flex:1;margin:0;font-size:12.5px;color:var(--muted)}',
/* Prenesené z globals.css: riadky výberu. */
'.form-list{display:grid;min-width:0;clip-path:inset(1px 0 0 0)}',
'.form-row{position:relative;display:flex;align-items:center;gap:12px;min-height:44px;padding:9px 16px;margin:0;font-size:15px;line-height:1.35;color:var(--ink);cursor:pointer;overflow-wrap:anywhere}',
'.form-row+.form-row::before{content:"";position:absolute;top:0;left:16px;right:0;border-top:1px solid var(--line)}',
'.select-row+.select-row::before{left:50px}',
'.form-row:hover{background:var(--surface-2)}',
'.form-row:has(> input:focus-visible){outline:2px solid var(--accent);outline-offset:-2px}',
'.form-row>input{appearance:none;-webkit-appearance:none;flex:none;margin:0;cursor:pointer;display:grid;place-items:center;font:inherit;color:inherit}',
'.form-row>input:focus-visible{outline:none}',
'.form-row:has(> input:disabled){cursor:default;opacity:.5}',
'.form-row-main{flex:1 1 auto;min-width:0;display:grid;gap:1px}',
'.form-row-sub{font-size:12.5px;color:var(--muted)}',
'.select-row>input{width:22px;height:22px;border-radius:50%;border:1.5px solid var(--control-line)}',
'.select-row>input:checked{background:var(--accent);border-color:var(--accent)}',
'.select-row>input:checked::after{content:"";width:6px;height:11px;border:solid var(--on-accent);border-width:0 2.2px 2.2px 0;transform:translateY(-1px) rotate(45deg)}',
'.log{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:var(--bg)}',
'.msg{max-width:92%;padding:10px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}',
'.msg.q{align-self:flex-end;background:var(--accent);color:var(--on-accent)}',
'.msg.a{align-self:flex-start;background:var(--surface);border:1px solid var(--line)}',
'.msg.sys{align-self:center;background:transparent;color:var(--muted);font-size:13px;text-align:center}',
/* Hlavička odpovede (W4 — lokálne, bez značky a času). */
'.a-head{display:block;font-size:12.5px;font-weight:600;color:var(--muted);margin:0 0 4px;white-space:normal}',
'.src{font-size:13px;color:var(--muted);margin-top:8px;white-space:normal}.src ul{margin:4px 0 0;padding-left:18px}',
/* W5: palce 44 px. */
'.rate{display:flex;gap:8px;margin-top:8px}.rate button{min-height:44px;padding:0 14px;border:1px solid var(--line-strong);border-radius:22px;background:var(--surface);color:var(--ink);font:inherit;font-size:13px;cursor:pointer}.rate button.is-on{border-color:var(--accent);color:var(--accent)}',
/* Prenesené z globals.css: hláška (+ .lnote--action, W2). */
'.lnote{display:flex;gap:9px;align-items:flex-start;padding:10px 12px;border-radius:9px;background:var(--ok-bg);border:1px solid var(--line)}',
'.lnote-mark{display:grid;place-items:center;width:20px;height:20px;border-radius:50%;flex:0 0 auto;font-weight:800;font-size:12px;background:var(--ok-bg);color:var(--ok-fg)}',
'.lnote-text{font-size:13px;color:var(--ok-fg);line-height:1.45}',
'.lnote--info{background:var(--surface)}',
'.lnote--info .lnote-mark{background:var(--surface-2);color:var(--ink)}',
'.lnote--info .lnote-text{color:var(--ink)}',
'.lnote--action{align-items:center;flex-wrap:wrap;max-width:92%;align-self:flex-start}',
'.lnote--action .lnote-text{flex:1 1 180px}',
'form.ask{display:flex;gap:8px;padding:10px;border-top:1px solid var(--line);background:var(--surface)}',
/* Len textové polia — checkbox výberu zdrojov nesmie zdediť padding ani flex. */
'textarea{flex:1;font:inherit;color:var(--ink);background:var(--surface);padding:10px;border:1px solid var(--control-line);border-radius:10px;resize:none;min-height:44px}',
'.esc{padding:12px;border-top:1px solid var(--line);background:var(--surface);display:none;flex-direction:column;gap:8px}.esc.is-open{display:flex}',
'.foot{font-size:11px;color:var(--muted);text-align:center;padding:4px;background:var(--surface)}',
'.msg.sys a{color:var(--accent)}'
].join('');
root.appendChild(style);

var fab=el('button','fab',T.open);fab.type='button';
var panel=el('div','panel');
var head=el('div','head',T.title);var close=el('button',null,'×');close.type='button';close.setAttribute('aria-label','close');head.appendChild(close);
var log=el('div','log');
/* Výber zdrojov (KANAL-widget-zdroje): predvolene všetky povolené (Q3), platí
   počas otvoreného panela (Q5). Pri jedinom zdroji sa nekreslí. */
var SRC=CFG.sources||[];
var on=SRC.map(function(x){return x.id});
var last={question:null,ids:null,from:'',answer:null,note:null};
var scope=null,scopeBtn=null,scopeVal=null,pane=null,boxes=[],hint=null;
function names(ids){return SRC.filter(function(x){return ids.indexOf(x.id)>=0}).map(function(x){return x.name}).join(', ')}
function same(a,b){return a.length===b.length&&a.every(function(x){return b.indexOf(x)>=0})}
if(SRC.length>1){
  scope=el('div','scope');
  var bar=el('div','scope-bar');
  scopeBtn=el('button','button button--quiet button--sm');scopeBtn.type='button';scopeBtn.setAttribute('aria-expanded','false');scopeBtn.setAttribute('aria-controls','scope-pane');
  scopeVal=el('span','scope-val');var arrow=el('span',null,'\u25be');arrow.setAttribute('aria-hidden','true');
  scopeBtn.appendChild(scopeVal);scopeBtn.appendChild(arrow);bar.appendChild(scopeBtn);
  pane=el('div','scope-pane');pane.id='scope-pane';pane.setAttribute('role','group');pane.setAttribute('aria-label',T.scopeLabel);pane.hidden=true;
  var card=el('div','scope-card form-list');
  SRC.forEach(function(x){var row=el('label','form-row select-row');var cb=el('input');cb.type='checkbox';cb.value=x.id;cb.checked=true;
    var main=el('span','form-row-main');main.appendChild(el('span',null,x.name));main.appendChild(el('span','form-row-sub',x.sub));
    row.appendChild(cb);row.appendChild(main);card.appendChild(row);boxes.push(cb)});
  var sf=el('div','scope-foot');hint=el('p');var done=el('button','button button--quiet',T.scopeDone);done.type='button';sf.appendChild(hint);sf.appendChild(done);
  pane.appendChild(card);pane.appendChild(sf);scope.appendChild(bar);scope.appendChild(pane);
  var setOpen=function(o){pane.hidden=!o;scopeBtn.setAttribute('aria-expanded',String(o));if(o&&boxes[0])boxes[0].focus({preventScroll:true})};
  scopeBtn.addEventListener('click',function(){setOpen(pane.hidden)});
  done.addEventListener('click',function(){setOpen(false);scopeBtn.focus()});
  pane.addEventListener('keydown',function(e){if(e.key==='Escape'){setOpen(false);scopeBtn.focus()}});
  boxes.forEach(function(cb){cb.addEventListener('change',syncScope)});
}
/* Posledný zapnutý riadok sa zamkne — výber nesmie byť prázdny (bod 3). */
function syncScope(){
  if(!scope)return;
  on=boxes.filter(function(b){return b.checked}).map(function(b){return b.value});
  var label=T.scopeButton.replace('{names}',names(on));
  scopeVal.textContent=label;scopeBtn.setAttribute('aria-label',label);
  boxes.forEach(function(b){b.disabled=b.checked&&on.length===1});
  hint.textContent=on.length===1?T.scopeLast+' '+T.scopeHint:T.scopeHint;
  syncNote();
}
/* Oznam pri poslednej odpovedi (Q2 A): výber ≠ jej zdroje. */
function syncNote(){
  if(!last.note)return;
  last.note.hidden=!last.ids||same(on,last.ids);
}
var form=el('form','ask');var ta=el('textarea');ta.placeholder=T.placeholder;ta.rows=1;ta.required=true;var send=el('button','button',T.send);send.type='submit';form.appendChild(ta);form.appendChild(send);
var esc=el('div','esc');var escIntro=el('div',null,T.escalateIntro);var escTa=el('textarea');escTa.placeholder=T.escalateMessage;escTa.rows=3;var escBtn=el('button','button',T.escalateSubmit);escBtn.type='button';esc.appendChild(escIntro);esc.appendChild(escTa);esc.appendChild(escBtn);
var foot=el('div','foot',T.poweredBy);
panel.appendChild(head);if(scope)panel.appendChild(scope);panel.appendChild(log);panel.appendChild(esc);panel.appendChild(form);panel.appendChild(foot);
root.appendChild(fab);root.appendChild(panel);
document.body.appendChild(host);

fab.addEventListener('click',function(){panel.classList.toggle('is-open');if(panel.classList.contains('is-open'))ta.focus()});
close.addEventListener('click',function(){panel.classList.remove('is-open')});

function sys(text){var m=el('div','msg sys',text);log.appendChild(m);log.scrollTop=log.scrollHeight;return m}
var contactShown=false;
function contact(){if(contactShown||!CFG.contact)return;contactShown=true;var m=el('div','msg sys');m.appendChild(document.createTextNode(T.contact+' '));var a=el('a',null,CFG.contact);a.href='mailto:'+CFG.contact;m.appendChild(a);log.appendChild(m);log.scrollTop=log.scrollHeight}

function refreshToken(){
  if(!tokenUrl)return Promise.resolve(false);
  return fetch(tokenUrl,{credentials:'same-origin'}).then(function(r){return r.ok?r.text():''}).then(function(t){t=(t||'').trim();if(t){try{var j=JSON.parse(t);t=j.token||t}catch(e){}token=t;return true}return false}).catch(function(){return false});
}

function api(path,body,retry){
  return fetch(CFG.apiBase+'/api/widget/'+encodeURIComponent(CFG.channel)+'/'+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(Object.assign({token:token},body))}).then(function(r){
    if(r.status===401&&!retry){return refreshToken().then(function(ok){if(ok)return api(path,body,true);throw new Error('expired')})}
    return r;
  });
}

function offerEscalation(){esc.classList.add('is-open');escTa.focus()}

function rateButtons(recordId,answerEl){
  var rate=el('div','rate');var up=el('button',null,T.helpful);up.type='button';var down=el('button',null,T.notHelpful);down.type='button';
  function pick(v){up.classList.toggle('is-on',v===1);down.classList.toggle('is-on',v===0);up.disabled=down.disabled=true;
    conversation.forEach(function(c){if(c.recordId===recordId)c.verdict=v});
    api('feedback',{id:recordId,verdict:v}).catch(function(){});
    if(v===0){negatives++;if(negatives>=2){sys(T.tryAgain);offerEscalation()}}else{sys(T.thanks)}}
  up.addEventListener('click',function(){pick(1)});down.addEventListener('click',function(){pick(0)});
  rate.appendChild(up);rate.appendChild(down);answerEl.appendChild(rate);
}

function ask(q){
  busy=true;send.disabled=true;if(scopeBtn)scopeBtn.disabled=true;
  if(last.note){last.note.remove();last.note=null}
  log.appendChild(el('div','msg q',q));
  var a=el('div','msg a');var aHead=el('span','a-head');aHead.hidden=true;var body=el('div');a.appendChild(aHead);a.appendChild(body);log.appendChild(a);
  var ran=null;
  var thinking=sys(T.thinking);
  var text='',sources=[],recordId=null,gotDone=false;
  api('chat',{query:q,language:CFG.language,sources:on.slice()}).then(function(r){
    if(!r.ok||!r.body){throw new Error(r.status===429?'rate':'http')}
    var reader=r.body.getReader(),dec=new TextDecoder(),buf='';
    function pump(){return reader.read().then(function(res){
      if(res.done)return;
      buf+=dec.decode(res.value,{stream:true});
      var parts=buf.split('\\n\\n');buf=parts.pop()||'';
      parts.forEach(function(p){var line=p.split('\\n').filter(function(l){return l.indexOf('data: ')===0})[0];if(!line)return;var ev;try{ev=JSON.parse(line.slice(6))}catch(e){return}
        if(ev.type==='scope'){ran=ev;aHead.textContent=ev.kicker||'';aHead.hidden=!ev.kicker}
        else if(ev.type==='token'){text+=ev.token;body.textContent=text;thinking.remove();log.scrollTop=log.scrollHeight}
        else if(ev.type==='done'){gotDone=true;sources=ev.sources||[]}
        else if(ev.type==='recorded'){recordId=ev.id}
        else if(ev.type==='error'){text=text||T.error;body.textContent=text}
      });
      return pump();
    })}
    return pump();
  }).then(function(){
    thinking.remove();
    if(!text.trim()||!sources.length){body.textContent=T.noAnswer;negatives++;conversation.push({recordId:null,question:q,verdict:0});if(negatives>=2)offerEscalation();return}
    if(sources.length){var s=el('div','src',T.sources);var ul=el('ul');var seen={};sources.forEach(function(x){var k=(x.title||'')+'|'+(x.articleRef||'');if(seen[k])return;seen[k]=1;var li=el('li',null,(x.title||'')+(x.articleRef?' ('+x.articleRef+')':''));ul.appendChild(li)});s.appendChild(ul);a.appendChild(s)}
    conversation.push({recordId:recordId,question:q,verdict:null});
    if(recordId)rateButtons(recordId,a);
    if(ran&&scope){
      last={question:q,ids:ran.ids||[],from:ran.from||'',answer:a,note:null};
      var n=el('div','lnote lnote--info lnote--action');n.setAttribute('role','status');
      var mk=el('span','lnote-mark','!');mk.setAttribute('aria-hidden','true');
      var only=last.ids.length===1;
      var nt=el('span','lnote-text',(only?T.scopeChangedOnly:T.scopeChanged).replace('{from}',last.from));
      var rb=el('button','button button--quiet button--sm',T.reask);rb.type='button';
      rb.addEventListener('click',function(){if(!busy)ask(last.question)});
      n.appendChild(mk);n.appendChild(nt);n.appendChild(rb);a.insertAdjacentElement('afterend',n);last.note=n;syncNote();
    }
  }).catch(function(e){thinking.remove();body.textContent=e&&e.message==='expired'?T.expired:(e&&e.message==='rate'?(T.rateLimited||T.error):T.error);if(!e||e.message!=='rate')contact()}).then(function(){busy=false;send.disabled=false;if(scopeBtn)scopeBtn.disabled=false;log.scrollTop=log.scrollHeight});
}
syncScope();

form.addEventListener('submit',function(ev){ev.preventDefault();var q=ta.value.trim();if(!q||busy)return;ta.value='';ask(q)});
ta.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();form.dispatchEvent(new Event('submit',{cancelable:true}))}});
escBtn.addEventListener('click',function(){var m=escTa.value.trim();if(!m)return;escBtn.disabled=true;
  api('ticket',{message:m,conversation:conversation.map(function(c){return {recordId:c.recordId,question:c.question,verdict:c.verdict}})}).then(function(r){if(!r.ok)throw new Error('http');esc.classList.remove('is-open');escTa.value='';sys(T.escalated);negatives=0}).catch(function(e){sys(e&&e.message==='expired'?T.expired:T.error);contact()}).then(function(){escBtn.disabled=false})});
})();`
}
