import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, collection, doc, getDoc, setDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getMessaging, getToken, onMessage, isSupported } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging.js";

// Configuração do projeto Firebase acompanhamento-mutirao2026
const firebaseConfig = {
  apiKey: "AIzaSyBjIU_1ma0PP1B9yUskaP2FOr9pairwUv0",
  authDomain: "acompanhamento-mutirao2026.firebaseapp.com",
  projectId: "acompanhamento-mutirao2026",
  storageBucket: "acompanhamento-mutirao2026.firebasestorage.app",
  messagingSenderId: "922912359615",
  appId: "1:922912359615:web:827762540abba6c52f720a"
};

// App instalável (PWA) e avisos por notificação
const standalone=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;
const isIOS=/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const el=id=>document.getElementById(id);
const syncInst=()=>{el('inst').hidden=el('instBtn').hidden&&el('pushBtn').hidden&&!el('pushMsg').textContent};
let installPrompt=null;
if(!standalone){
  addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;el('instBtn').hidden=false;syncInst()});
  if(isIOS){el('instBtn').hidden=false;syncInst()}
}
addEventListener('appinstalled',()=>{el('instBtn').hidden=true;el('instTip').hidden=true;syncInst()});
el('instBtn').onclick=async()=>{
  if(installPrompt){
    installPrompt.prompt();
    const r=await installPrompt.userChoice;installPrompt=null;
    if(r.outcome==='accepted'){el('instBtn').hidden=true;syncInst()}
  }else if(isIOS){
    const t=el('instTip');t.hidden=!t.hidden;
    el('instBtn').setAttribute('aria-expanded',String(!t.hidden));
  }
};
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js').catch(()=>{});

const TEAMS=[{id:'azul',nome:'Azul',letras:'A–H',emoji:'🔵'},{id:'laranja',nome:'Laranja',letras:'I–P e Y',emoji:'🟠'},{id:'verde',nome:'Verde',letras:'Q–Z (exceto Y)',emoji:'🟢'}];
const $=id=>document.getElementById(id);
const fmt=n=>Number(n||0).toLocaleString('pt-BR',{maximumFractionDigits:1});
const esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
// lider: a conta logada está na lista da liderança (checado nas regras do Firestore)
let db=null,auth=null,signedIn=false,lider=false,acessoChecado=false,parciais=[],viewId=null,editing=false,loaded=false;
let sabado=null,sabLoaded=false,sabErro=false,sabEditing=false;

function isClosed(it,ref){return it.prazo&&new Date(it.prazo)<ref}
function prazoTxt(it,ref){
  if(!it.prazo)return{t:'',c:''};
  const d=new Date(it.prazo);
  const dd=d.toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'});
  const hh=d.getHours()+'h'+(d.getMinutes()?String(d.getMinutes()).padStart(2,'0'):'');
  if(d<ref)return{t:'Encerrada em '+dd,c:'closed'};
  const days=Math.ceil((d-ref)/864e5);
  return{t:'Até '+dd+', '+hh+(days<=14?' · faltam '+days+(days===1?' dia':' dias'):''),c:days<=14?'soon':''};
}
const current=()=>parciais.find(p=>p.id===viewId)||parciais[0];

