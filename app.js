'use strict';
const form=document.querySelector('form'),input=document.querySelector('textarea'),log=document.querySelector('#conversation'),button=document.querySelector('button'),status=document.querySelector('#status');
function line(text,kind){const p=document.createElement('p');p.className='turn '+kind;p.textContent=text;log.append(p);log.scrollTop=log.scrollHeight;return p;}
let busy=false;
input.addEventListener('input',()=>{input.style.height='auto';input.style.height=Math.min(input.scrollHeight,140)+'px'});
input.addEventListener('keydown',e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.isComposing){e.preventDefault();form.requestSubmit()}});
form.addEventListener('submit',e=>{
 e.preventDefault();const message=input.value.trim();if(busy||!message)return;
 if(/^(sohbeti|oturumu) (bitir|kapat|sil)$/i.test(message)) { window.CognitronSession.end('explicit'); return; }
 line(message,'user');
 line('Bu gizlilik koşullarını sağlayan yerel model henüz bağlı değil. Mesajın gönderilmedi. “Cognitron hakkında” yazarak içerik penceresini açabilirsin.','interface');
 input.value='';input.style.height='auto';input.focus();
});

// Hero invariant: one available nonempty delta -> one byte packet. No synthetic idle rain.
const canvas=document.querySelector('canvas'),ctx=canvas.getContext('2d'),reduced=matchMedia('(prefers-reduced-motion: reduce)');
const matrix=new DeltaMatrix();window.CognitronMatrix=matrix;

let active=[],last=0,lastDraw=0,frame,ready=false;
const cell=18;
const glyphs=Array.from({length:73},(_,i)=>String.fromCodePoint(0x10c00+i));
function size(){const dpr=Math.min(devicePixelRatio||1,2);canvas.width=innerWidth*dpr;canvas.height=innerHeight*dpr;canvas.style.width=innerWidth+'px';canvas.style.height=innerHeight+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
function draw(now){
 frame=requestAnimationFrame(draw);
 if(now-lastDraw<1000/30)return;
 const dt=Math.min(now-last||0,64);last=now;lastDraw=now;
 if(document.hidden||reduced.matches||!ready)return;
 ctx.fillStyle='rgba(2,6,10,.08)';ctx.fillRect(0,0,innerWidth,innerHeight);
 const occupied=new Set(active.map(p=>p.column));
 const columns=Math.max(1,Math.floor(innerWidth/20));
 while(active.length<columns&&matrix.queue.length){
  const packet=matrix.spawn();
  const free=Array.from({length:columns},(_,i)=>i).filter(i=>!occupied.has(i));
  const column=free[Math.floor(packet.birth.u*free.length)];occupied.add(column);
  // Previous delta data selects both horizontal lane and vertical birth point.
  active.push({column,x:column*20+10,y:Math.floor(packet.birth.v*innerHeight*.65/cell)*cell,bytes:packet.bytes,index:0,trail:Array(Math.max(4,Math.min(40,packet.bytes.length))).fill(' '),ticks:0,done:0});
 }
 for(const p of active){
  p.ticks+=dt;
  while(p.ticks>=90){
   p.ticks-=90;p.y+=cell;
   for(let i=p.trail.length-1;i>0;i--)p.trail[i]=p.trail[i-1];
   if(p.index<p.bytes.length)p.trail[0]=glyphs[p.bytes[p.index++]%glyphs.length];
   else{p.trail[0]=' ';p.done++}
  }
  for(let i=p.trail.length-1;i>=0;i--){const y=p.y-i*cell;if(y<0||y>innerHeight+cell||p.trail[i]===' ')continue;
   ctx.font='18px Orkhun';ctx.textAlign='center';ctx.globalAlpha=i<2?1:1-Math.pow(i/p.trail.length,.7);
   ctx.fillStyle=i===0?'#c8ffea':i===1?'#6bd9ff':i<p.trail.length*.45?'#5fb8ff':'#0e4f47';
   ctx.shadowColor='#6bd9ff';ctx.shadowBlur=i===0?12:i===1?5:0;ctx.fillText(p.trail[i],p.x,y);
  }
 }
 ctx.globalAlpha=1;ctx.shadowBlur=0;
 active=active.filter(p=>p.done<p.trail.length&&p.y-p.trail.length*cell<innerHeight+40);
}
reduced.addEventListener('change',()=>ctx.clearRect(0,0,innerWidth,innerHeight));
size();document.fonts.load('18px Orkhun',glyphs.join('')).then(()=>{ready=true});
addEventListener('resize',size);frame=requestAnimationFrame(draw);addEventListener('pagehide',()=>cancelAnimationFrame(frame));
addEventListener('pageshow',e=>{if(e.persisted){cancelAnimationFrame(frame);frame=requestAnimationFrame(draw)}});

// Visitor data stays in this document. No transport, storage, transcript or telemetry.
function removeLegacyDraft(){
 // Earlier preview tooling preserved a draft under this key. Never read its value.
 for(const storage of ['localStorage','sessionStorage']){
  try{window[storage].removeItem('cognitron-preserved-message')}catch{}
 }
}
removeLegacyDraft();
form.autocomplete='off';input.autocomplete='off';input.spellcheck=false;
input.setAttribute('autocorrect','off');input.setAttribute('autocapitalize','off');
input.setAttribute('aria-description','Bu önizlemede mesajlar gönderilmez. Sekmeden ayrılınca veya beş dakika hareketsizlikte oturum temizlenir.');
window.CognitronSession = new EphemeralSession({erase:()=>{
 removeLegacyDraft();
 window.CognitronContent?.reset();
 log.replaceChildren();input.value='';input.style.height='auto';
 status.textContent='';busy=false;input.readOnly=false;button.disabled=false;
 for(const packet of active){packet.bytes.fill(0);packet.trail.fill(' ')}
 active.length=0;matrix.reset();last=0;lastDraw=0;
 ctx.clearRect(0,0,innerWidth,innerHeight);
}});
for(const name of ['pointerdown','pointermove','keydown','input','wheel','touchstart'])
 document.addEventListener(name,e=>{if(e.isTrusted&&!document.hidden)window.CognitronSession.activity()}, {capture:true,passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden)window.CognitronSession.end('hidden');else window.CognitronSession.check()});
