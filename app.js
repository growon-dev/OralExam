const $=id=>document.getElementById(id);
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const ansHTML=a=>a.map(x=>x.startsWith('[사진]')
  ? `<p class="pic">🖼 사진 자료${x.length>4?' — '+esc(x.slice(4).trim()):''}</p>`
  : `<p>${esc(x)}</p>`).join('');
const STAR='<svg viewBox="0 0 24 24"><path class="fill" d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.99 6.2 21.04l1.11-6.46-4.7-4.58 6.49-.94z"/><path class="stroke" d="M12 2.6l2.9 5.88 6.49.94-4.7 4.58 1.11 6.46L12 17.99 6.2 21.04l1.11-6.46-4.7-4.58 6.49-.94z"/></svg>';
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};

const PER_DAY=24, PER_SET=4;
const CHEERS=[
  '오늘 하루도 고생 많았어요. 딱 여기까지, 잘했어요.',
  '24문제 완주! 이 꾸준함이 합격을 만들어요.',
  '오늘 몫은 끝냈어요. 푹 쉬고 내일 또 만나요.',
  '한 걸음 더 가까워졌어요. 오늘도 수고했어요.',
  '완료! 머릿속에 차곡차곡 쌓이고 있어요.'
];

let ALL=[], DAYS=[];
const saved=new Map();
let curDay=0;          // 0-based
let setIdx=0;          // 현재 몇 번째 4문제 묶음인지 (0-based)
let dayCards=[];       // 오늘의 24문제(섞인 상태)
let flippedNow=false;

// ---- 저장 (localStorage) ----
const KEY='gusul_v1';
function load(){
  try{ return JSON.parse(localStorage.getItem(KEY))||{}; }catch(e){ return {}; }
}
function save(st){ try{ localStorage.setItem(KEY, JSON.stringify(st)); }catch(e){} }
let state=load();
// state = { doneDays:[0,1,..], saved:[ids], lastDay:0 }
state.doneDays=state.doneDays||[];
if(state.saved){ /* restore later after ALL loads */ }

fetch('questions.json').then(r=>r.json()).then(data=>{ init(data); })
  .catch(()=>{ $('board').innerHTML='<div class="loading">questions.json을 불러오지 못했어요. index.html과 같은 폴더에 두거나, 깃허브에 함께 올려주세요.</div>'; });

function init(data){
  ALL=data; ALL.forEach((c,i)=>c.id=i);
  // Day 분할: 순서대로 24개씩
  for(let i=0;i<ALL.length;i+=PER_DAY) DAYS.push(ALL.slice(i,i+PER_DAY));
  // 저장된 오답노트 복원
  (state.saved||[]).forEach(id=>{ if(ALL[id]) saved.set(id,ALL[id]); });
  curDay=Math.min(state.lastDay||0, DAYS.length-1);
  renderChips();
  openDay(curDay);
}

function setsInDay(d){ return Math.ceil(DAYS[d].length/PER_SET); }

function renderChips(){
  $('days').innerHTML=DAYS.map((d,i)=>{
    const done=state.doneDays.includes(i);
    return `<button class="chip ${i===curDay?'active':''} ${done?'done':''}" data-day="${i}">
      ${done?'<span class="mk">✓</span>':''}Day ${i+1}</button>`;
  }).join('');
  $('days').querySelectorAll('.chip').forEach(b=>b.onclick=()=>openDay(+b.dataset.day));
}

function openDay(d){
  curDay=d; setIdx=0;
  dayCards=shuffle(DAYS[d].slice());   // 하루 안에서 순서 랜덤
  state.lastDay=d; save(state);
  renderChips();
  renderSet();
}

function renderSet(){
  const total=setsInDay(curDay);
  if(setIdx>=total){ renderDone(); return; }
  const start=setIdx*PER_SET;
  const set=dayCards.slice(start,start+PER_SET);
  $('board').innerHTML=set.map((c,i)=>cardHTML(c,start+i)).join('');
  $('board').querySelectorAll('.card').forEach((el,i)=>{
    el.querySelector('.inner').onclick=e=>{if(!e.target.closest('.star'))el.classList.toggle('flipped');};
    el.querySelectorAll('.star').forEach(s=>s.onclick=e=>{e.stopPropagation();toggleSave(set[i]);});
  });
  $('controls').style.display='flex';
  $('back').disabled=setIdx<=0;
  $('draw').textContent = setIdx===total-1 ? '오늘 학습 완료' : '다음 4문제';
  progress();
  scrollTo({top:0,behavior:'smooth'});
}

