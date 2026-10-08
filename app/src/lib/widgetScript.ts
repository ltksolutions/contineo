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
 */

export interface WidgetScriptConfig {
  apiBase: string
  channel: string
  accent: string
  texts: Record<string, string>
  language: string
  /** Komu sa ozvať, keď widget nefunguje (kanál, inak kontakt organizácie). */
  contact: string | null
}

export function widgetScript(cfg: WidgetScriptConfig): string {
  const config = JSON.stringify(cfg)
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
':host{all:initial;font:15px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;color:#1f2937;--accent:'+CFG.accent+'}',
'*{box-sizing:border-box}',
'.fab{position:fixed;right:16px;bottom:16px;z-index:2147483000;min-height:44px;padding:0 18px;border:0;border-radius:22px;background:var(--accent);color:#fff;font:inherit;font-weight:600;cursor:pointer;box-shadow:0 6px 20px rgba(0,0,0,.18)}',
'.panel{position:fixed;right:16px;bottom:72px;z-index:2147483000;width:min(400px,calc(100vw - 32px));height:min(600px,calc(100vh - 100px));display:none;flex-direction:column;background:#fff;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.22);overflow:hidden}',
'.panel.is-open{display:flex}',
'@media (max-width:640px){.panel{right:0;bottom:0;width:100vw;height:100vh;border-radius:0}}',
'.head{display:flex;align-items:center;gap:10px;padding:12px 14px;background:var(--accent);color:#fff;font-weight:600}',
'.head button{margin-left:auto;background:transparent;border:0;color:#fff;font-size:22px;line-height:1;cursor:pointer;min-width:44px;min-height:44px}',
'.log{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:10px;background:#f6f7f9}',
'.msg{max-width:92%;padding:10px 12px;border-radius:12px;white-space:pre-wrap;word-wrap:break-word}',
'.msg.q{align-self:flex-end;background:var(--accent);color:#fff}',
'.msg.a{align-self:flex-start;background:#fff;border:1px solid #e5e7eb}',
'.msg.sys{align-self:center;background:transparent;color:#6b7280;font-size:13px;text-align:center}',
'.src{font-size:13px;color:#4b5563;margin-top:8px}.src ul{margin:4px 0 0;padding-left:18px}',
'.rate{display:flex;gap:8px;margin-top:8px}.rate button{min-height:36px;padding:0 12px;border:1px solid #d1d5db;border-radius:18px;background:#fff;font:inherit;font-size:13px;cursor:pointer}.rate button.is-on{border-color:var(--accent);color:var(--accent)}',
'form.ask{display:flex;gap:8px;padding:10px;border-top:1px solid #e5e7eb;background:#fff}',
'textarea,input{flex:1;font:inherit;padding:10px;border:1px solid #d1d5db;border-radius:10px;resize:none;min-height:44px}',
'.btn{min-height:44px;padding:0 14px;border:0;border-radius:10px;background:var(--accent);color:#fff;font:inherit;font-weight:600;cursor:pointer}.btn:disabled{opacity:.6}',
'.btn.quiet{background:#fff;color:var(--accent);border:1px solid var(--accent)}',
'.esc{padding:12px;border-top:1px solid #e5e7eb;background:#fff;display:none;flex-direction:column;gap:8px}.esc.is-open{display:flex}',
'.foot{font-size:11px;color:#9ca3af;text-align:center;padding:4px}',
'.msg.sys a{color:var(--accent)}'
].join('');
root.appendChild(style);

var fab=el('button','fab',T.open);fab.type='button';
var panel=el('div','panel');
var head=el('div','head',T.title);var close=el('button',null,'×');close.type='button';close.setAttribute('aria-label','close');head.appendChild(close);
var log=el('div','log');
var form=el('form','ask');var ta=el('textarea');ta.placeholder=T.placeholder;ta.rows=1;ta.required=true;var send=el('button','btn',T.send);send.type='submit';form.appendChild(ta);form.appendChild(send);
var esc=el('div','esc');var escIntro=el('div',null,T.escalateIntro);var escTa=el('textarea');escTa.placeholder=T.escalateMessage;escTa.rows=3;var escBtn=el('button','btn',T.escalateSubmit);escBtn.type='button';esc.appendChild(escIntro);esc.appendChild(escTa);esc.appendChild(escBtn);
var foot=el('div','foot',T.poweredBy);
panel.appendChild(head);panel.appendChild(log);panel.appendChild(esc);panel.appendChild(form);panel.appendChild(foot);
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
  busy=true;send.disabled=true;
  log.appendChild(el('div','msg q',q));
  var a=el('div','msg a');var body=el('div');a.appendChild(body);log.appendChild(a);
  var thinking=sys(T.thinking);
  var text='',sources=[],recordId=null,gotDone=false;
  api('chat',{query:q,language:CFG.language}).then(function(r){
    if(!r.ok||!r.body){throw new Error(r.status===429?'rate':'http')}
    var reader=r.body.getReader(),dec=new TextDecoder(),buf='';
    function pump(){return reader.read().then(function(res){
      if(res.done)return;
      buf+=dec.decode(res.value,{stream:true});
      var parts=buf.split('\\n\\n');buf=parts.pop()||'';
      parts.forEach(function(p){var line=p.split('\\n').filter(function(l){return l.indexOf('data: ')===0})[0];if(!line)return;var ev;try{ev=JSON.parse(line.slice(6))}catch(e){return}
        if(ev.type==='token'){text+=ev.token;body.textContent=text;thinking.remove();log.scrollTop=log.scrollHeight}
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
  }).catch(function(e){thinking.remove();body.textContent=e&&e.message==='expired'?T.expired:(e&&e.message==='rate'?(T.rateLimited||T.error):T.error);if(!e||e.message!=='rate')contact()}).then(function(){busy=false;send.disabled=false;log.scrollTop=log.scrollHeight});
}

form.addEventListener('submit',function(ev){ev.preventDefault();var q=ta.value.trim();if(!q||busy)return;ta.value='';ask(q)});
ta.addEventListener('keydown',function(ev){if(ev.key==='Enter'&&!ev.shiftKey){ev.preventDefault();form.dispatchEvent(new Event('submit',{cancelable:true}))}});
escBtn.addEventListener('click',function(){var m=escTa.value.trim();if(!m)return;escBtn.disabled=true;
  api('ticket',{message:m,conversation:conversation.map(function(c){return {recordId:c.recordId,question:c.question,verdict:c.verdict}})}).then(function(r){if(!r.ok)throw new Error('http');esc.classList.remove('is-open');escTa.value='';sys(T.escalated);negatives=0}).catch(function(e){sys(e&&e.message==='expired'?T.expired:T.error);contact()}).then(function(){escBtn.disabled=false})});
})();`
}