function render(){
  const p=current();
  $('editBtn').hidden=!lider||editing;
  renderAuth();renderSabado();renderPix();renderSeteme();setupAvisos();
  if(!p){
    $('sub').textContent=!db?'Configuração do Firebase pendente.':loaded?'Nenhuma parcial publicada ainda.':'Carregando dados…';
    $('board').innerHTML='';$('foot').textContent='';
    $('list').innerHTML=lider&&loaded?'<div class="empty">Toque em “Atualizar dados” para lançar a primeira parcial.</div>':'';
    $('sel').hidden=true;return;
  }
  const ref=new Date();
  const dt=new Date(p.data+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'long',year:'numeric'});
  const upd=p.atualizadoEm?'Atualizado em '+new Date(p.atualizadoEm).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'}):'';
  $('sub').innerHTML=`<span class="pill"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg><span><strong>${esc(p.titulo||'Parcial')}</strong><span>${esc(dt)}</span>${upd?`<small>${upd}</small>`:''}</span></span>`;
  const sel=$('sel');sel.hidden=parciais.length<2;
  sel.innerHTML=parciais.map(q=>`<option value="${esc(q.id)}" ${q.id===p.id?'selected':''}>${esc(q.titulo||q.id)} (${new Date(q.data+'T12:00').toLocaleDateString('pt-BR')})</option>`).join('');
  const itens=p.itens||[];
  const hits=TEAMS.map(t=>itens.filter(it=>it.meta>0&&(it.valores?.[t.id]||0)>=it.meta).length);
  const top=Math.max(...hits),unico=hits.filter(h=>h===top).length===1;
  $('board').innerHTML=TEAMS.map((t,i)=>{
    const pend=itens.filter(it=>!isClosed(it,ref)&&it.meta>0&&(it.valores?.[t.id]||0)<it.meta).length;
    return `<div class="team"><div class="stripe" style="background:var(--${t.id})"></div>
    <div><div class="nm">Equipe ${t.nome}${hits[i]===top&&top>0&&unico?'<span class="lead">Na frente</span>':''}</div>
    <div class="ini">Nomes com inicial <b style="color:var(--${t.id})">${t.letras}</b></div>
    <div class="det">${pend} ${pend===1?'meta aberta ainda pendente':'metas abertas ainda pendentes'}</div></div>
    <div class="score">${hits[i]}<small>de ${itens.length} metas</small></div></div>`}).join('');
  $('list').innerHTML=`<div class="legend"><span><i style="background:var(--mid)"></i>até a meta</span><span><i style="background:repeating-linear-gradient(135deg,var(--mid) 0 5px,var(--track) 5px 9px)"></i>acima da meta</span><span>» passou de 2× a meta</span></div>
  <nav class="chips" id="chips" aria-label="Itens">${itens.map((it,i)=>`<button type="button" class="chip" data-i="${i}">${esc(it.nome)}</button>`).join('')}</nav>
  <div class="slider" id="slider" tabindex="0" role="region" aria-roledescription="carrossel" aria-label="Itens da arrecadação">`+itens.map((it,i)=>{
    const pz=prazoTxt(it,ref);
    return `<div class="item" role="group" aria-roledescription="slide" aria-label="${i+1} de ${itens.length}: ${esc(it.nome)}"><div class="ih"><div><h3>${esc(it.nome)}</h3><div class="meta">Meta: <b>${fmt(it.meta)}</b>${esc(it.unidade||'')} por equipe</div></div><span class="tag ${pz.c}">${pz.t}</span></div>
    <div class="scale" aria-hidden="true"><span></span><div class="sc"><span style="left:50%;transform:translateX(-50%)">meta</span><span style="right:0">2×</span></div><span></span></div>
    ${TEAMS.map(t=>{const v=it.valores?.[t.id]||0,pc=it.meta>0?v/it.meta*100:0,hit=pc>=100;
      const base=Math.min(pc,100)/2,extra=hit?(Math.min(pc,200)-100)/2:0;
      return `<div class="bar"><span class="n">${t.nome}</span><div class="trk" role="img" aria-label="${t.nome}: ${Math.round(pc)}% da meta" style="--c:var(--${t.id})"><div class="seg base ${hit?'full':''}" style="width:${base}%;background:var(--${t.id})"></div>${extra>0?`<div class="seg extra" style="width:${extra}%"></div>`:''}<div class="goal"></div>${pc>200?'<span class="more">»</span>':''}</div><span class="val ${hit?'hit':''}"><b>${fmt(v)}</b><small>${Math.round(pc)}% da meta${hit?' ✓':''}</small></span></div>`}).join('')}
    </div>`}).join('')+`</div>
  <div class="snav"><button type="button" id="sPrev" aria-label="Item anterior">‹</button><span class="cnt" id="sCnt" aria-live="polite"></span><button type="button" id="sNext" aria-label="Próximo item">›</button></div>`;
  setupSlider();
  $('foot').textContent='';
}

