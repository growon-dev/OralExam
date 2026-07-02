/* ===== 공통 유틸 ===== */
const $=id=>document.getElementById(id);
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const shuffle=a=>{for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
const pick=a=>a[Math.random()*a.length|0];
const ol=items=>'<ol>'+items.map(s=>`<li>${esc(s)}</li>`).join('')+'</ol>';
// 시드 난수 (구술 회차용)
function mulberry32(seed){return function(){seed|=0;seed=seed+0x6D2B79F5|0;let t=Math.imul(seed^seed>>>15,1|seed);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}
function seededShuffle(arr,seed){const a=arr.slice();const r=mulberry32(seed);for(let i=a.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}

/* 답안(문자열/사진/표) → HTML */
function ansHTML(a){
  return a.map(x=>{
    if(typeof x==='object'&&x._type==='table'){
      const h=x.headers.map(c=>`<th>${esc(c)}</th>`).join('');
      const b=x.rows.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('');
      return `<div class="tbl-wrap"><table class="atbl"><thead><tr>${h}</tr></thead><tbody>${b}</tbody></table></div>`;
    }
    if(typeof x==='string'&&x.startsWith('[사진]'))
      return `<p class="pic"><i class="fa-regular fa-image"></i> 사진 자료${x.length>4?' — '+esc(x.slice(4).trim()):''}</p>`;
    return `<p>${esc(x)}</p>`;
  }).join('');
}

/* ===== 저장 (localStorage 공용) ===== */
const KEY='coachdex_v1';
const store={
  load(){try{return JSON.parse(localStorage.getItem(KEY))||{};}catch(e){return {};}},
  save(){try{localStorage.setItem(KEY,JSON.stringify(state));}catch(e){}}
};
let state=store.load();
state.oral=state.oral||{cycle:1,doneDays:[],lastDay:0};
state.saved=state.saved||[];

/* ===== 오답노트 (두 앱 공용) ===== */
const saved=new Map();   // id -> {q,a}
function syncStars(id){
  const on=saved.has(id);
  document.querySelectorAll(`.star[data-id="${id}"]`).forEach(s=>{
    s.classList.toggle('on',on);
    const i=s.querySelector('i'); if(i) i.className=`fa-${on?'solid':'regular'} fa-star`;
  });
}
function toggleSave(item){
  saved.has(item.id)?saved.delete(item.id):saved.set(item.id,item);
  syncStars(item.id);
  state.saved=[...saved.keys()]; store.save();
  $('savedCount').textContent=saved.size;
}
const starBtn=item=>`<button class="star ${saved.has(item.id)?'on':''}" data-id="${item.id}" aria-label="오답노트"><i class="fa-${saved.has(item.id)?'solid':'regular'} fa-star"></i></button>`;
function openSaved(){
  $('savedList').innerHTML=saved.size
    ?[...saved.values()].map(c=>`<div class="saveitem"><button class="rm" data-id="${c.id}"><i class="fa-solid fa-xmark"></i></button>
      <div class="sq">${esc(c.q)}</div><div class="sa">${ansHTML(c.a)}</div></div>`).join('')
    :'<div class="empty">아직 저장한 문제가 없어요.<br>카드 오른쪽 위의 별을 눌러 담아두세요.</div>';
  $('savedList').querySelectorAll('.rm').forEach(b=>b.onclick=()=>{
    const id=+b.dataset.id; saved.delete(id); syncStars(id);
    state.saved=[...saved.keys()]; store.save(); $('savedCount').textContent=saved.size; openSaved();
  });
  $('overlay').classList.add('open');
}
$('savedBtn').onclick=openSaved;
$('mclose').onclick=()=>$('overlay').classList.remove('open');
$('overlay').onclick=e=>{if(e.target===$('overlay'))$('overlay').classList.remove('open');};

/* ===== 탭 전환 ===== */
function switchTab(name){
  document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t.dataset.tab===name));
  $('view-oral').hidden = name!=='oral';
  $('view-practice').hidden = name!=='practice';
  document.body.classList.toggle('tab-practice', name==='practice');
  scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('.tab').forEach(t=>t.onclick=()=>switchTab(t.dataset.tab));

/* ============================================================
   구술 모듈
   ============================================================ */
const Oral=(()=>{
  const PER_DAY=24, PER_SET=4;
  const CHEERS=['오늘 하루도 고생 많았어요. 딱 여기까지, 잘했어요.','24문제 완주! 이 꾸준함이 합격을 만들어요.',
    '오늘 몫은 끝냈어요. 푹 쉬고 내일 또 만나요.','한 걸음 더 가까워졌어요. 오늘도 수고했어요.','완료! 머릿속에 차곡차곡 쌓이고 있어요.'];
  let ALL=[], DAYS=[], curDay=0, setIdx=0, dayCards=[];
  const S=()=>state.oral;
  const setsInDay=d=>Math.ceil(DAYS[d].length/PER_SET);

  function init(data){
    ALL=data; ALL.forEach((c,i)=>c.id='o'+i);
    buildDays();
    state.saved.forEach(id=>{const c=ALL.find(x=>x.id===id); if(c)saved.set(id,c);});
    $('savedCount').textContent=saved.size;
    curDay=Math.min(S().lastDay||0, DAYS.length-1);
    renderCycle(); renderChips(); openDay(curDay);
  }
  function buildDays(){
    DAYS=[]; const order=seededShuffle(ALL, 1000+S().cycle*97);
    for(let i=0;i<order.length;i+=PER_DAY) DAYS.push(order.slice(i,i+PER_DAY));
  }
  const renderCycle=()=>{$('cycleLabel').textContent=S().cycle+'회차';};
  function renderChips(){
    $('days').innerHTML=DAYS.map((d,i)=>{
      const done=S().doneDays.includes(i);
      return `<button class="chip ${i===curDay?'active':''} ${done?'done':''}" data-day="${i}">${done?'<span class="mk">✓</span>':''}Day ${i+1}</button>`;
    }).join('');
    $('days').querySelectorAll('.chip').forEach(b=>b.onclick=()=>openDay(+b.dataset.day));
  }
  function openDay(d){
    curDay=d; setIdx=0;
    dayCards=seededShuffle(DAYS[d], 7000+S().cycle*131+d*17);
    S().lastDay=d; store.save();
    renderChips(); renderSet();
  }
  const cardHTML=(c,i)=>`<div class="card"><div class="inner">
    <div class="face front">${starBtn(c)}<div class="meta"><span class="qnum">${i+1} / ${DAYS[curDay].length}</span></div>
      <div class="qtext">${esc(c.q)}</div></div>
    <div class="face back">${starBtn(c)}<div class="alabel">Answer</div><div class="atext">${ansHTML(c.a)}</div></div>
  </div></div>`;
  function renderSet(){
    const total=setsInDay(curDay);
    if(setIdx>=total){renderDone(); return;}
    const start=setIdx*PER_SET, set=dayCards.slice(start,start+PER_SET);
    $('oralBoard').innerHTML=set.map((c,i)=>cardHTML(c,start+i)).join('');
    $('oralBoard').querySelectorAll('.card').forEach((el,i)=>{
      el.querySelector('.inner').onclick=e=>{if(!e.target.closest('.star'))el.classList.toggle('flipped');};
      el.querySelectorAll('.star').forEach(s=>s.onclick=e=>{e.stopPropagation();toggleSave(set[i]);});
    });
    $('oralControls').style.display='flex';
    $('oralBack').disabled=setIdx<=0;
    $('oralDraw').textContent=setIdx===total-1?'오늘 학습 완료':'다음 4문제';
    progress(); scrollTo({top:0,behavior:'smooth'});
  }
  function progress(){
    const total=setsInDay(curDay), pct=Math.round(setIdx/total*100);
    $('oralLabel').innerHTML=`Day ${curDay+1} · <b>${Math.min(setIdx*PER_SET,DAYS[curDay].length)}</b> / ${DAYS[curDay].length}`;
    $('oralBar').style.width=pct+'%'; $('oralPct').textContent=pct+'%';
  }
  function renderDone(){
    $('oralBar').style.width='100%'; $('oralPct').textContent='100%';
    $('oralLabel').innerHTML=`Day ${curDay+1} · <b>${DAYS[curDay].length}</b> / ${DAYS[curDay].length}`;
    if(!S().doneDays.includes(curDay)){S().doneDays.push(curDay); store.save(); renderChips();}
    const hasNext=curDay<DAYS.length-1;
    const allDone=S().doneDays.length>=DAYS.length;
    $('oralControls').style.display='none';
    if(allDone&&!hasNext){
      $('oralBoard').innerHTML=`<div class="done-card"><div class="emoji">🏆</div>
        <div class="dtitle">${S().cycle}회차 완주!</div>
        <div class="dmsg">11일 과정을 전부 끝냈어요. 정말 수고 많았어요!<br>다음 회차는 문제 구성이 새로 섞여서 나와요.</div>
        <div class="dbtns"><button class="btn btn-ghost" id="oAgain">이 Day 복습</button>
        <button class="btn btn-solid" id="oCycle">${S().cycle+1}회차 시작</button></div></div>`;
      $('oAgain').onclick=()=>openDay(curDay);
      $('oCycle').onclick=nextCycle;
    }else{
      $('oralBoard').innerHTML=`<div class="done-card"><div class="emoji">🎉</div>
        <div class="dtitle">Day ${curDay+1} 완료!</div><div class="dmsg">${pick(CHEERS)}</div>
        <div class="dbtns"><button class="btn btn-ghost" id="oAgain">한 번 더 복습</button>
        <button class="btn btn-solid" id="oNext">${hasNext?`Day ${curDay+2} 시작`:`${S().cycle+1}회차 시작`}</button></div></div>`;
      $('oAgain').onclick=()=>openDay(curDay);
      $('oNext').onclick=()=>hasNext?openDay(curDay+1):nextCycle();
    }
    scrollTo({top:0,behavior:'smooth'});
  }
  function nextCycle(){
    S().cycle=(S().cycle||1)+1; S().doneDays=[]; S().lastDay=0; store.save();
    buildDays(); renderCycle(); renderChips(); openDay(0);
  }
  $('oralDraw').onclick=()=>{setIdx++; renderSet();};
  $('oralBack').onclick=()=>{if(setIdx>0){setIdx--; renderSet();}};
  return {init};
})();

/* ============================================================
   실기 모듈
   ============================================================ */
const Practice=(()=>{
  const SET_SIZE=3;
  let DATA={}, COMPOUND=[], POSING=[], PARTS=[], TOTAL=0;
  const st={pool:[],posePool:[],drawn:0,history:[],setNo:0};

  function init(d){
    DATA=d.DATA; COMPOUND=d.COMPOUND; POSING=d.POSING;
    PARTS=Object.keys(DATA); TOTAL=PARTS.reduce((n,p)=>n+DATA[p].length,0);
    reset();
  }
  const cyclePose=()=>{if(st.posePool.length===0)st.posePool=shuffle(POSING.slice());return st.posePool.shift();};

  const moveCard=(o,no)=>`<div class="qcard"><div class="qtop"><div class="qnum2">${no}</div>
    <div class="qbody"><div class="qmove">${esc(o.move)}</div></div><button class="hintbtn">힌트 ▾</button></div>
    <div class="hint">${ol(o.steps)}</div></div>`;
  const cmpCard=o=>`<div class="qcard cmp"><div class="qtop"><div class="qnum2">복</div>
    <div class="qbody"><div class="qmove">${esc(o.move)}</div></div><button class="hintbtn">힌트 ▾</button></div>
    <div class="hint"><div class="ex">${o.ex}</div></div></div>`;
  const poseCard=o=>`<div class="qcard pose-card"><div class="qtop"><div class="qnum2">포</div>
    <div class="qbody"><div class="qmove">${esc(o.move)} · ${esc(o.count)}</div></div><button class="hintbtn">힌트 ▾</button></div>
    <div class="hint">${o.poses.map(p=>`<div class="pose"><div class="posen">${esc(p.n)}</div>${ol(p.s)}</div>`).join('')}</div></div>`;

  function drawSet(){
    if(st.pool.length===0){showDone(); return;}
    st.setNo++;
    const moves=st.pool.splice(0,Math.min(SET_SIZE,st.pool.length));
    st.drawn+=moves.length;
    const cmp=pick(COMPOUND), pose=cyclePose();
    const cmpItem={move:cmp.m,ex:cmp.ex}, poseItem={move:pose.cat,count:pose.count,poses:pose.poses};
    $('pracBoard').innerHTML=
      `<div class="setlabel"><div class="badge">SET ${st.setNo}</div>
       <div class="desc">동작 ${moves.length} + 복합 1 + 포징 1 · 남은 동작 ${st.pool.length}개</div></div>`+
      moves.map((m,i)=>moveCard(m,i+1)).join('')+cmpCard(cmpItem)+poseCard(poseItem);
    st.history.unshift({no:st.setNo,moves,cmp:cmpItem,pose:poseItem});
    renderHistory(); progress();
    $('pracDraw').textContent=st.pool.length===0?'전 동작 완료 · 복합 더 뽑기':'다음 세트 추첨';
  }
  function progress(){
    const pct=Math.round(st.drawn/TOTAL*100);
    $('pracLabel').innerHTML=`동작 <b>${st.drawn}</b> / ${TOTAL}`;
    $('pracBar').style.width=pct+'%'; $('pracPct').textContent=pct+'%';
  }
  const reviewRow=(no,part,title,body,cls='')=>`<div class="rq${cls?' '+cls:''}"><div class="rqh">
    <span class="rqn">${no}</span><span class="rqp">${esc(part)}</span> <span class="rqm">${esc(title)}</span></div>${body}</div>`;
  function renderHistory(){
    if(!st.history.length){$('pracPast').innerHTML=''; return;}
    $('pracPast').innerHTML='<div class="past-h">지난 세트</div>'+st.history.map(s=>{
      const summary=[...s.moves.map(m=>esc(m.move)),`<span class="cx">${esc(s.cmp.move)}</span>`,`<span class="px">${esc(s.pose.move)}</span>`].join(' · ');
      const detail=s.moves.map((m,i)=>reviewRow(i+1,m.part,m.move,`<ol class="rol">${m.steps.map(x=>`<li>${esc(x)}</li>`).join('')}</ol>`)).join('')
        +reviewRow('복','복합세트',s.cmp.move,`<div class="rex">${s.cmp.ex}</div>`,'cx')
        +reviewRow('포','포징 · '+s.pose.count,s.pose.move,`${s.pose.poses.map(p=>`<div class="pose"><div class="posen">${esc(p.n)}</div><ol class="rol">${p.s.map(x=>`<li>${esc(x)}</li>`).join('')}</ol></div>`).join('')}`,'px');
      return `<div class="pset"><div class="psum"><div class="ph">SET ${s.no} <span class="caret">▾</span></div><div class="pm">${summary}</div></div><div class="pdetail">${detail}</div></div>`;
    }).join('');
  }
  function showDone(){
    $('pracBoard').innerHTML=`<div class="done-card"><div class="emoji">💪</div>
      <div class="dtitle">${TOTAL}개 동작 전부 소진!</div><div class="dmsg">모든 동작을 한 바퀴 돌았어요. 초기화하고 내일 또 도세요.</div></div>`;
    $('pracDraw').textContent='세트 추첨'; st.pool=shuffle(flatMoves()); st.drawn=0;
  }
  const flatMoves=()=>PARTS.flatMap(p=>DATA[p].map(o=>({part:p,move:o.m,steps:o.s})));
  function reset(){
    Object.assign(st,{drawn:0,history:[],setNo:0});
    st.pool=shuffle(flatMoves()); st.posePool=shuffle(POSING.slice());
    $('pracDraw').disabled=false; $('pracDraw').textContent='세트 추첨';
    disarm();
    $('pracBoard').innerHTML=`<div class="done-card"><div class="emoji">🎲</div>
      <div class="dtitle">세트를 뽑아보세요</div><div class="dmsg">버튼을 누르면 동작 3개 + 복합세트 + 포징이 한 세트로 나와요.</div></div>`;
    renderHistory(); progress();
  }
  // 힌트/복습 토글 (이벤트 위임)
  $('pracBoard').onclick=e=>{const b=e.target.closest('.hintbtn'); if(!b)return;
    const h=b.closest('.qcard').querySelector('.hint'); b.textContent=h.classList.toggle('open')?'힌트 ▴':'힌트 ▾';};
  $('pracPast').onclick=e=>{const s=e.target.closest('.psum'); if(!s)return;
    const p=s.closest('.pset'); p.classList.toggle('open'); p.querySelector('.caret').textContent=p.classList.contains('open')?'▴':'▾';};
  // 초기화 2단 확인
  let armed=false,timer=null;
  const disarm=()=>{armed=false; $('pracReset').textContent='전체 초기화'; $('pracReset').classList.remove('armed');};
  $('pracReset').onclick=()=>{
    if(st.drawn===0){reset(); return;}
    if(!armed){armed=true; $('pracReset').textContent='한 번 더 누르면 초기화'; $('pracReset').classList.add('armed'); timer=setTimeout(disarm,2500);}
    else{clearTimeout(timer); reset();}
  };
  $('pracDraw').onclick=drawSet;
  return {init};
})();

/* ===== 부트스트랩 ===== */
Promise.all([
  fetch('questions.json').then(r=>r.json()),
  fetch('practice.json').then(r=>r.json())
]).then(([q,p])=>{ Oral.init(q); Practice.init(p); })
 .catch(()=>{ $('oralBoard').innerHTML='<div class="loading">데이터를 불러오지 못했어요. questions.json / practice.json이 같은 폴더(또는 깃허브)에 있는지 확인해 주세요.</div>'; });