addEventListener('pagehide',()=>window.CognitronSession.end('pagehide'));
// Conservative departure: losing window focus also ends the private session.
addEventListener('blur',()=>window.CognitronSession.end('blur'));
addEventListener('pageshow',()=>window.CognitronSession.end('pageshow'));
addEventListener('focus',()=>window.CognitronSession.check());
form.addEventListener('submit',()=>window.CognitronSession.check(),true);

/* 2026-11-12: chat-first, non-modal content window. Local intent prototype. */
(() => {
 'use strict';
 if (window.CognitronContent) return;
 const dock = document.querySelector('main');
 const form = dock.querySelector('form');
 const input = form.querySelector('textarea');
 const log = document.querySelector('#conversation');
 const panel = document.createElement('section');
 panel.id = 'content-window';
 panel.hidden = true;
 panel.setAttribute('role', 'dialog');
 panel.setAttribute('aria-modal', 'false');
 panel.setAttribute('aria-labelledby', 'content-window-title');
 panel.innerHTML = `<div class="window-bar"><div class="window-handle" tabindex="0" role="button" aria-label="İçerik penceresini taşı; ok tuşlarını kullan"><span class="window-dot" aria-hidden="true"></span><span id="content-window-title"></span></div><button type="button" class="window-close" aria-label="Pencereyi kapat">×</button></div><article class="window-body"></article><p class="window-note">Sohbet burada devam ediyor.</p>`;
 document.body.append(panel);
 const handle = panel.querySelector('.window-handle');
 const content = panel.querySelector('article');
 let drag = null, positioned = false, sequence = 0;
 function event(action) {
  const bytes = Array.from(new TextEncoder().encode(JSON.stringify({source:'web_content_window',action})));
  window.CognitronMatrix?.accept({from:'web_ui',to:'content_window',kind:'runtime',seq:++sequence,payload_size_bytes:bytes.length,available:true,bytes});
 }
 function place(x, y) {
  const rect = panel.getBoundingClientRect();
  panel.style.left = Math.max(12,Math.min(x,innerWidth-rect.width-12))+'px';
  panel.style.top = Math.max(12,Math.min(y,innerHeight-rect.height-12))+'px';
 }
 function initialPosition() {
  const dockRect = dock.getBoundingClientRect();
  place(dockRect.left > panel.offsetWidth+48 ? (dockRect.left-panel.offsetWidth)/2 : 24,
        Math.max(116,(innerHeight-panel.offsetHeight)/2));
 }
 function open() {
  panel.querySelector('#content-window-title').textContent = 'Cognitron hakkında';
  content.replaceChildren();
  const eyebrow = document.createElement('p'); eyebrow.className='window-eyebrow'; eyebrow.textContent='COGNITRON';
  const title = document.createElement('h1'); title.textContent='Bir sohbetle başlar.';
  const lead = document.createElement('p'); lead.className='window-lead'; lead.textContent='Merak ettiğin yerden başlayalım.';
  const body = document.createElement('p'); body.textContent='Sorularını sor, görmek istediğin içeriği söyle. Sohbetimiz devam ederken içerik yanında açılır.';
  const hint = document.createElement('p'); hint.className='window-hint'; hint.textContent='“Pencereyi sağa taşı” veya “pencereyi kapat” diyebilirsin.';
  content.append(eyebrow,title,lead,body,hint);
  panel.hidden=false;
  if (!positioned) { initialPosition(); positioned=true; }
  else { const r=panel.getBoundingClientRect(); place(r.x,r.y); }
  event('open:about');
 }
 function close() {
  if(panel.hidden) return;
  panel.hidden=true;
  drag=null;
  input.focus({preventScroll:true});
  event('close');
 }
 const normalize = text => text.toLocaleLowerCase('tr-TR').normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/ı/g,'i').replace(/[’']/g,'').replace(/[.!?,]/g,'').replace(/\s+/g,' ').trim();
 function intent(text) {
  const s=normalize(text);
  if (/^(?:lutfen )?(?:cognitron hakkinda|hakkimizda)(?: (?:bilgi ver|goster|ac|anlat|sayfasini ac))?(?: lutfen)?$/.test(s)) return 'about';
  if (/^(?:lutfen )?(?:pencereyi|icerigi|popupi|pop-upi) kapat(?: lutfen)?$/.test(s)) return 'close';
  if (/^(?:pencereyi|icerigi) (sola|saga|ortaya) (?:tasi|al)$/.test(s)) return s.includes('sola')?'left':s.includes('saga')?'right':'center';
  if (/^(?:neler gosterebilirsin|icerikleri goster|sayfada ne var)$/.test(s)) return 'help';
  return null;
 }
 function execute(command) {
  if(command==='about') {open();return 'Cognitron hakkında içeriğini açtım. Buradan konuşmaya devam edebiliriz.';}
  if(command==='help') return '“Cognitron hakkında göster” diyerek başlayabilirsin. Açılan pencereyi sohbetten taşıyabilir veya kapatabilirsin.';
  if(command==='close') {const wasOpen=!panel.hidden;close();return wasOpen?'Pencereyi kapattım.':'Şu anda açık bir içerik penceresi yok.';}
  if(panel.hidden) return 'Önce “Cognitron hakkında göster” diyerek bir içerik açabilirsin.';
  const r=panel.getBoundingClientRect();
  place(command==='left'?24:command==='right'?innerWidth-r.width-24:(innerWidth-r.width)/2,r.y);
  event('move:'+command);
  return 'Pencereyi taşıdım.';
 }
 form.addEventListener('submit', e => {
  const message=input.value.trim(),command=intent(message);
  if(!command || input.readOnly || form.querySelector('button').disabled) return;
  e.preventDefault();e.stopImmediatePropagation();
  const response=execute(command);
  for(const [text,kind] of [[message,'user'],[response,'interface']]) {
   const p=document.createElement('p');p.className='turn '+kind;p.textContent=text;
   if(kind==='interface') p.setAttribute('aria-label','Sayfa yanıtı');
   log.append(p);
  }
  input.value='';input.style.height='auto';log.scrollTop=log.scrollHeight;input.focus({preventScroll:true});
 },true);
 handle.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  const r=panel.getBoundingClientRect();drag={id:e.pointerId,x:e.clientX-r.x,y:e.clientY-r.y,startX:r.x,startY:r.y};
  handle.setPointerCapture(e.pointerId);panel.classList.add('dragging');
 });
 handle.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId)place(e.clientX-drag.x,e.clientY-drag.y)});
 function endDrag(e) {
  if(drag?.id!==e.pointerId)return;
  const r=panel.getBoundingClientRect(),moved=r.x!==drag.startX||r.y!==drag.startY;
  drag=null;panel.classList.remove('dragging');
  if(moved)event('move:drag');
 }
 for(const type of ['pointerup','pointercancel','lostpointercapture'])handle.addEventListener(type,endDrag);
 handle.addEventListener('keydown',e=>{
  const vector={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];
  if(!vector)return;e.preventDefault();const r=panel.getBoundingClientRect(),step=e.shiftKey?40:12;
  place(r.x+vector[0]*step,r.y+vector[1]*step);event('move:keyboard');
 });
 panel.querySelector('.window-close').addEventListener('click',close);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing&&!panel.hidden){e.preventDefault();close()}});
 addEventListener('resize',()=>{if(!panel.hidden){const r=panel.getBoundingClientRect();place(r.x,r.y)}});
 function reset() {
  if(drag && handle.hasPointerCapture(drag.id))handle.releasePointerCapture(drag.id);
  drag=null;positioned=false;sequence=0;panel.hidden=true;
  panel.classList.remove('dragging');panel.style.left='';panel.style.top='';
  content.replaceChildren();panel.querySelector('#content-window-title').textContent='';
 }
 window.CognitronContent=Object.freeze({open,close,intent,reset});
})();