let slideIdx=0;
const motion=()=>matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth';
const centerLeft=(box,el)=>el.offsetLeft-(box.clientWidth-el.offsetWidth)/2;
function carrossel(sl,{prev,next,cnt,chips,idx=0,onChange}){
  const cards=[...sl.children].filter(c=>!c.hidden);
  if(!cards.length)return;
  const btns=chips?[...chips.children]:[];
  let cur=-1;
  const setActive=i=>{
    cur=i;onChange?.(i);
    cards.forEach((c,k)=>c.classList.toggle('on',k===i));
    btns.forEach((b,k)=>b.setAttribute('aria-current',k===i?'true':'false'));
    if(chips&&btns[i])chips.scrollTo({left:centerLeft(chips,btns[i]),behavior:motion()});
    if(cnt)cnt.textContent=(i+1)+' / '+cards.length;
    if(prev)prev.disabled=i===0;if(next)next.disabled=i===cards.length-1;
  };
  const goTo=(i,b=motion())=>{i=Math.max(0,Math.min(cards.length-1,i));sl.scrollTo({left:centerLeft(sl,cards[i]),behavior:b});setActive(i)};
  let raf=0;
  sl.onscroll=()=>{cancelAnimationFrame(raf);raf=requestAnimationFrame(()=>{
    const mid=sl.scrollLeft+sl.clientWidth/2;let best=0,bd=Infinity;
    cards.forEach((c,k)=>{const d=Math.abs(c.offsetLeft+c.offsetWidth/2-mid);if(d<bd){bd=d;best=k}});
    if(best!==cur)setActive(best);
  })};
  if(chips)chips.onclick=e=>{const b=e.target.closest('[data-i]');if(b)goTo(+b.dataset.i)};
  if(prev)prev.onclick=()=>goTo(cur-1);
  if(next)next.onclick=()=>goTo(cur+1);
  sl.onkeydown=e=>{if(e.target!==sl)return;if(e.key==='ArrowLeft'){e.preventDefault();goTo(cur-1)}else if(e.key==='ArrowRight'){e.preventDefault();goTo(cur+1)}};
  goTo(Math.min(idx,cards.length-1),'instant');
}
function setupSlider(){
  const sl=$('slider');
  if(!sl||!sl.children.length)return;
  carrossel(sl,{prev:$('sPrev'),next:$('sNext'),cnt:$('sCnt'),chips:$('chips'),idx:slideIdx,onChange:i=>slideIdx=i});
}
let avisoIdx=0;
function setupAvisos(){
  const sl=$('avSlider'),n=[...sl.children].filter(c=>!c.hidden).length;
  sl.classList.toggle('single',n<2);$('avNav').hidden=n<2;
  const px=$('pix'),outros=[$('sabado'),$('seteme')];
  outros.forEach(c=>c.style.flexBasis='');
  if(n>1&&!px.hidden)outros.forEach(c=>{if(!c.hidden)c.style.flexBasis=px.offsetWidth+'px'});
  if(n<2)sl.removeAttribute('tabindex');else sl.tabIndex=0;
  carrossel(sl,{prev:$('avPrev'),next:$('avNext'),cnt:$('avCnt'),idx:avisoIdx,onChange:i=>avisoIdx=i});
}

const GLOGO='<svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/><path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/><path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/><path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/></svg>';
const isoLocal=d=>d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
function proximoSabado(){const d=new Date();d.setDate(d.getDate()+(6-d.getDay()+7)%7);return isoLocal(d)}
const SAB_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-7M7.5 8a2.5 2.5 0 0 1 0-5C10 3 12 8 12 8s2-5 4.5-5a2.5 2.5 0 0 1 0 5"/></svg>';
addEventListener('resize',()=>{clearTimeout(setupAvisos.t);setupAvisos.t=setTimeout(setupAvisos,150)});
document.fonts?.ready.then(()=>setupAvisos());
function renderSabado(){
  const box=$('sabado');
  if(sabEditing)return;
  const itens=sabado?.itens||[];
  // Enquanto os itens não chegam, o card já ocupa a 1ª posição (evita o slider pular do Pix para cá)
  if(!sabLoaded&&!sabErro&&db){
    box.hidden=false;box.classList.remove('past');box.setAttribute('aria-busy','true');
    box.innerHTML=`<div class="sab-hd"><span class="sab-ic">${SAB_ICON}</span><div><span class="sab-k">Doações do sábado</span><h3 id="sabT">O que trazer</h3></div></div><ul class="sab-list sk" aria-hidden="true"><li>Carregando</li><li>Carregando</li></ul>`;
    return;
  }
  box.removeAttribute('aria-busy');
  if(!sabLoaded||(!itens.length&&!lider)){box.hidden=true;box.innerHTML='';return}
  box.hidden=false;
  const hoje=isoLocal(new Date()),dt=sabado?.data;
  const past=!!dt&&dt<hoje;
  const dd=dt?new Date(dt+'T12:00').toLocaleDateString('pt-BR',{day:'2-digit',month:'2-digit'}):'';
  const k=!dt?'Doações do sábado':past?'Sábado passado · '+dd:dt===proximoSabado()?'Neste sábado · '+dd:'Sábado · '+dd;
  box.classList.toggle('past',past);
  box.innerHTML=`<div class="sab-hd"><span class="sab-ic">${SAB_ICON}</span><div><span class="sab-k">${k}</span><h3 id="sabT">O que trazer</h3></div>${lider?`<button type="button" class="btn" id="sabEdit">${itens.length?'Editar':'Definir itens'}</button>`:''}</div>
  ${itens.length?`<ul class="sab-list" role="list">${itens.map(i=>`<li>${esc(i)}</li>`).join('')}</ul>`:'<p class="sab-empty">Nenhum item definido para o sábado.</p>'}
  ${sabado?.obs?`<p class="sab-obs">${esc(sabado.obs)}</p>`:''}`;
  if(lider)$('sabEdit').onclick=editarSabado;
}
function editarSabado(){
  sabEditing=true;
  const box=$('sabado'),hoje=isoLocal(new Date());
  const data=sabado?.data&&sabado.data>=hoje?sabado.data:proximoSabado();
  box.classList.remove('past');
  box.innerHTML=`<div class="sab-hd"><span class="sab-ic">${SAB_ICON}</span><div><span class="sab-k">Área restrita</span><h3 id="sabT">Itens do sábado</h3></div></div>
  <form id="sabForm" novalidate><div class="grid2"><label>Data do sábado<input id="sabData" type="date" value="${data}"></label><label>Observação (opcional)<input id="sabObs" value="${esc(sabado?.obs||'')}" placeholder="Entregar na recepção até 10h"></label></div>
  <label>Itens<textarea id="sabItens" placeholder="Arroz (5 kg)&#10;Feijão&#10;Óleo">${esc((sabado?.itens||[]).join('\n'))}</textarea><span class="hint">Um item por linha.</span></label>
  <div class="actions"><button type="submit" class="btn primary" id="sabSave">Salvar e publicar</button><button type="button" class="btn" id="sabCancel">Cancelar</button><span class="msg" id="sabMsg" role="status"></span></div></form>`;
  $('sabCancel').onclick=()=>{sabEditing=false;renderSabado();setupAvisos()};
  $('sabForm').onsubmit=async e=>{
    e.preventDefault();
    const msg=$('sabMsg');msg.className='msg';msg.textContent='';
    const d=$('sabData').value,itens=$('sabItens').value.split('\n').map(x=>x.trim()).filter(Boolean);
    if(!d){msg.className='msg err';msg.textContent='Informe a data do sábado.';return}
    if(!itens.length){msg.className='msg err';msg.textContent='Informe pelo menos um item.';return}
    $('sabSave').disabled=true;msg.textContent='Salvando…';
    try{
      await setDoc(doc(db,'avisos','sabado'),{data:d,itens,obs:$('sabObs').value.trim(),atualizadoEm:new Date().toISOString(),atualizadoPor:auth.currentUser?.email||''});
      sabEditing=false;renderSabado();setupAvisos();
    }catch(err){
      $('sabSave').disabled=false;msg.className='msg err';
      msg.textContent=err?.code==='permission-denied'?'Sem permissão para salvar. Confira as regras do Firestore para a coleção “avisos”.':'Não foi possível salvar agora. Verifique a conexão e tente de novo.';
    }
  };
  $('sabItens').focus();
}