const star=c=>`<button class="star ${saved.has(c.id)?'on':''}" data-id="${c.id}">${STAR}</button>`;
const cardHTML=(c,i)=>`<div class="card"><div class="inner">
  <div class="face front">${star(c)}
    <div class="meta"><span class="pill">${esc(c.cat)}</span><span class="qnum">${i+1} / ${DAYS[curDay].length}</span></div>
    <div class="qtext">${esc(c.q)}</div></div>
  <div class="face back">${star(c)}
    <div class="alabel">Answer</div><div class="atext">${ansHTML(c.a)}</div></div>
</div></div>`;

function progress(){
  const total=setsInDay(curDay);
  const seen=Math.min((setIdx+1)*PER_SET, DAYS[curDay].length);
  const shown=Math.min(setIdx*PER_SET+PER_SET, DAYS[curDay].length);
  const pct=Math.round(Math.min(setIdx, total)/total*100);
  $('plabel').innerHTML=`Day ${curDay+1} · <b>${Math.min((setIdx)*PER_SET, DAYS[curDay].length)}</b> / ${DAYS[curDay].length}`;
  $('pbar').style.width=Math.round(setIdx/total*100)+'%';
  $('ppct').textContent=Math.round(setIdx/total*100)+'%';
  $('savedCount').textContent=saved.size;
}

function renderDone(){
  // 진행바 100%
  $('pbar').style.width='100%'; $('ppct').textContent='100%';
  $('plabel').innerHTML=`Day ${curDay+1} · <b>${DAYS[curDay].length}</b> / ${DAYS[curDay].length}`;
  // Day 완료 저장
  if(!state.doneDays.includes(curDay)){ state.doneDays.push(curDay); save(state); renderChips(); }
  const msg=CHEERS[Math.random()*CHEERS.length|0];
  const hasNext=curDay<DAYS.length-1;
  $('board').innerHTML=`<div class="done-card">
    <div class="emoji">🎉</div>
    <div class="dtitle">Day ${curDay+1} 완료!</div>
    <div class="dmsg">${msg}</div>
    <div class="dbtns">
      <button class="btn btn-secondary" id="again">한 번 더 복습</button>
      ${hasNext?`<button class="btn btn-primary" id="next">Day ${curDay+2} 시작</button>`
                :`<button class="btn btn-primary" id="next">처음부터 다시</button>`}
    </div>
  </div>`;
  $('controls').style.display='none';
  $('savedCount').textContent=saved.size;
  $('again').onclick=()=>openDay(curDay);
  $('next').onclick=()=>openDay(hasNext?curDay+1:0);
  scrollTo({top:0,behavior:'smooth'});
}

const draw=()=>{ setIdx++; renderSet(); };
const back=()=>{ if(setIdx>0){ setIdx--; renderSet(); } };

function syncStars(id){const on=saved.has(id);
  document.querySelectorAll(`.star[data-id="${id}"]`).forEach(s=>s.classList.toggle('on',on));}
function toggleSave(c){
  saved.has(c.id)?saved.delete(c.id):saved.set(c.id,c);
  syncStars(c.id);
  state.saved=[...saved.keys()]; save(state);
  $('savedCount').textContent=saved.size;
}

function openSaved(){
  $('savedList').innerHTML=saved.size?[...saved.values()].map(c=>`
    <div class="saveitem"><button class="rm" data-id="${c.id}">✕</button>
    <div class="sq">${esc(c.q)}</div><div class="sa">${ansHTML(c.a)}</div></div>`).join('')
    :'<div class="empty">아직 저장한 문제가 없어요.<br>카드 오른쪽 위의 별을 눌러 담아두세요.</div>';
  $('savedList').querySelectorAll('.rm').forEach(b=>b.onclick=()=>{
    const id=+b.dataset.id;saved.delete(id);syncStars(id);
    state.saved=[...saved.keys()];save(state);
    $('savedCount').textContent=saved.size;openSaved();});
  $('overlay').classList.add('open');
}
$('savedBtn').onclick=openSaved;
$('mclose').onclick=()=>$('overlay').classList.remove('open');
$('overlay').onclick=e=>{if(e.target===$('overlay'))$('overlay').classList.remove('open');};
$('draw').onclick=draw;
$('back').onclick=back;