// Recebedor exatamente como o banco mostra ao digitar a chave (o banco corta o nome)
const PIX={chave:'secretaria.iasdbotafogo@gmail.com',whats:'(21) 96900-7346',
  recebedor:'ASSOC RIO DE JANEIRO DA IGREJA ADVENTISTA DO SETIMO DI',cnpj:'30.097.554/0002-09',banco:'Bradesco'};
const NOVA_ABA='<span class="sr"> (abre em nova aba)</span>';
const SHIELD_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/></svg>';
const COPY_ICON='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1"/></svg>';
const PIX_ICON='<img src="img/logos/pix.png" alt="" width="28" height="28">';
const WA_ICON='<img src="img/logos/whatsapp.png" alt="" width="24" height="24">';
function waLink(tel,equipe,meio='do Pix'){
  let d=String(tel||'').replace(/\D/g,'');
  if(d.length<10)return'';
  if(d.length<=11)d='55'+d;
  return 'https://wa.me/'+d+'?text='+encodeURIComponent('Olá! Segue o comprovante '+meio+' para o Mutirão de Natal 2026. '+(equipe?'Minha equipe é a '+equipe:'Minha equipe é: '));
}
// Seletor de equipe + botão do WhatsApp, compartilhado entre os cards de doação
let equipe=null;try{equipe=localStorage.getItem('mutirao-equipe')}catch{}
const syncEquipe=[];
function comprovanteHTML(px){
  return `<div class="pix-rcpt"><div class="eqlbl" id="${px}EqL">Qual é a sua equipe?</div>
  <div class="eq" role="radiogroup" aria-labelledby="${px}EqL">${TEAMS.map(t=>`<button type="button" role="radio" aria-checked="false" data-eq="${t.id}" style="--c:var(--${t.id})"><i></i>${t.nome}<small>${t.letras}</small></button>`).join('')}</div>
  <p class="eqhint" id="${px}EqHint" role="status"></p>
  <a class="btn wa" id="${px}Wa" target="_blank" rel="noopener">${WA_ICON}Enviar comprovante no WhatsApp${NOVA_ABA}</a></div>`;
}
function ligarComprovante(box,px,meio){
  const grp=box.querySelector('.eq'),wa=$(px+'Wa'),hint=$(px+'EqHint');
  const pintar=()=>{
    const t=TEAMS.find(x=>x.id===equipe);
    grp.querySelectorAll('[data-eq]').forEach((b,k)=>{const on=b.dataset.eq===equipe;b.setAttribute('aria-checked',on);b.tabIndex=on||(!t&&k===0)?0:-1});
    if(t){wa.href=waLink(PIX.whats,t.nome.toUpperCase()+' '+t.emoji,meio);wa.removeAttribute('aria-disabled');hint.textContent=''}
    else{wa.href=waLink(PIX.whats,'',meio);wa.setAttribute('aria-disabled','true')}
  };
  syncEquipe.push(pintar);pintar();
  const escolher=id=>{equipe=id;try{localStorage.setItem('mutirao-equipe',id)}catch{}syncEquipe.forEach(f=>f())};
  grp.onclick=e=>{const b=e.target.closest('[data-eq]');if(b)escolher(b.dataset.eq)};
  grp.onkeydown=e=>{
    const k={ArrowRight:1,ArrowDown:1,ArrowLeft:-1,ArrowUp:-1}[e.key];if(!k)return;
    e.preventDefault();const ids=TEAMS.map(t=>t.id),i=Math.max(0,ids.indexOf(equipe));const n=ids[(i+(TEAMS.some(t=>t.id===equipe)?k:0)+ids.length)%ids.length];
    escolher(n);grp.querySelector(`[data-eq="${n}"]`).focus();
  };
  wa.onclick=e=>{if(!TEAMS.some(t=>t.id===equipe)){e.preventDefault();hint.textContent='Escolha a sua equipe antes de enviar.';grp.querySelector('[data-eq]').focus()}};
}
function renderPix(){
  const box=$('pix');
  if(box.innerHTML)return;
  box.hidden=false;
  box.innerHTML=`<div class="sab-hd"><span class="sab-ic">${PIX_ICON}</span><div><span class="sab-k">Doações via Pix</span><h3 id="pixT">Contribua</h3></div></div>
  <div class="pix-box">
    <span class="pix-lbl">Chave Pix (e-mail)</span>
    <code id="pixKey">${esc(PIX.chave)}</code>
    <div class="pix-rec"><span class="pix-lbl">${SHIELD_ICON}Recebedor · confira no app do banco</span><b>${esc(PIX.recebedor)}</b><small>CNPJ ${esc(PIX.cnpj)} · ${esc(PIX.banco)}</small></div>
  </div>
  <button type="button" class="btn primary pixcopy" id="pixCopy">${COPY_ICON}<span>Copiar chave Pix</span></button><span class="sr" role="status" id="pixSt"></span>
  ${comprovanteHTML('pix')}`;
  ligarComprovante(box,'pix','do Pix');
  $('pixCopy').onclick=async()=>{
    const b=$('pixCopy');
    try{await navigator.clipboard.writeText(PIX.chave)}
    catch{const r=document.createRange();r.selectNodeContents($('pixKey'));const sel=getSelection();sel.removeAllRanges();sel.addRange(r);try{document.execCommand('copy')}catch{}}
    const t=b.querySelector('span');t.textContent='Chave copiada ✓';b.classList.add('ok');$('pixSt').textContent='';setTimeout(()=>$('pixSt').textContent='Chave Pix copiada',50);
    clearTimeout(b.t);b.t=setTimeout(()=>{t.textContent='Copiar chave Pix';b.classList.remove('ok')},2200);
  };
}
const SETEME={
  // giving.7me.app é um Universal Link / App Link: abre o app se estiver instalado, senão o site
  site:'https://giving.7me.app/guest-donation/church/58caf077-0310-4b5d-8fc6-309964305664',
  ios:'https://apps.apple.com/br/app/7me/id1344775660',
  android:'https://play.google.com/store/apps/details?id=com.iatec.acms.me',
  caminho:['Dizimar e ofertar','Outras ofertas','Ofertas para a minha igreja','Mutirão de Natal']
};
function renderSeteme(){
  const box=$('seteme');
  if(box.innerHTML)return;
  box.hidden=false;
  const ua=navigator.userAgent,ios=/iPhone|iPad|iPod/.test(ua)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1),android=/Android/.test(ua);
  const loja=ios?SETEME.ios:android?SETEME.android:'';
  box.innerHTML=`<div class="sab-hd"><span class="sab-ic"><img src="img/logos/7me.png" alt="" width="139" height="72"></span><div><span class="sab-k">Doações via 7me</span><h3 id="setemeT">Oferte pelo app</h3></div></div>
  <ol class="steps" role="list">${SETEME.caminho.map(c=>`<li>${esc(c)}</li>`).join('')}</ol>
  <span class="alt7">${loja?`Ainda não tem o app? <a href="${loja}" target="_blank" rel="noopener">Baixar o 7me${NOVA_ABA}</a>`:`Baixe o app: <a href="${SETEME.ios}" target="_blank" rel="noopener">iPhone${NOVA_ABA}</a> · <a href="${SETEME.android}" target="_blank" rel="noopener">Android${NOVA_ABA}</a>`}</span>
  <a class="btn primary app7" href="${SETEME.site}" target="_blank" rel="noopener">Abrir o 7me${NOVA_ABA}</a>
`;
}

const VAPID='BOR4p6-KsaZAf1QOsncykQ8OVugzL5U9GX7ZTuoqC28TK3FT1_e1IzOAAQuSuykn6pahz4WD6EkcFVqveytoyn0';
async function registrarAparelho(messaging){
  const reg=await navigator.serviceWorker.ready;
  let token;
  try{token=await getToken(messaging,{vapidKey:VAPID,serviceWorkerRegistration:reg})}
  catch(e){throw Object.assign(new Error('token'),{etapa:'gerar o token',code:e?.code||e?.message})}
  if(!token)throw Object.assign(new Error('token'),{etapa:'gerar o token',code:'vazio'});
  try{await setDoc(doc(db,'inscritos',token),{token,plataforma:isIOS?'ios':/Android/.test(navigator.userAgent)?'android':'outro',atualizadoEm:new Date().toISOString()})}
  catch(e){throw Object.assign(new Error('firestore'),{etapa:'salvar a inscrição',code:e?.code||e?.message})}
}
async function iniciarAvisos(app){
  if(!('serviceWorker' in navigator)||!('Notification' in window))return;
  let ok=false;try{ok=await isSupported()}catch{}
  if(!ok)return;
  const messaging=getMessaging(app);
  onMessage(messaging,async p=>{
    const reg=await navigator.serviceWorker.ready;
    reg.showNotification(p.notification?.title||'Mutirão de Natal 2026',{body:p.notification?.body||'',icon:'img/icones/icon-192.png',badge:'img/icones/icon-192.png'});
  });
  const btn=el('pushBtn'),label=btn.querySelector('span'),msg=el('pushMsg');
  const mostrar=(txt,rotulo,desab)=>{btn.hidden=false;btn.disabled=!!desab;label.textContent=rotulo;msg.textContent=txt;syncInst()};
  const falhou=e=>{console.warn(e);mostrar(`Não foi possível ativar os avisos (erro ao ${e?.etapa||'ativar'}: ${e?.code||'desconhecido'}). Tente de novo.`,'Tentar de novo')};
  const TXT_BLOQ='As notificações deste site estão bloqueadas. No Chrome, toque no ícone ao lado do endereço → Permissões → Notificações → Permitir, e recarregue a página. Se abriu por um link no WhatsApp ou Instagram, abra direto no Chrome.';
  const bloqueado=comMsg=>{mostrar(comMsg?TXT_BLOQ:'','Avisos bloqueados');btn.onclick=()=>{msg.textContent=msg.textContent?'':TXT_BLOQ;syncInst()}};
  const ativar=async()=>{
    mostrar('','Ativando…',true);
    try{
      const perm=Notification.permission==='granted'?'granted':await Notification.requestPermission();
      if(perm==='denied')return bloqueado(true);
      if(perm!=='granted')return mostrar('','Ativar avisos');
      await registrarAparelho(messaging);
      mostrar('','Avisos ativados ✓',true);
    }catch(e){falhou(e)}
  };
  btn.onclick=ativar;
  if(Notification.permission==='denied')return bloqueado(false);
  if(Notification.permission==='granted'){
    try{await registrarAparelho(messaging)}catch(e){falhou(e)}
    return;
  }
  mostrar('','Ativar avisos');
}

function renderAuth(){
  const box=$('authBox');
  if(!auth){box.innerHTML='';return}
  const u=auth.currentUser;
  if(signedIn&&u){
    const nm=u.displayName||u.email||'';
    box.innerHTML=`<span class="lbl">Área restrita</span><div class="who"><span class="av">${u.photoURL?`<img src="${esc(u.photoURL)}" alt="" referrerpolicy="no-referrer">`:esc(nm.charAt(0).toUpperCase())}</span><span class="em">${esc(u.displayName||'Conectado')}${acessoChecado?`<span class="role${lider?' dev':''}">${lider?'Login dev':'Login padrão'}</span>`:''}<small>${esc(u.email||'')}</small></span><button type="button" class="obtn" id="gOut">Sair</button></div>`;
  }else{
    box.innerHTML=`<span class="lbl">Área restrita</span><button type="button" class="gbtn" id="gIn">${GLOGO}Entrar com Google</button>`;
  }
}

function toLocalInput(iso){if(!iso)return'';const d=new Date(iso);const z=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${z(d.getMonth()+1)}-${z(d.getDate())}T${z(d.getHours())}:${z(d.getMinutes())}`}
function itemForm(it,i,isNew){
  return `<div class="eitem${isNew?' new':''}"><div class="hd"><label>Item<input data-f="nome" value="${esc(it.nome)}" placeholder="Alimentos"></label><button type="button" class="x" data-rm="1">Remover</button></div>
  <div class="row"><label>Meta por equipe<input data-f="meta" type="number" min="0" step="any" inputmode="decimal" value="${it.meta??''}"></label>
  <label>Unidade<input data-f="unidade" value="${esc(it.unidade||'')}" placeholder="kg"></label>
  <label>Encerra em<input data-f="prazo" type="datetime-local" value="${toLocalInput(it.prazo)}"></label></div>
  <div class="row">${TEAMS.map(t=>`<label>${t.nome}<input data-t="${t.id}" type="number" min="0" step="any" inputmode="decimal" value="${it.valores?.[t.id]??0}"></label>`).join('')}</div></div>`;
}
function openEditor(){
  editing=true;
  const primeira=!parciais.length;
  const base=primeira?{itens:[]}:parciais[0];
  const today=isoLocal(new Date());
  $('editor').innerHTML=`<h2>Atualizar dados</h2><p class="sub" style="margin:4px 0 0">${primeira?'Adicione os itens da campanha com as metas e os valores de cada equipe, e salve para publicar a 1ª parcial.':'Os valores da última parcial já vêm preenchidos. Salvar com uma data nova cria uma nova parcial e mantém as anteriores no histórico.'}</p>
  <div class="grid2"><label>Nome da parcial<input id="eTit" value="${esc((parciais.length+1)+'ª parcial')}"></label><label>Data da parcial<input id="eData" type="date" value="${today}"></label></div>
  <div id="eItens">${(base.itens||[]).map(itemForm).join('')}</div>
  <button type="button" class="btn" id="eAdd">Adicionar item</button>
  <div class="actions"><button type="button" class="btn primary" id="eSave">Salvar e publicar</button><button type="button" class="btn" id="eCancel">Cancelar</button><span class="chgc" id="eChg" aria-live="polite"></span><span class="msg" id="eMsg" role="status"></span></div>`;
  $('editor').hidden=false;render();
  removidos=0;
  $('eAdd').onclick=()=>{$('eItens').insertAdjacentHTML('beforeend',itemForm({nome:'',meta:'',unidade:'',valores:{}},0,true));contarAlteracoes()};
  $('eItens').onclick=e=>{const b=e.target.closest('[data-rm]');if(!b)return;const el=b.closest('.eitem');if(!el.classList.contains('new'))removidos++;el.remove();contarAlteracoes()};
  $('editor').oninput=e=>{if(e.target.matches('input'))marcarAlteracao(e.target)};
  $('eCancel').onclick=()=>{if(!$('eChg').textContent||confirm('Descartar as alterações feitas?'))closeEditor()};$('eSave').onclick=save;
  $('editor').scrollIntoView({behavior:'smooth',block:'start'});
}
let removidos=0;
function marcarAlteracao(inp){
  const num=inp.type==='number',a=inp.value,b=inp.defaultValue;
  const chg=num?(a===''?'':+a)!==(b===''?'':+b):a.trim()!==b.trim();
  inp.classList.toggle('chg',chg);
  const lab=inp.closest('label');let w=lab.querySelector('.was');
  if(chg&&!inp.closest('.eitem.new')){
    if(!w){w=document.createElement('span');w.className='was';lab.insertBefore(w,inp)}
    let t,neg=false;
    if(num&&a!==''&&b!==''){const d=+a-+b;neg=d<0;t=(d>0?'+':'')+fmt(d)+' (antes '+fmt(+b)+')'}
    else if(inp.type==='datetime-local'&&b)t='antes '+new Date(b).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
    else if(inp.type==='date'&&b)t='antes '+new Date(b+'T12:00').toLocaleDateString('pt-BR');
    else t='antes: '+(b.trim()||'vazio');
    w.textContent=t;w.classList.toggle('neg',neg);
  }else w?.remove();
  contarAlteracoes();
}
function contarAlteracoes(){
  document.querySelectorAll('#eItens .eitem').forEach(el=>el.classList.toggle('chg',!el.classList.contains('new')&&!!el.querySelector('input.chg')));
  const n=document.querySelectorAll('#editor .eitem:not(.new) input.chg, #editor .grid2 input.chg').length,novos=document.querySelectorAll('#eItens .eitem.new').length;
  const p=[];
  if(n)p.push(n+(n===1?' campo alterado':' campos alterados'));
  if(novos)p.push(novos+(novos===1?' item novo':' itens novos'));
  if(removidos)p.push(removidos+(removidos===1?' item removido':' itens removidos'));
  $('eChg').textContent=p.join(' · ');
}
function closeEditor(){editing=false;$('editor').hidden=true;$('editor').innerHTML='';render()}
async function save(){
  const msg=$('eMsg');msg.className='msg';msg.textContent='';
  const data=$('eData').value,titulo=$('eTit').value.trim();
  if(!data){msg.className='msg err';msg.textContent='Informe a data da parcial.';return}
  const itens=[];let bad='';
  document.querySelectorAll('#eItens .eitem').forEach(el=>{
    if(bad)return;
    const g=f=>el.querySelector(`[data-f="${f}"]`).value;
    const nome=g('nome').trim(),meta=parseFloat(g('meta'));
    if(!nome){bad='Todo item precisa de um nome.';return}
    if(!(meta>0)){bad=`Informe uma meta maior que zero em “${nome}”.`;return}
    const valores={};TEAMS.forEach(t=>{valores[t.id]=Math.max(0,parseFloat(el.querySelector(`[data-t="${t.id}"]`).value)||0)});
    const pz=g('prazo');
    itens.push({nome,meta,unidade:g('unidade').trim(),prazo:pz?new Date(pz).toISOString():null,valores});
  });
  if(bad){msg.className='msg err';msg.textContent=bad;return}
  if(!itens.length){msg.className='msg err';msg.textContent='Adicione pelo menos um item.';return}
  $('eSave').disabled=true;msg.textContent='Salvando…';
  try{
    await setDoc(doc(db,'parciais',data),{titulo:titulo||'Parcial',data,itens,atualizadoEm:new Date().toISOString(),atualizadoPor:auth.currentUser?.email||''});
    viewId=data;closeEditor();
  }catch(e){
    $('eSave').disabled=false;msg.className='msg err';
    msg.textContent=e?.code==='permission-denied'?'A conta '+(auth.currentUser?.email||'')+' não está na lista da liderança. Fale com o responsável do placar.':'Não foi possível salvar agora. Verifique a conexão e tente de novo.';
  }
}

async function entrar(){
  const m=$('lMsg');m.textContent='';
  try{await signInWithPopup(auth,new GoogleAuthProvider())}
  catch(e){
    if(e?.code==='auth/popup-closed-by-user'||e?.code==='auth/cancelled-popup-request')return;
    m.textContent=e?.code==='auth/popup-blocked'?'O navegador bloqueou a janela de login. Libere pop-ups para este site e tente de novo.':e?.code==='auth/unauthorized-domain'?'Este endereço ainda não está autorizado no Firebase (Authentication, Configurações, Domínios autorizados).':'Não foi possível entrar agora. Tente de novo.';
  }
}
$('authBox').onclick=e=>{if(!auth)return;if(e.target.closest('#gIn'))entrar();else if(e.target.closest('#gOut'))signOut(auth).then(closeEditor)};
$('sel').onchange=e=>{viewId=e.target.value;render()};
$('editBtn').onclick=openEditor;

if(firebaseConfig.apiKey==='COLE_AQUI'){render()}
else{
  const app=initializeApp(firebaseConfig);
  db=getFirestore(app);auth=getAuth(app);
  iniciarAvisos(app);
  onAuthStateChanged(auth,async u=>{
    signedIn=!!u;lider=false;acessoChecado=false;$('lMsg').textContent='';
    if(!u){if(editing)closeEditor();sabEditing=false;render();return}
    render();
    // Só a liderança consegue ler lideranca/acesso (o documento nem precisa existir)
    try{await getDoc(doc(db,'lideranca','acesso'));lider=true}catch{lider=false}
    acessoChecado=true;
    if(auth.currentUser!==u)return;
    if(!lider&&editing)closeEditor();
    if(!lider)sabEditing=false;
    render();
  });
  onSnapshot(doc(db,'avisos','sabado'),d=>{sabLoaded=true;sabado=d.exists()?d.data():null;renderSabado();setupAvisos()},()=>{sabLoaded=false;sabErro=true;renderSabado();setupAvisos()});
  onSnapshot(query(collection(db,'parciais'),orderBy('data','desc')),s=>{
    loaded=true;parciais=s.docs.map(d=>({id:d.id,...d.data()}));
    if(viewId&&!parciais.some(p=>p.id===viewId))viewId=null;render();
  },()=>{$('sub').textContent='Não foi possível carregar os dados agora. Recarregue a página.'});
  render();
}
