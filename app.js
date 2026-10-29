'use strict';
(()=>{
// TrickLog 1.3.0 RC2: production migration candidate, NOT authorized for deployment.
// When running on the approved production origin use the existing v1.2.1 storage key.
// On separate preview origins storage remains isolated and cannot touch production data.
// Backwards-compatible with v1.x's tricklog_v1 localStorage data.
// Deliberately no analytics, account, remote APIs, or user-data network requests.
// Production identity intentionally kept unchanged across 1.2.1 -> 1.3.0.
const IS_PRODUCTION_ORIGIN = typeof location !== 'undefined' &&
 location.hostname === 'kensuke44.github.io' &&
 /^\/tricklog(?:\/|$)/.test(location.pathname || '');
// Refuse an unexpected GitHub Pages project before reading or writing storage.
if (typeof location !== 'undefined' && location.hostname.endsWith('.github.io') && !IS_PRODUCTION_ORIGIN) {
 const root=document.getElementById('app');
 if(root)root.textContent='このリリース候補は指定したTrickLogの公開先でのみ使用できます。';
 document.querySelector('.bottomnav')?.remove();
 return;
}
const STORE=IS_PRODUCTION_ORIGIN ? 'tricklog_v1' : 'tricklog_phase7_rc_preview_v1';
const id=()=> 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const clone=x=>JSON.parse(JSON.stringify(x));
// Default is for new installations and explicit "reset to sample" only. Existing local data is never overwritten.
function defaultMenu(){
 const make=(group,name,type,target,extra={})=>({id:id(),group,name,type,target,detail:'',...extra});
 return {name:'練習メニュー（サンプル）',steps:[
  make('① 基本技','トラピーズ','count',10,{inputMode:'batch',batchSize:5}),
  make('② 音ハメ','グリーントライアングル','timing',5,{inputMode:'batch',batchSize:5}),
  make('③ コンボ','コンボ練習','full',1,{skills:[
   {id:id(),part:'コンボ',name:'トラピーズ'},
   {id:id(),part:'コンボ',name:'グリーントライアングル'},
   {id:id(),part:'コンボ',name:'サマーソルトバインド'}
  ],showTiming:false,timingLabel:'音ハメ'}),
  make('④ 通し','通し練習（2分）','rating',1)
 ]};
}
// Give rated skills stable identifiers so name edits and reordering preserve their ○△× records.
function migrateSkillIds(state){
 if(!state||!state.menu)return;
 const master=new Map();
 for(const step of state.menu.steps||[]){
  if(step.type!=='full')continue;
  step.skills=Array.isArray(step.skills)?step.skills:[];
  for(const skill of step.skills)if(!skill.id)skill.id=id();
  master.set(step.id,step.skills);
 }
 const active=state.active;
 if(!active?.menu)return;
 for(const step of active.menu.steps||[]){
  if(step.type!=='full')continue;
  step.skills=Array.isArray(step.skills)?step.skills:[];
  const masterSkills=master.get(step.id)||[];
  step.skills.forEach((sk,index)=>{
   if(sk.id)return;
   // Old saved records have ratings by position. Match the original stable order first.
   const candidate=masterSkills[index];
   if(candidate&&candidate.name===sk.name&&candidate.part===sk.part)sk.id=candidate.id;
   else {const match=masterSkills.find(v=>v.name===sk.name&&v.part===sk.part);sk.id=match?match.id:id();}
  });
 }
}
function blankEntry(s){if(s.type==='check')return{done:false};if(s.type==='count'||s.type==='timing')return{trials:[],batches:[]};if(s.type==='sync')return{trials:[]};if(s.type==='rating')return{rating:null,note:''};return{ratings:Array((s.skills||[]).length).fill(null),timing:'',stopped:'',other:''};}
function newSession(menu,date=today()){return{id:id(),date,status:'active',stepIndex:0,menu:clone(menu),entries:Object.fromEntries(menu.steps.map(s=>[s.id,blankEntry(s)])),archivedItems:[],notes:'',endReason:'',endMemo:'',created:new Date().toISOString()};}
function initial(){let menu=defaultMenu();return{menu,active:newSession(menu),history:[],settings:{theme:'light'},improvementTests:[],recordMeta:{},exerciseLinks:{}};}
let data=initial(),storageOK=true;
try{const x=JSON.parse(localStorage.getItem(STORE));if(x&&x.menu&&Array.isArray(x.menu.steps)&&Array.isArray(x.history)){data=x;if(!data.active)data.active=newSession(data.menu);if(!data.settings)data.settings={theme:'light'};if(!data.active.archivedItems)data.active.archivedItems=[];}}catch(err){storageOK=false;console.warn('Storage unavailable',err);}
migrateSkillIds(data);
// Only additive metadata: existing batches, legacy trials and completed history stay untouched.
if(!Array.isArray(data.improvementTests))data.improvementTests=[];
if(!data.recordMeta||typeof data.recordMeta!=='object'||Array.isArray(data.recordMeta))data.recordMeta={};
if(!data.exerciseLinks||typeof data.exerciseLinks!=='object'||Array.isArray(data.exerciseLinks))data.exerciseLinks={};
// Last durable snapshot for legacy UI paths that modify memory before persisting.
let lastDurableState=clone(data);
const themeValues=['light','dark','system'];
if(!themeValues.includes(data.settings.theme))data.settings.theme='light';
const applyTheme=()=>{document.documentElement.dataset.theme=data.settings.theme;document.querySelector('meta[name="theme-color"]').content=(data.settings.theme==='dark'||data.settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'#101621':'#f7f8fc';};
applyTheme();
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(data.settings.theme==='system')applyTheme();});}catch{}
let screen='practice',editExpanded=null,historyOpen=null,syncDraft={skill:'',timing:''},batchChoice={},improvementMemoDraft={},improvementDetailOpen={},improvementHistoryLimit={},completedListOpen={},completedDetailOpen={},offMenuExpanded=false;
const app=document.querySelector('#app');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=sel=>document.querySelector(sel);
function persist(){
 try{localStorage.setItem(STORE,JSON.stringify(data));lastDurableState=clone(data);storageOK=true;return true;}
 catch(err){
  data=clone(lastDurableState);storageOK=false;
  // Revert any optimistic in-memory edits to the last successfully saved state.
  applyTheme();render();notify('保存できません。直前の変更を取り消しました');return false;
 }
}
// Phase 1 writes use copy -> validate/mutate -> persist -> publish, so failed writes
// never claim success or alter the on-screen source of truth.
function commitUpdate(change){
 const next=clone(data);
 try{
  if(change(next)===false)return false;
  localStorage.setItem(STORE,JSON.stringify(next));
  data=next;lastDurableState=clone(next);storageOK=true;return true;
 }catch(err){storageOK=false;notify('保存できません。記録は変更していません');render();return false;}
}
const recordKey=(sessionId,stepId,itemId)=>JSON.stringify([sessionId,stepId,itemId]);
function isProtectedRecord(st,key){return (st.improvementTests||[]).some(t=>t.baselineRecordKey===key||Array.isArray(t.recordKeys)&&t.recordKeys.includes(key));}
function recordedOn(st,sessionId,stepId,itemId,fallback){return st.recordMeta?.[recordKey(sessionId,stepId,itemId)]?.performedDate||fallback;}

// Phase 2: improvement tests reference the unique source records; no duplicate counters.
// Phase 4: stable cross-menu exercise identity is separate from menu step IDs.
// A link is valid only for its original metric; no mixing count / timing / legacy sync.
const metricFor=step=>['count','timing','sync'].includes(step?.type)?step.type:null;
const exerciseFor=(step,st=data)=>{
 const metric=metricFor(step);if(!metric)return null;
 const link=st.exerciseLinks?.[step.id];
 return link?.metricKey===metric&&typeof link.exerciseKey==='string'&&link.exerciseKey
  ?link.exerciseKey:JSON.stringify([step.id,metric]);
};
const pct=(success,attempts)=>attempts?Math.round(success/attempts*100)+'%':'—';
const deltaPt=(current,prev)=>current&&prev&&current.attempts&&prev.attempts
 ?`${Math.round(100*(current.successes/current.attempts-prev.successes/prev.attempts))>=0?'+':''}${Math.round(100*(current.successes/current.attempts-prev.successes/prev.attempts))}pt`:'—';
function sourceRecords(st,session,step){
 const activeStep=session?.menu?.steps?.find(x=>x.id===step.id&&x.type===step.type);
 const entry=(activeStep?session?.entries?.[step.id]:null)||session?.archivedItems?.find(x=>x.step.id===step.id&&x.step.type===step.type)?.entry;if(!entry)return [];
 const trials=(Array.isArray(entry.trials)?entry.trials:[]).flatMap((v,i)=>{
  const recordId=v&&typeof v==='object'&&v.id?v.id:'legacy-'+i;
  const key=recordKey(session.id,step.id,recordId),meta=st.recordMeta?.[key];
  if(meta?.deleted)return [];
  const success=step.type==='sync'?Number((meta?.overrideSkill??v?.skill)==='ok'&&(meta?.overrideTiming??v?.timing)==='fit'):Number(meta?.overrideSuccesses??(v===true));
  return [{recordKey:key,attempts:1,successes:success,recordedAt:v&&typeof v==='object'?v.recordedAt:null,performedDate:recordedOn(st,session.id,step.id,recordId,session.date),kind:'trial'}];
 });
 const batches=(Array.isArray(entry.batches)?entry.batches:[]).filter(b=>!st.recordMeta?.[recordKey(session.id,step.id,b.id)]?.deleted).map(b=>({recordKey:recordKey(session.id,step.id,b.id),attempts:b.attempts,successes:b.successes,recordedAt:b.recordedAt,performedDate:recordedOn(st,session.id,step.id,b.id,session.date),kind:'batch'}));
 // Never change original indexes of legacy trials: tombstones preserve their keys.
 return [...trials,...batches];
}
function resolveRecord(st,key){
 if(!key)return null;
 let parts;try{parts=JSON.parse(key);}catch{return null;}
 if(!Array.isArray(parts)||parts.length!==3)return null;
 const [sessionId,stepId]=parts;
 const ss=distinctSessions(st).find(v=>v.id===sessionId);if(!ss)return null;
 const possible=[...(ss.menu.steps||[]).filter(x=>x.id===stepId),...(ss.archivedItems||[]).filter(x=>x.step.id===stepId).map(x=>x.step)];
 for(const step of possible){const found=sourceRecords(st,ss,step).find(x=>x.recordKey===key);if(found)return found;}
 return null;
}
function ongoingTest(st,step){
 const key=exerciseFor(step,st);return key?(st.improvementTests||[]).find(t=>t.exerciseKey===key&&['active','paused'].includes(t.status)):null;
}
function latestNormalRecord(st,step){
 const entry=st.active?.entries?.[step.id];if(!entry)return null;
 const recs=sourceRecords(st,st.active,step);
 const busy=new Set((st.improvementTests||[]).flatMap(t=>[t.baselineRecordKey,...(t.recordKeys||[])]));
 const past=st.improvementTests||[];
 const completed=past.filter(t=>t.exerciseKey===exerciseFor(step,st)&&t.status==='completed').sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)));
 const last=completed[0]||null;
 const lastEnd=last?Date.parse(last.completedAt)||0:0;
 const cursor=last?.completionRecordKey?recs.findIndex(r=>r.recordKey===last.completionRecordKey):-1;
 // An ordering cursor beats millisecond timestamps for the same source session.
 for(let i=recs.length-1;i>=0;i--){
  const r=recs[i],meta=st.recordMeta?.[r.recordKey];
  if(busy.has(r.recordKey)||meta?.kind==='improvement')continue;
  if(lastEnd){
   if(cursor>=0){if(i<=cursor)continue;}
   else if(!r.recordedAt||Date.parse(r.recordedAt)<lastEnd)continue;
  }
  return r;
 }
 return null;
}
function recordAsImprovement(st,step,itemId){
 const t=ongoingTest(st,step),key=recordKey(st.active.id,step.id,itemId);
 const meta=st.recordMeta[key];
 if(t&&t.status==='active'){
  const memo=(improvementMemoDraft[step.id]||'').slice(0,700);
  t.recordKeys.push(key);t.updatedAt=new Date().toISOString();
  meta.kind='improvement';meta.testId=t.id;meta.memo=memo;meta.sequence=t.recordKeys.length;
 }
 return !!(t&&t.status==='active');
}
function startImprovement(st,step){
 if(!metricFor(step)||ongoingTest(st,step))return false;
 const baseline=latestNormalRecord(st,step);if(!baseline)return false;
 st.improvementTests.push({id:id(),exerciseKey:exerciseFor(step,st),stepId:step.id,stepName:step.name,metricKey:step.type,status:'active',baselineRecordKey:baseline.recordKey,recordKeys:[],createdAt:new Date().toISOString()});
 return true;
}
function completeImprovementById(st,testId){
 const t=st.improvementTests.find(v=>v.id===testId&&['active','paused'].includes(v.status));if(!t)return false;
 if(!t.recordKeys.length)return cancelImprovementById(st,testId);
 t.completionRecordKey=t.recordKeys.at(-1)||null;
 t.status='completed';t.completedAt=new Date().toISOString();return true;
}
function cancelImprovementById(st,testId){
 const t=st.improvementTests.find(v=>v.id===testId&&['active','paused'].includes(v.status));if(!t)return false;
 for(const key of t.recordKeys){const meta=st.recordMeta?.[key];if(meta&&meta.testId===t.id){meta.kind='normal';delete meta.testId;delete meta.memo;delete meta.sequence;}}
 st.improvementTests=st.improvementTests.filter(v=>v.id!==t.id);return true;
}
function completeImprovement(st,step){const t=ongoingTest(st,step);return t?completeImprovementById(st,t.id):false;}
function cancelImprovement(st,step){const t=ongoingTest(st,step);return t?cancelImprovementById(st,t.id):false;}
// Phase 3: resolve original records without ever mutating legacy arrays in place.
function locateRecord(st,key){
 let parts;try{parts=JSON.parse(key);}catch{return null;}
 if(!Array.isArray(parts)||parts.length!==3)return null;
 const [sid,stepId,itemId]=parts;
 const ss=distinctSessions(st).find(v=>v.id===sid);
 if(!ss)return null;
 const possible=[...(ss.menu.steps||[]).filter(v=>v.id===stepId).map(step=>({step,entry:ss.entries?.[stepId]})),...(ss.archivedItems||[]).filter(v=>v.step.id===stepId).map(v=>({step:v.step,entry:v.entry}))];
 for(const {step,entry} of possible){
  if(!entry)continue;
  const bi=(entry.batches||[]).findIndex(v=>v.id===itemId);
  if(bi>=0)return {ss,step,entry,type:'batch',index:bi,item:entry.batches[bi]};
  const ti=(entry.trials||[]).findIndex((v,i)=>(v&&typeof v==='object'&&v.id?v.id:'legacy-'+i)===itemId);
  if(ti>=0)return {ss,step,entry,type:'trial',index:ti,item:entry.trials[ti]};
 }
 return null;
}
function validPracticeDate(value){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return false;
 const time=Date.parse(value+'T00:00:00Z');return Number.isFinite(time)&&new Date(time).toISOString().slice(0,10)===value;
}
function syncEditedHistory(st,sessionId){
 // Active is the authoritative copy if its ID matches a completed history snapshot.
 if(st.active?.id===sessionId){
  const idx=st.history.findIndex(row=>row.id===sessionId);
  if(idx>=0)st.history[idx]=clone(st.active);
 }
}
function updateImprovementRecord(st,key,changes){
 const r=resolveRecord(st,key),loc=locateRecord(st,key);if(!r||!loc)return false;
 const attempts=Number(changes.attempts),successes=Number(changes.successes),date=changes.performedDate;
 if(!Number.isInteger(attempts)||attempts<1||attempts>10||!Number.isInteger(successes)||successes<0||successes>attempts||!validPracticeDate(date))return false;
 // An individually recorded trial is a single attempt; original records are retained.
 if(loc.type==='trial'&&(attempts!==1||successes>1))return false;
 if(loc.type==='batch'){
  loc.item.attempts=attempts;loc.item.successes=successes;
 }else if(loc.step.type==='sync'){
  const originalSkill=loc.item?.skill,originalTiming=loc.item?.timing;
  const nextSkill=successes===1?'ok':originalSkill;
  const nextTiming=successes===1?'fit':(originalSkill==='ok'&&originalTiming==='fit'?'early':originalTiming);
  const meta=st.recordMeta[key]||(st.recordMeta[key]={});meta.overrideSkill=nextSkill;meta.overrideTiming=nextTiming;
 }else{
  const meta=st.recordMeta[key]||(st.recordMeta[key]={});meta.overrideSuccesses=successes;
 }
 const meta=st.recordMeta[key]||(st.recordMeta[key]={});
 meta.performedDate=date;
 if(changes.memo!==undefined)meta.memo=String(changes.memo).slice(0,700);
 syncEditedHistory(st,loc.ss.id);
 return true;
}
function detachImprovementTest(st,t){
 const baselineMeta=st.recordMeta?.[t.baselineRecordKey];
 if(baselineMeta&&!st.improvementTests.some(x=>x.id!==t.id&&x.baselineRecordKey===t.baselineRecordKey))delete baselineMeta.memo;
 for(const key of t.recordKeys||[]){const meta=st.recordMeta?.[key];if(meta&&meta.testId===t.id){meta.kind='normal';delete meta.testId;delete meta.memo;delete meta.sequence;}}
 st.improvementTests=st.improvementTests.filter(x=>x.id!==t.id);
}
function deleteImprovementTest(st,testId){
 const test=st.improvementTests.find(t=>t.id===testId&&t.status==='completed');if(!test)return false;
 detachImprovementTest(st,test);return true;
}
function deleteImprovementRecord(st,key){
 const loc=locateRecord(st,key),r=resolveRecord(st,key);if(!loc||!r||!isProtectedRecord(st,key))return false;
 if(st.improvementTests.some(t=>t.baselineRecordKey===key))return false;
 const t=st.improvementTests.find(v=>v.recordKeys?.includes(key));if(!t)return false;
 // New batches are physically removed. Legacy trials are tombstoned to protect index keys.
 if(loc.type==='batch')loc.entry.batches.splice(loc.index,1);
 else {st.recordMeta[key]||(st.recordMeta[key]={});st.recordMeta[key].deleted=true;}
 t.recordKeys=t.recordKeys.filter(x=>x!==key);
 // A completed test cannot be reopened after its final set is deleted.
 if(t.status==='completed'&&!t.recordKeys.length)detachImprovementTest(st,t);
 delete st.recordMeta[key];
 if(loc.type==='trial')st.recordMeta[key]={deleted:true};
 syncEditedHistory(st,loc.ss.id);
 return true;
}
function improvementHistoryRows(t){
 const limit=improvementHistoryLimit[t.id]||5;
 const shown=t.recordKeys.slice(-limit).reverse();let lastDate=null;
 let h='<div class="improve-history">';
 for(let i=0;i<shown.length;i++){
  const key=shown[i],r=resolveRecord(data,key),meta=data.recordMeta?.[key];
  if(!r){h+='<p class="alert">参照先の記録が見つかりません。復元情報を確認してください。</p>';continue;}
  const dateChanged=lastDate!==null&&lastDate!==r.performedDate;
  if(dateChanged)h+='<div class="mini improve-date-separator">練習日の切り替わり</div>';
  lastDate=r.performedDate;
  h+=`<button type="button" class="improve-row improve-row-button" data-action="improve-edit" data-record-key="${safe(key)}"><span>${safe(r.performedDate)}</span><strong>${r.successes}/${r.attempts}（${pct(r.successes,r.attempts)}） ›</strong>${meta?.memo?`<span class="mini improve-row-memo">${safe(meta.memo)}</span>`:''}</button>`;
 }
 h+='</div>';
 if(t.recordKeys.length>shown.length)h+=`<button class="btn line small wide top-margin" data-action="improve-more" data-testid="${safe(t.id)}">過去の履歴を5件表示（残り${t.recordKeys.length-shown.length}件）</button>`;
 return h;
}
function improvementBaselineButton(t){
 const base=resolveRecord(data,t.baselineRecordKey);
 return base?`<button type="button" class="improve-baseline-edit" data-action="improve-edit" data-record-key="${safe(t.baselineRecordKey)}">初期基準 ${base.successes}/${base.attempts}（${pct(base.successes,base.attempts)}） · ${safe(base.performedDate)}　編集 ›</button>`:'<p class="alert">初期基準が見つかりません</p>';
}
function completedImprovementList(prior){
 if(!prior.length)return '';
 const label=prior[0].exerciseKey,open=!!completedListOpen[label];
 let html=`<div class="improve-box top-margin"><button type="button" class="btn line small wide" data-action="improve-completed-toggle" data-exercise="${safe(label)}">過去の改善テスト（${prior.length}件） ${open?'▲':'▼'}</button>`;
 if(open){
  for(const t of [...prior].sort((a,b)=>String(b.completedAt).localeCompare(String(a.completedAt)))){
   const last=resolveRecord(data,t.recordKeys.at(-1)),base=resolveRecord(data,t.baselineRecordKey),expanded=!!completedDetailOpen[t.id];
   html+=`<div class="improve-completed-item"><button class="btn line small wide" data-action="improve-completed-detail" data-testid="${safe(t.id)}">${safe((t.completedAt||t.createdAt||'').slice(0,10))} 完了　${base?pct(base.successes,base.attempts):'—'} → ${last?pct(last.successes,last.attempts):'—'}（${deltaPt(last,base)}） ${expanded?'▲':'▼'}</button>`;
   if(expanded){html+=improvementBaselineButton(t)+improvementHistoryRows(t);
    html+=`<button class="btn small red wide top-margin" data-action="improve-completed-delete" data-testid="${safe(t.id)}">この改善テスト履歴を削除（練習実績は保持）</button>`;}
   html+='</div>';
  }
 }
 return html+'</div>';
}
// Transactional editor: numeric changes remain only in the modal until Save.
function openImprovementEditor(key){
 const r=resolveRecord(data,key),loc=locateRecord(data,key);if(!r||!loc){notify('編集する記録が見つかりません');return;}
 let attempts=r.attempts,successes=r.successes,practiceDate=r.performedDate;
 let memo=String(data.recordMeta?.[key]?.memo||'');
 const base=data.improvementTests.some(t=>t.baselineRecordKey===key),trial=loc.type==='trial';
 const root=$('#modal-root');
 function paint(){
  root.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><h2>${base?'初期基準を編集':'改善セットを編集'}</h2>
    <div class="field"><label>練習日</label><input id="improve-edit-date" type="date" value="${safe(practiceDate)}"></div>
    <div class="field"><label>試行回数 ${trial?'（旧1回記録のため固定）':''}</label><div class="btnrow"><button class="btn small line" id="improve-attempt-minus" ${trial||attempts<=1?'disabled':''}>−</button><strong class="improve-attempt-count">${attempts}回</strong><button class="btn small line" id="improve-attempt-plus" ${trial||attempts>=10?'disabled':''}>＋</button></div></div>
    <div class="field"><label>成功回数をタップ</label><div class="batch-numbers">${Array.from({length:attempts+1},(_,i)=>`<button type="button" class="batch-number ${i===successes?'improve-selected':''}" data-edit-success="${i}">${i}</button>`).join('')}</div></div>
    <div class="field"><label>修正メモ（任意）</label><textarea id="improve-edit-memo" maxlength="700">${safe(memo)}</textarea></div>
    <div class="btnrow top-margin"><button class="btn line fill" id="improve-edit-cancel">キャンセル</button><button class="btn primary fill" id="improve-edit-save">保存</button></div>
    ${base?'':'<button class="btn small red wide top-margin" id="improve-edit-delete">このセットを削除</button>'}</div>`;
  root.querySelector('#improve-edit-date').onchange=ev=>{practiceDate=ev.target.value;};
  root.querySelector('#improve-edit-memo').oninput=ev=>{memo=ev.target.value.slice(0,700);};
  root.querySelector('#improve-attempt-minus').onclick=()=>{if(attempts>1&&!trial){attempts--;successes=Math.min(successes,attempts);paint();}};
  root.querySelector('#improve-attempt-plus').onclick=()=>{if(attempts<10&&!trial){attempts++;paint();}};
  root.querySelectorAll('[data-edit-success]').forEach(button=>button.onclick=()=>{successes=Number(button.dataset.editSuccess);paint();});
  root.querySelector('#improve-edit-cancel').onclick=()=>{root.innerHTML='';};
  root.querySelector('#improve-edit-save').onclick=()=>{
   if(!validPracticeDate(practiceDate)){notify('正しい練習日を入力してください');return;}
   const ok=commitUpdate(st=>updateImprovementRecord(st,key,{attempts,successes,performedDate:practiceDate,memo}));
   if(ok){root.innerHTML='';render();notify('記録を保存しました');}
  };
  if(!base)root.querySelector('#improve-edit-delete').onclick=()=>{
   const test=data.improvementTests.find(t=>t.recordKeys?.includes(key));
   const lastCompleted=!!(test?.status==='completed'&&test.recordKeys.length===1);
   dialog('この改善セットを削除しますか？',lastCompleted?'試行・成功実績も削除します。最後のセットなので空の完了済みテスト履歴も削除します。':'このセットの試行・成功実績と修正メモが削除され、比較と日別集計が再計算されます。','削除する',()=>{
    if(!commitUpdate(st=>deleteImprovementRecord(st,key)))return false;
    delete improvementHistoryLimit[test?.id];root.innerHTML='';render();notify('改善セットを削除しました');return true;
   });
  };
 }
 paint();
}
function improvementPanel(step){
 const live=ongoingTest(data,step),prior=data.improvementTests.filter(x=>x.exerciseKey===exerciseFor(step)&&x.status==='completed');
 const canUse=['active','complete'].includes(data.active?.status);
 const candidate=!live&&canUse?latestNormalRecord(data,step):null;
 let html='';
 if(!live){if(candidate)html+=`<div class="improve-box top-margin"><button class="btn line wide" data-action="improve-start">改善テスト開始</button></div>`;
  return html+completedImprovementList(prior);
 }
 const baseline=resolveRecord(data,live.baselineRecordKey);
 const lastKey=live.recordKeys.at(-1),last=resolveRecord(data,lastKey);
 const previous=live.recordKeys.length>1?resolveRecord(data,live.recordKeys.at(-2)):baseline;
 const running=live.status==='active';
 html+=`<div class="improve-box top-margin"><div class="row"><strong>改善テスト ${running?'進行中':'一時停止中'}</strong><span class="pill ${running?'done':'warn'}">${running?'比較中':'通常練習'}</span></div>`;
 html+=`<div class="improve-compare"><div><span>初期基準</span><strong>${baseline?`${baseline.successes}/${baseline.attempts}（${pct(baseline.successes,baseline.attempts)}）`:'参照先なし'}</strong></div>`;
 if(last)html+=`<div><span>直近の改善セット</span><strong>${last.successes}/${last.attempts}（${pct(last.successes,last.attempts)}）</strong></div><div><span>初期基準との差</span><strong>${deltaPt(last,baseline)}</strong></div><div><span>直前セットとの差</span><strong>${deltaPt(last,previous)}</strong></div>`;
 else html+='<div><span>比較結果</span><strong>改善セット未記録</strong></div>';
 html+='</div>';
 if(!baseline)html+='<p class="alert">初期基準の記録が見つかりません。追加記録せず復元をご確認ください。</p>';
 if(running&&canUse&&baseline){
  html+=`<details class="improve-memo"><summary>次のセットの修正メモ（任意）</summary><div class="field"><label>メモ（入力しなくても記録できます）</label><textarea data-improve-memo="${safe(step.id)}" maxlength="700" placeholder="例：右手を少し高くする">${safe(improvementMemoDraft[step.id]||'')}</textarea></div></details>`;
 }else if(!running)html+='<p class="note">一時停止中の記録は通常練習として保存され、改善比較には含めません。</p>';
 html+=`<div class="top-margin">${improvementBaselineButton(live)}</div>`;
 if(live.recordKeys.length){
  const opened=!!improvementDetailOpen[live.id];
  html+=`<button class="btn small line wide top-margin" data-action="improve-detail" data-testid="${safe(live.id)}">${opened?'セット履歴を閉じる':'セット履歴を表示'}（${live.recordKeys.length}件）</button>`;
  if(opened)html+=improvementHistoryRows(live);
 }
 html+='<div class="btnrow top-margin">';
 if(running)html+='<button class="btn line fill" data-action="improve-pause">改善テストを一時停止</button>';
 else html+='<button class="btn primary fill" data-action="improve-resume" '+(canUse?'':'disabled')+'>改善テストを再開</button>';
 html+='<button class="btn line fill" data-action="improve-end">改善テスト終了</button></div>';
 html+=`<button class="btn small plain wide top-margin" data-action="improve-cancel">${live.recordKeys.length?'改善テスト全体を取り消す':'開始を取り消す'}</button></div>`;
 return html+completedImprovementList(prior);
}

// Session snapshots in history and active share the same ID and represent ONE session.
function distinctSessions(st){const byId=new Map();for(const h of st.history||[])byId.set(h.id,h);if(st.active)byId.set(st.active.id,st.active);return [...byId.values()];}
function dailyTotals(st,whichDate){
 let attempts=0,successes=0;
 const byType={count:{attempts:0,successes:0},timing:{attempts:0,successes:0},sync:{attempts:0,successes:0}};
 for(const ss of distinctSessions(st)){
  const collect=(step)=>{
   if(!step||!['count','timing','sync'].includes(step.type))return;
   for(const r of sourceRecords(st,ss,step)){
    if(r.performedDate!==whichDate)continue;
    attempts+=r.attempts;successes+=r.successes;
    byType[step.type].attempts+=r.attempts;byType[step.type].successes+=r.successes;
   }
  };
  for(const step of ss.menu.steps||[])collect(step);
  for(const archived of ss.archivedItems||[])if(!ss.menu.steps.some(x=>x.id===archived.step.id&&x.type===archived.step.type))collect(archived.step);
 }
 return {attempts,successes,byType};
}

function notify(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),2800);}
function dialog(title,body,yes,onYes,extra=''){const root=$('#modal-root');root.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><h2>${safe(title)}</h2><p>${safe(body)}</p>${extra}<div class="btnrow top-margin"><button class="btn line fill" id="modal-cancel">キャンセル</button><button class="btn primary fill" id="modal-yes">${safe(yes)}</button></div></div>`;$('#modal-cancel').onclick=()=>root.innerHTML='';$('#modal-yes').onclick=()=>{const success=onYes();if(success!==false)root.innerHTML='';};}
function download(name,content,mime='application/json'){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const ratio=(a,b)=>b?Math.round(a/b*100)+'%':'—';
// Legacy individual trials are preserved verbatim. New quick/aggregate input uses batches.
const batchList=e=>Array.isArray(e?.batches)?e.batches:[];
const batchMode=s=>s.inputMode==='batch'?'batch':'single'; // Old menus keep their 1-by-1 setting.
const configuredBatch=s=>s.batchSize===10?10:5;
function statsFor(s,e,ss=null){
 const trials=Array.isArray(e?.trials)?e.trials:[];
 const batches=batchList(e);
 const effective=ss?sourceRecords(data,ss,s):null;
 if(s.type==='sync'){
  const visible=trials.map((x,i)=>({x,meta:ss?data.recordMeta?.[recordKey(ss.id,s.id,x?.id||'legacy-'+i)]:null})).filter(v=>!v.meta?.deleted);
  const skill=visible.filter(({x,meta})=>(meta?.overrideSkill??x?.skill)==='ok').length;
  const matched=visible.filter(({x,meta})=>(meta?.overrideSkill??x?.skill)==='ok'&&(meta?.overrideTiming??x?.timing)==='fit').length;
  const decided=visible.filter(({x,meta})=>(meta?.overrideTiming??x?.timing)!=='unknown').length;
  const fit=visible.filter(({x,meta})=>(meta?.overrideTiming??x?.timing)==='fit').length;
  return {attempts:visible.length,successes:skill,matched,decided,fit};
 }
 if(effective)return {attempts:effective.reduce((v,r)=>v+r.attempts,0),successes:effective.reduce((v,r)=>v+r.successes,0)};
 const legacy=s.type==='count'||s.type==='timing'?trials.filter(x=>x===true).length:0;
 const attempts=trials.length+batches.reduce((v,b)=>v+b.attempts,0);
 const successes=legacy+batches.reduce((v,b)=>v+b.successes,0);
 return {attempts,successes};
}
function hasData(s,e){if(!e)return false;switch(s.type){case 'check':return Boolean(e.done);case 'count':case 'timing':return statsFor(s,e).attempts>0;case 'sync':return Boolean(e.trials?.length);case 'rating':return Boolean(e.rating||e.note);case 'full':return Boolean(e.ratings?.some(Boolean)||e.timing||e.stopped||e.other);default:return false;}}
function entryDone(s,e,ss=data.active){if(!e)return false;switch(s.type){case'check':return !!e.done;case'count':case'timing':case'sync':return statsFor(s,e,ss).attempts>=s.target;case'rating':return e.rating!==null&&e.rating!==undefined;case'full':return !!((s.skills?.length||0)>0&&e.ratings?.length===s.skills?.length&&e.ratings.every(Boolean)&&(!s.showTiming||e.timing)&&e.stopped);default:return false;}}
// Phase 4: match only definite identities automatically; changed/ambiguous names
// require an explicit mapping during menu selection, never during practice.
const normalizedExerciseName=name=>String(name||'').normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase();
function menuLinkPlan(st,incoming){
 const groups=new Map();
 for(const t of st.improvementTests||[]){
  if(!metricFor({type:t.metricKey}))continue;
  const g=groups.get(t.exerciseKey)||{key:t.exerciseKey,metricKey:t.metricKey,names:new Set(),tests:[]};
  g.names.add(normalizedExerciseName(t.stepName));g.tests.push(t);groups.set(g.key,g);
 }
 // Include current names of linked steps, so a user may rename an entry safely.
 for(const old of st.menu.steps){const key=exerciseFor(old,st),g=groups.get(key);if(g&&g.metricKey===old.type)g.names.add(normalizedExerciseName(old.name));}
 const mapping={},used=new Set(),pending=[];
 const fresh=incoming.steps.filter(s=>metricFor(s));
 for(const step of fresh){
  const old=st.menu.steps.find(x=>x.id===step.id&&x.type===step.type);
  const same=old&&exerciseFor(old,st);
  if(same){mapping[step.id]=same;if(groups.has(same))used.add(same);}
 }
 for(const step of fresh){
  if(mapping[step.id])continue;
  const named=[...groups.values()].filter(g=>!used.has(g.key)&&g.metricKey===step.type&&g.names.has(normalizedExerciseName(step.name)));
  const duplicates=fresh.filter(s=>s.type===step.type&&normalizedExerciseName(s.name)===normalizedExerciseName(step.name)).length>1;
  if(named.length===1&&!duplicates){mapping[step.id]=named[0].key;used.add(named[0].key);}
 }
 for(const step of fresh){
  if(mapping[step.id])continue;
  const options=[...groups.values()].filter(g=>g.metricKey===step.type&&!used.has(g.key));
  if(options.length)pending.push({stepId:step.id,stepName:step.name,metricKey:step.type,options:options.map(g=>({key:g.key,label:[...g.names].filter(Boolean).at(-1)||g.tests.at(-1)?.stepName||'過去の項目',status:g.tests.some(t=>['active','paused'].includes(t.status))?'継続中':'完了履歴あり'}))});
 }
 return {mapping,pending};
}
function installMenuLinks(st,incoming,mapping){
 const seen=new Set();
 for(const step of incoming.steps){
  if(!metricFor(step))continue;
  const chosen=mapping[step.id]||JSON.stringify([step.id,step.type]);
  if(seen.has(chosen))return false;seen.add(chosen);
  // Reject mapping to a different metric and prevent linking to multiple steps.
  const existing=st.improvementTests.find(t=>t.exerciseKey===chosen);
  if(existing&&existing.metricKey!==step.type)return false;
 }
 for(const step of incoming.steps){
  if(!metricFor(step))continue;
  const key=mapping[step.id]||JSON.stringify([step.id,step.type]);
  st.exerciseLinks[step.id]={exerciseKey:key,metricKey:step.type};
 }
 st.menu=clone(incoming);
 syncActiveMenu(st);return true;
}
function openMenuLinkReview(incoming){
 const plan=menuLinkPlan(data,incoming);
 if(!plan.pending.length){
  dialog('メニューを切り替えますか？','一致を確認できた改善テストを引き継ぎます。メニューにないテストは管理画面に保存します。','切り替える',()=>{
   if(!commitUpdate(st=>installMenuLinks(st,incoming,plan.mapping)))return false;
   editExpanded=null;render();notify('メニューを切り替えました');return true;
  });return;
 }
 const root=$('#modal-root');
 const selectors=plan.pending.map((p,i)=>`<div class="field"><label>${safe(p.stepName)}（${safe(typeLabel(p.metricKey))}）</label><select data-menu-link="${i}"><option value="">新しい項目として開始（引き継がない）</option>${p.options.map(o=>`<option value="${safe(o.key)}">${safe(o.label)} / ${safe(o.status)}</option>`).join('')}</select></div>`).join('');
 root.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><h2>改善テストの引き継ぎ確認</h2><p>名称などから自動確定できない項目があります。同じ練習項目だけを選んでください。異なる記録方式は選択できません。未選択のテストは保存されます。</p>${selectors}<div class="btnrow top-margin"><button class="btn line fill" id="menu-link-cancel">戻る</button><button class="btn primary fill" id="menu-link-confirm">確認して切り替える</button></div></div>`;
 root.querySelector('#menu-link-cancel').onclick=()=>root.innerHTML='';
 root.querySelector('#menu-link-confirm').onclick=()=>{
  const mapping={...plan.mapping},taken=new Set(Object.values(mapping));
  for(let i=0;i<plan.pending.length;i++){
   const p=plan.pending[i],value=root.querySelector(`[data-menu-link="${i}"]`)?.value||'';
   if(!value)continue;
   if(taken.has(value)||!p.options.some(o=>o.key===value)){notify('同じ履歴を複数の項目には割り当てられません');return;}
   mapping[p.stepId]=value;taken.add(value);
  }
  if(!commitUpdate(st=>installMenuLinks(st,incoming,mapping)))return;
  root.innerHTML='';editExpanded=null;render();notify('確認した改善テストを引き継ぎました');
 };
}
function offMenuGroups(st){
 const inMenu=new Set(st.menu.steps.map(s=>exerciseFor(s,st)).filter(Boolean));
 const groups=new Map();
 for(const t of st.improvementTests||[]){
  if(inMenu.has(t.exerciseKey))continue;
  const g=groups.get(t.exerciseKey)||{key:t.exerciseKey,name:t.stepName||'名称不明',metricKey:t.metricKey,ongoing:null,completed:[]};
  if(['active','paused'].includes(t.status))g.ongoing=t;else if(t.status==='completed')g.completed.push(t);
  groups.set(t.exerciseKey,g);
 }
 return [...groups.values()].sort((a,b)=>Number(!!b.ongoing)-Number(!!a.ongoing)||a.name.localeCompare(b.name,'ja'));
}
function offMenuPanel(){
 const groups=offMenuGroups(data),count=groups.reduce((sum,g)=>sum+(g.ongoing?1:0)+g.completed.length,0);
 let h=`<div class="card"><button type="button" class="btn line wide" data-action="offmenu-toggle">メニュー外の改善テスト（${count}件） ${offMenuExpanded?'▲':'▼'}</button>`;
 if(!offMenuExpanded)return h+'</div>';
 h+='<p class="note">現在のメニューには表示しない改善テストです。練習実績は保存され、再びメニューに追加した際に引き継げます。</p>';
 if(!groups.length)return h+'<p class="note">メニュー外の改善テストはありません。</p></div>';
 for(const g of groups){
  h+=`<div class="offmenu-group"><strong>${safe(g.name)}</strong> <span class="mini">${safe(typeLabel(g.metricKey))}</span>`;
  if(g.ongoing){const t=g.ongoing,opened=!!improvementDetailOpen[t.id];
   h+=`<div class="row top-margin"><span class="pill ${t.status==='active'?'done':'warn'}">${t.status==='active'?'進行中':'一時停止中'} · メニュー外</span></div>`;
   h+=`<div class="top-margin">${improvementBaselineButton(t)}</div><button class="btn line small wide top-margin" data-action="improve-off-detail" data-testid="${safe(t.id)}">履歴（${t.recordKeys.length}件） ${opened?'▲':'▼'}</button>`;
   if(opened)h+=improvementHistoryRows(t);
   h+=`<div class="btnrow top-margin"><button class="btn line fill" data-action="improve-off-end" data-testid="${safe(t.id)}">改善テスト終了</button><button class="btn red fill" data-action="improve-off-cancel" data-testid="${safe(t.id)}">改善テストを取り消す</button></div>`;
  }
  if(g.completed.length)h+=completedImprovementList(g.completed);
  h+='</div>';
 }
 return h+'</div>';
}
// When a menu changes, preserve entries by stable IDs, including any recorded trials.
// Deleted items or incompatible type edits move old entries to an inspectable, exported archive.
function syncActiveMenu(st=data){const a=st.active;if(!a||!['active','paused'].includes(a.status))return;
 if(!a.archivedItems)a.archivedItems=[];
 const oldSteps=a.menu.steps;
 const previous=oldSteps[a.stepIndex]?.id;
 for(const old of oldSteps){const updated=st.menu.steps.find(s=>s.id===old.id);if(!updated){if(hasData(old,a.entries[old.id]))a.archivedItems.push({step:clone(old),entry:clone(a.entries[old.id]),reason:'メニューから削除',date:new Date().toISOString()});delete a.entries[old.id];}
 else if(updated.type!==old.type){if(hasData(old,a.entries[old.id]))a.archivedItems.push({step:clone(old),entry:clone(a.entries[old.id]),reason:'記録方式の変更',date:new Date().toISOString()});a.entries[old.id]=blankEntry(updated);}
 else if(updated.type==='full'&&JSON.stringify(updated.skills)!==JSON.stringify(old.skills)){
  const oldEntry=a.entries[old.id];const prior=(oldEntry.ratings||[]).slice();const current=updated.skills||[];
  const sameSkill=(a,b)=>a.id&&b.id?a.id===b.id:a.name===b.name&&a.part===b.part;
  const preserved=current.map(sk=>{const oldIdx=(old.skills||[]).findIndex(os=>sameSkill(os,sk));return oldIdx>=0?prior[oldIdx]||null:null;});
  if(hasData(old,oldEntry)&&(old.skills||[]).some((sk,i)=>prior[i]&&!current.some(next=>sameSkill(next,sk))))a.archivedItems.push({step:clone(old),entry:clone(oldEntry),reason:'評価項目の変更',date:new Date().toISOString()});
  oldEntry.ratings=preserved;
 }
 }
 for(const step of st.menu.steps){if(!a.entries[step.id])a.entries[step.id]=blankEntry(step);}
 a.menu=clone(st.menu);
 const pos=a.menu.steps.findIndex(s=>s.id===previous);
 a.stepIndex=pos===-1?Math.min(a.stepIndex,a.menu.steps.length-1):pos;
}
function applyMenuChange(){syncActiveMenu();persist();}
function render(){document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===screen));if(screen==='practice')practiceView();else if(screen==='menu')menuView();else historyView();}
function ratingsUI(value,type,index,disabled){return`<div class="rating-group">${[['ok','○ 成功',''],['mid','△ 不安定','mid'],['ng','× 失敗','bad']].map(([v,t,c])=>`<button ${disabled} type="button" data-action="${type==='full'?'set-full':'set-rating'}" ${index!==null?`data-index="${index}"`:''} data-val="${v}" class="${value===v?'selected '+c:''}">${t}</button>`).join('')}</div>`;}
function optionsUI(name,value,choices,disabled){return`<div class="optionrow">${choices.map(([v,l])=>`<label><input type="radio" name="${name}" value="${v}" ${value===v?'checked':''} ${disabled}><span>${l}</span></label>`).join('')}</div>`;}
function renderStep(s,e,editable){const disabled=editable?'':'disabled';let h='';
 if(s.type==='check')return `<p class="note">ウォーミングアップ完了後にチェックしてください。</p><label class="row"><strong>完了</strong><input type="checkbox" data-action="check" ${e.done?'checked':''} ${disabled} style="height:24px;width:24px"></label>`;
 if(s.type==='count'||s.type==='timing'||s.type==='sync'){
  const v=statsFor(s,e,data.active),n=v.attempts,k=v.successes,left=Math.max(0,s.target-n);
  h+=`<div class="row"><span class="inline-label">目標 ${s.target}回</span><span class="pill ${n>=s.target?'done':''}">${n>=s.target?'目標達成':'残り'+left+'回'}</span></div><div class="progress"><div style="width:${Math.min(100,n/s.target*100)}%"></div></div><div class="statgrid top-margin"><div class="stat"><b>${n}/${s.target}</b><small>試行</small></div><div class="stat"><b>${k}</b><small>${s.type==='sync'?'技の成功':'成功回数'}</small></div><div class="stat"><b>${ratio(k,n)}</b><small>${s.type==='sync'?'技の成功率':'成功率'}</small></div></div>`;
  if(s.type==='sync'){
   h+=improvementPanel(s);
   h+=`<div class="trial-summary top-margin"><div class="row"><span class="inline-label">旧・詳細音ハメ</span><b>${v.fit}/${v.decided}（${ratio(v.fit,v.decided)}）</b></div><div class="mini">判定不能：${n-v.decided}回 ／ 技成功かつ音一致：${v.matched}/${n}（${ratio(v.matched,n)}）</div></div><p class="note">この項目は旧方式です。新しい「音ハメの練習」はメニューの記録方式から選べます。旧記録は自動変換しません。</p><div class="field top-margin"><label>今回の技</label>${optionsUI('syncskill',syncDraft.skill,[['ok','○ 成功'],['ng','× 失敗']],disabled)}</div><div class="field"><label>今回の音ハメ</label>${optionsUI('synctiming',syncDraft.timing,[['fit','合った'],['early','早い'],['late','遅い'],['unknown','判定不能']],disabled)}</div><button class="btn primary wide" data-action="sync-add" ${disabled} ${!syncDraft.skill||!syncDraft.timing?'disabled':''}>この1回を記録 ＋</button>`;
   h+=`<div class="row top-margin"><span class="muted">${n?'最近の記録':'まだ記録がありません'}</span><button class="btn line small" data-action="undo-trial" ${disabled} ${n===0?'disabled':''}>↶ 1回取り消し</button></div>`;
   if(n)h+=`<div class="trial-history">${e.trials.map((x,i)=>`<span class="trial-dot ${x.skill==='ok'?'ok':'ng'}">${i+1} ${x.skill==='ok'?'○':'×'}</span>`).join('')}</div>`;
   return h;
  }
  h+=improvementPanel(s);
  if(s.type==='timing')h+='<p class="note">○＝技を成功させ、狙った音にも合った。技の失敗・タイミングのずれは×です。</p>';
  const mode=batchMode(s);
  if(mode==='batch'){
   const choice=batchChoice[s.id]||configuredBatch(s),take=choice;
   h+=`<div class="batch-panel top-margin"><div class="inline-label">1セットで記録する回数</div><div class="batch-size-row">${[5,10].map(x=>`<button type="button" class="btn ${choice===x?'primary':'line'}" data-action="batch-choose" data-count="${x}" ${disabled} >${x}回</button>`).join('')}</div>`;
   {h+=`<p class="batch-prompt"><strong>${take}回</strong>練習したあと、成功回数を1回タップ</p><div class="batch-numbers">${Array.from({length:take+1},(_,i)=>`<button type="button" class="batch-number" data-action="record-batch" data-attempts="${take}" data-successes="${i}" ${disabled}>${i}</button>`).join('')}</div>`;}
   
   h+='</div>';
  }else{
   h+=`<div class="bigactions"><button class="btn green" data-action="quick-trial" data-val="ok" ${disabled} >○ 成功</button><button class="btn red" data-action="quick-trial" data-val="ng" ${disabled} >× 失敗</button></div>`;
  }
  const batches=batchList(e);
  h+=`<div class="row top-margin"><span class="muted">${n?'記録済み':'まだ記録がありません'}</span><button class="btn line small" data-action="undo-record" ${disabled} ${!batches.length&&!e.trials?.length?'disabled':''}>↶ 直前の記録を取り消す</button></div>`;
  if(batches.length)h+=`<div class="batch-history">${batches.slice(-12).map(b=>`<span class="batch-chip">${b.attempts}回中 ${b.successes}回成功</span>`).join('')}</div>`;
  if(e.trials?.length)h+=`<p class="mini top-margin">旧方式の個別記録：${e.trials.length}回（保存したまま集計）</p>`;
  return h;
 }
 if(s.type==='rating')return `<div class="inline-label">通し練習の結果</div>${ratingsUI(e.rating,'rating',null,disabled)}<div class="field top-margin"><label>メモ（任意）</label><textarea id="rating-note" ${disabled}>${safe(e.note||'')}</textarea></div>`;
 if(s.type==='full'){
  if(!s.skills?.length)return '<div class="alert">評価する技が未登録です。「メニュー」→「編集」から技を追加してください。</div>';
  h+=`<div class="statgrid"><div class="stat"><b>${e.ratings.filter(Boolean).length}/${s.skills.length}</b><small>評価済み</small></div><div class="stat"><b>${e.ratings.filter(x=>x==='ng').length}</b><small>× 失敗</small></div><div class="stat"><b>${e.ratings.filter(x=>x==='mid').length}</b><small>△ 不安定</small></div></div><p class="note">演技後に各箇所を○／△／×で記録してください。</p>`;
  let last='';s.skills.forEach((sk,i)=>{if(sk.part!==last){h+=`<div class="group-label">${safe(sk.part||'項目')}</div>`;last=sk.part;}h+=`<div class="skillrow"><div class="skillname">${safe(sk.name)}</div>${ratingsUI(e.ratings[i],'full',i,disabled)}</div>`;});
  if(s.showTiming)h+=`<div class="subsection"><h3>${safe(s.timingLabel||'音ハメ')}</h3>${optionsUI('timing',e.timing,[['fit','合った'],['early','早い'],['late','遅い'],['unknown','確認できず']],disabled)}</div>`;
  h+=`<div class="subsection"><h3>途中で止まらず完走できた？</h3>${optionsUI('stopped',e.stopped,[['no','完走'],['yes','途中停止']],disabled)}</div><div class="field top-margin"><label>その他のミス（任意）</label><textarea id="other-miss" ${disabled}>${safe(e.other||'')}</textarea></div>`;return h;
 }
 return '';
}
function practiceView(){const ss=data.active;if(!ss||!ss.menu.steps.length){app.innerHTML='<div class="page"><div class="empty"><strong>練習を始めましょう</strong></div></div>';return;}
 const s=ss.menu.steps[ss.stepIndex],e=ss.entries[s.id],completed=ss.menu.steps.filter(v=>entryDone(v,ss.entries[v.id],ss)).length;
 const status={active:'練習中',paused:'一時中断',ended:'途中終了',complete:'全メニュー完了'}[ss.status];
 let h=`<div class="page"><div class="hero"><div class="eyebrow">TODAY'S PRACTICE</div><h1>${safe(ss.menu.name)}</h1></div>`;
 if(!storageOK)h+='<div class="alert">端末の保存領域に書き込めません。バックアップをお試しください。</div>';
 h+=`<div class="card"><div class="row"><div class="field" style="margin:0;max-width:180px;flex:1"><label>練習日</label><input type="date" id="session-date" value="${safe(ss.date)}" ${ss.status==='active'?'':'disabled'}></div><span class="pill ${ss.status==='complete'?'done':ss.status==='ended'?'warn':''}">${status}</span></div><div class="row top-margin"><span class="muted">進捗 ${completed}/${ss.menu.steps.length}項目</span><span class="muted">${Math.round(completed/ss.menu.steps.length*100)}%</span></div><div class="progress top-margin"><div style="width:${completed/ss.menu.steps.length*100}%"></div></div></div>`;
 const daily=dailyTotals(data,ss.date);
 h+=`<div class="card soft"><span class="mini">${safe(ss.date)} の回数制練習（同じ日付の別セッションも含む）</span><div><b>試行合計 ${daily.attempts}回</b></div><div class="mini">${[['count','技・接続'],['timing','音ハメ'],['sync','旧詳細音ハメ（技＋音一致）']].filter(([key])=>daily.byType[key].attempts>0).map(([key,label])=>`${label} ${daily.byType[key].successes}/${daily.byType[key].attempts}`).join(' ／ ')||'記録なし'}</div></div>`;
 h+=`<div class="sectionbar"><h2>練習ステップ</h2><span class="muted">タップして移動</span></div><div class="step-nav">${ss.menu.steps.map((st,i)=>`<button class="step-chip ${ss.stepIndex===i?'active':entryDone(st,ss.entries[st.id])?'complete':''}" data-action="go-step" data-index="${i}">${i+1} ${entryDone(st,ss.entries[st.id])?'✓ ':''}${safe(st.name.length>11?st.name.slice(0,11)+'…':st.name)}</button>`).join('')}</div>`;
 h+=`<div class="card"><div class="step-head"><span class="pill">${safe(s.group)}</span><span class="muted">${ss.stepIndex+1} / ${ss.menu.steps.length}</span></div><h2 class="step-title">${safe(s.name)}</h2>${s.detail?`<div class="step-meta">${safe(s.detail)}</div>`:''}`;
 if(ss.status==='paused')h+='<div class="alert top-margin">練習セッション一時中断中です。「練習再開」で入力できます。</div>';
 if(ss.status==='ended')h+='<div class="okbox top-margin">この日の記録は終了しました。</div>';
 if(ss.status==='complete')h+='<div class="okbox top-margin">全メニュー完了済みです。回数制の練習はここから追加記録できます。</div>';
 h+=`<div class="subsection">${renderStep(s,e,ss.status==='active'||ss.status==='complete'&&['count','timing','sync'].includes(s.type))}</div><div class="divider"></div><div class="btnrow"><button class="btn line fill" data-action="step-prev" ${ss.stepIndex===0?'disabled':''}>← 前へ</button><button class="btn primary fill" data-action="step-next" ${ss.stepIndex===ss.menu.steps.length-1?'disabled':''}>次へ →</button></div></div>`;
 h+=`<div class="card"><div class="sectionbar" style="margin-top:0"><h2>練習の管理</h2></div><div class="btnrow">${ss.status==='active'?`<button class="btn line fill" data-action="pause">一時中断</button><button class="btn line fill" data-action="end">今日はここで終了</button>`:ss.status==='paused'?`<button class="btn primary fill" data-action="resume">▶ 練習再開</button><button class="btn line fill" data-action="end">今日はここで終了</button>`:''}</div><div class="btnrow top-margin">${['active','paused'].includes(ss.status)?`<button class="btn green fill" data-action="complete" ${completed!==ss.menu.steps.length?'disabled':''}>✓ 全メニュー完了</button>`:''}<button class="btn line fill" data-action="save-snapshot">記録をバックアップ</button><button class="btn line fill" data-action="copy-summary">結果をコピー</button></div><p class="note">記録はこの端末に保存されます。ブラウザのデータ削除に備え、定期的にバックアップしてください。</p></div>`;
 if(ss.archivedItems?.length)h+=`<div class="card"><div class="sectionbar" style="margin:0"><h2>変更前の記録（退避済み）</h2><span class="pill warn">${ss.archivedItems.length}件</span></div><p class="note">メニューの削除や記録方式変更に伴う記録を保存しています。バックアップ・履歴にも含まれます。</p>${ss.archivedItems.map(a=>`<div class="row" style="border-top:1px solid var(--line);padding:9px 0"><span class="mini">${safe(a.step.name)}</span><span class="mini">${safe(scoreLabel(a.step,a.entry))}</span></div>`).join('')}</div>`;
 h+='</div>';app.innerHTML=h;
}
function menuView(){const m=data.menu;const live=data.active&&['active','paused'].includes(data.active.status);
 let h=`<div class="page"><div class="hero"><div class="eyebrow">CUSTOMIZE YOUR ROUTINE · v1.3.0 RC2</div><h1>自分だけのメニューを作る</h1><p>技名・目標回数・順番をいつでも変更できます。</p></div>`;

 h+=`<div class="card"><div class="field"><label>メニュー名</label><input data-menu-name value="${safe(m.name)}" maxlength="100"></div><div class="okbox">${live?'追加・編集・並べ替えは、現在の練習画面へすぐ反映されます。入力済みの回数は保持します。':'このメニューは次に開始する練習から使われます。終了済みの履歴は変わりません。'}</div><div class="btnrow top-margin"><button class="btn line fill" data-action="export-menu">メニュー共有用に書き出す</button><button class="btn line fill" data-action="import-menu">メニューを読み込む</button></div></div>`;
 h+=`<div class="sectionbar"><h2>練習項目（${m.steps.length}）</h2><span class="muted">編集・移動できます</span></div>`;
 m.steps.forEach((s,i)=>{const open=editExpanded===s.id;h+=`<div class="edititem"><div class="row row-top"><div style="flex:1"><div class="mini">${safe(s.group)} · ${safe(typeLabel(s.type))} ${['count','sync','timing'].includes(s.type)?'· '+s.target+'回':''}</div><h3>${safe(s.name)}</h3></div><button class="btn small line" data-action="edit-toggle" data-id="${s.id}">${open?'閉じる':'編集'}</button></div>`;
 if(open){h+=`<div class="divider"></div><div class="field"><label>分類・パート名</label><input data-edit-key="group" data-edit-id="${s.id}" value="${safe(s.group)}"></div><div class="field"><label>練習項目名</label><input data-edit-key="name" data-edit-id="${s.id}" value="${safe(s.name)}"></div><div class="field"><label>記録方式</label><select data-edit-key="type" data-edit-id="${s.id}">${[['count','技の練習（○×）'],['timing','音ハメの練習（○×）'],['sync','旧・詳細音ハメ（従来形式）'],['full','通し（各技 ○△×）'],['rating','総合評価（○△×）']].map(([v,l])=>`<option value="${v}" ${s.type===v?'selected':''}>${l}</option>`).join('')}${s.type==='check'?'<option value="check" selected disabled>完了チェック（旧形式）</option>':''}</select></div>`;
 if(['count','sync','timing'].includes(s.type))h+=`<div class="field"><label>目標試行回数</label><input type="number" min="1" max="500" data-edit-key="target" data-edit-id="${s.id}" value="${s.target}"></div>`;
 if(['count','timing'].includes(s.type))h+=`<div class="field"><label>入力方法</label><select data-edit-key="inputMode" data-edit-id="${s.id}"><option value="batch" ${batchMode(s)==='batch'?'selected':''}>まとめ記録（おすすめ）</option><option value="single" ${batchMode(s)==='single'?'selected':''}>1回ずつ（○×）</option></select></div>${batchMode(s)==='batch'?`<div class="field"><label>まとめる回数（初期設定）</label><select data-edit-key="batchSize" data-edit-id="${s.id}"><option value="5" ${configuredBatch(s)===5?'selected':''}>5回</option><option value="10" ${configuredBatch(s)===10?'selected':''}>10回</option></select></div>`:''}`;
 h+=`<div class="field"><label>説明（任意）</label><input data-edit-key="detail" data-edit-id="${s.id}" value="${safe(s.detail||'')}"></div>`;
 if(s.type==='full')h+=`<div class="field"><label style="display:flex;gap:9px;align-items:center"><input type="checkbox" data-edit-key="showTiming" data-edit-id="${s.id}" ${s.showTiming?'checked':''} style="width:20px;height:20px">音ハメ評価を使用する</label></div>${s.showTiming?`<div class="field"><label>音ハメ項目名</label><input data-edit-key="timingLabel" data-edit-id="${s.id}" value="${safe(s.timingLabel||'音ハメ')}"></div>`:''}<div class="skill-editor"><div class="row"><strong class="inline-label">評価する技（${(s.skills||[]).length}件）</strong><span class="mini">1件ずつ追加・編集</span></div>
 ${(s.skills||[]).length?'<p class="note">技名とパートを個別に入力できます。順番は↑↓で変更可能です。</p>':'<div class="alert">まだ技が登録されていません。下の欄から追加してください。</div>'}
 ${(s.skills||[]).map((sk,k)=>`<div class="skill-edit-card"><div class="row"><span class="tiny-badge">技 ${k+1}</span><div class="btnrow"><button class="btn small line" data-action="skill-up" data-id="${s.id}" data-skill="${safe(sk.id)}" ${k===0?'disabled':''}>↑</button><button class="btn small line" data-action="skill-down" data-id="${s.id}" data-skill="${safe(sk.id)}" ${k===s.skills.length-1?'disabled':''}>↓</button><button class="btn small red" data-action="skill-delete" data-id="${s.id}" data-skill="${safe(sk.id)}">削除</button></div></div><div class="field"><label>技名</label><input data-skill-field="name" data-edit-id="${s.id}" data-skill="${safe(sk.id)}" value="${safe(sk.name)}" maxlength="160"></div><div class="field"><label>パート・分類（任意）</label><input data-skill-field="part" data-edit-id="${s.id}" data-skill="${safe(sk.id)}" value="${safe(sk.part||'')}" maxlength="40" placeholder="例：Part1"></div></div>`).join('')}
 <div class="skill-add"><div class="field"><label>新しい技名</label><input data-new-skill-name="${s.id}" placeholder="例：トラピーズ" maxlength="160"></div><div class="field"><label>パート・分類（任意）</label><input data-new-skill-part="${s.id}" placeholder="例：Part1" maxlength="40"></div><button class="btn primary wide" data-action="skill-add" data-id="${s.id}">＋ 技を追加</button></div></div>`;
 h+=`<div class="btnrow"><button class="btn small line" data-action="move-up" data-index="${i}" ${i===0?'disabled':''}>↑ 上へ</button><button class="btn small line" data-action="move-down" data-index="${i}" ${i===m.steps.length-1?'disabled':''}>↓ 下へ</button><button class="btn small line" data-action="duplicate" data-index="${i}">複製</button><button class="btn small red" data-action="delete-step" data-index="${i}">削除</button></div>`;
 }h+='</div>';});
 h+=`<div class="card"><h2 style="font-size:16px;margin-top:0">項目を追加</h2><div class="field"><label>練習名</label><input id="new-name" placeholder="例：新しいコンボ" maxlength="100"></div><div class="field"><label>記録方式</label><select id="new-type"><option value="count">技の練習（○×）</option><option value="timing">音ハメの練習（○×）</option><option value="full">通し（各技 ○△×）</option><option value="rating">総合評価（○△×）</option></select></div><div class="field"><label>目標回数（技・音ハメの練習）</label><input id="new-target" type="number" min="1" max="500" value="10"></div><button class="btn primary wide" data-action="add-step">＋ メニューに追加</button></div>`;
 h+=`<div class="card"><button class="btn line wide" data-action="reset-template">初期サンプル（4項目）に戻す</button><p class="note">確認後に初期化します。終了済みの練習履歴は削除されません。</p></div></div>`;app.innerHTML=h;
}
function typeLabel(t){return{count:'技の練習',timing:'音ハメの練習',sync:'旧・詳細音ハメ',full:'通し',rating:'総合評価',check:'チェック'}[t]||t;}
function scoreLabel(s,e,ss=data.active){if(!e)return '未実施';if(s.type==='check')return e.done?'完了':'未実施';if(['count','timing','sync'].includes(s.type)){
 const v=statsFor(s,e,ss);if(!v.attempts)return '未実施';
 if(s.type==='sync')return `旧詳細：技${v.successes}/${v.attempts}（${ratio(v.successes,v.attempts)}）、技＋音一致${v.matched}/${v.attempts}（${ratio(v.matched,v.attempts)}）`;
 return `${v.successes}/${v.attempts}成功（${ratio(v.successes,v.attempts)}）`;
 }if(s.type==='rating')return e.rating?({ok:'○ 成功',mid:'△ 不安定',ng:'× 失敗'}[e.rating]):'未実施';if(s.type==='full'){const vals=(e.ratings||[]).filter(Boolean);return vals.length?`失敗${vals.filter(x=>x==='ng').length}・不安定${vals.filter(x=>x==='mid').length}（${vals.length}評価）`:'未実施';}return '未実施';}
function sessionDetail(ss){let o='';ss.menu.steps.forEach(s=>{const e=ss.entries[s.id];o+=`<div class="row" style="border-bottom:1px solid var(--line);padding:9px 0"><span class="mini" style="flex:1;color:var(--text)">${safe(s.name)}</span><span class="mini" style="text-align:right">${safe(scoreLabel(s,e,ss))}</span></div>`;});for(const a of ss.archivedItems||[]){o+=`<div class="row" style="border-bottom:1px solid var(--line);padding:9px 0"><span class="mini" style="flex:1">[退避] ${safe(a.step.name)}</span><span class="mini">${safe(scoreLabel(a.step,a.entry,ss))}</span></div>`;}if(ss.endReason)o+=`<p class="note">終了理由：${safe(ss.endReason)}${ss.endMemo?' / '+safe(ss.endMemo):''}</p>`;return o;}
function historyView(){let h=`<div class="page"><div class="hero"><div class="eyebrow">YOUR PROGRESS</div><h1>履歴とデータ管理</h1><p>練習記録は端末内に保存されます。</p></div>`;
 h+=`<div class="card"><div class="sectionbar" style="margin:0 0 12px"><h2>外観設定</h2></div><div class="theme-choices">${[['light','☀ ライト'],['dark','☾ ダーク'],['system','◫ 端末に合わせる']].map(([key,label])=>`<button class="theme-choice" data-action="set-theme" data-theme="${key}" aria-pressed="${data.settings.theme===key}">${label}</button>`).join('')}</div><p class="note">選択はこの端末内に保存され、オフラインでも維持されます。</p></div>`;

 h+=offMenuPanel();
 h+=`<div class="card"><h2 style="margin:0 0 10px;font-size:16px">バックアップ・共有</h2><div class="btnrow"><button class="btn primary fill" data-action="export-backup">全データをバックアップ</button><button class="btn line fill" data-action="import-backup">バックアップを復元</button></div><div class="btnrow top-margin"><button class="btn line fill" data-action="export-menu">友人にメニューを共有</button><button class="btn line fill" data-action="import-menu">友人のメニューを読み込む</button></div><p class="note">全バックアップには履歴を含みます。友人には「メニューを共有」のJSONのみ渡してください。</p></div>`;
 h+=`<div class="card"><h2 style="margin:0 0 12px;font-size:16px">現在の練習</h2><div class="row"><div><strong>${safe(data.active?.date||'—')}</strong><div class="mini">${safe(data.active?.menu?.name||'')}</div></div><span class="pill">${safe(({active:'練習中',paused:'一時中断',ended:'途中終了',complete:'全完了'}[data.active?.status])||'—')}</span></div><div class="btnrow top-margin"><button class="btn primary fill" data-action="new-session">＋ 新しい練習日を開始</button><button class="btn line fill" data-action="save-snapshot">現在の記録を保存</button></div></div>`;
 h+=`<div class="sectionbar"><h2>保存済みの練習履歴</h2><span class="muted">${data.history.length}件</span></div>`;
 if(!data.history.length)h+='<div class="empty"><span class="glyph">▤</span><strong>まだ履歴がありません</strong>練習を終了するとここに追加されます。</div>';
 for(const ss of [...data.history].reverse()){const completed=ss.menu.steps.filter(s=>entryDone(s,ss.entries[s.id],ss)).length;h+=`<div class="historyentry"><div class="row"><div><h3>${safe(ss.date)} ${safe(ss.menu.name)}</h3><div class="mini">${completed}/${ss.menu.steps.length}項目完了 · ${ss.status==='complete'?'全メニュー完了':'途中終了'}</div></div><div class="btnrow"><button class="btn small line" data-action="history-toggle" data-id="${ss.id}">${historyOpen===ss.id?'閉じる':'詳細'}</button><button class="btn small line" data-action="export-session" data-id="${ss.id}">保存</button></div></div>${historyOpen===ss.id?`<div class="subsection">${sessionDetail(ss)}</div>`:''}</div>`;}
 h+=`<div class="card soft"><strong style="font-size:13px">保存について</strong><p class="note">アカウントやクラウド同期はありません。アプリの更新や端末変更の前にJSONバックアップを保存してください。</p></div></div>`;app.innerHTML=h;
}
function archiveCurrent(st=data){
 if(!st.active)return;
 const snapshot=clone(st.active);
 // Upsert, never append a second snapshot of a completed session after extra practice.
 const index=st.history.findIndex(item=>item.id===snapshot.id);
 if(index>=0)st.history[index]=snapshot;else st.history.push(snapshot);
 // Referenced historical sessions must not be dropped by the old 400-entry trim.
 if(st.history.length>400){
  const held=new Set((st.improvementTests||[]).flatMap(t=>[t.baselineRecordKey,...(t.recordKeys||[])]).filter(Boolean).map(k=>{try{return JSON.parse(k)[0];}catch{return null;}}));
  let removable=st.history.length-400;
  st.history=st.history.filter(item=>{if(removable&& !held.has(item.id)){removable--;return false;}return true;});
 }
}

function endSession(kind,reason='',memo=''){
 if(!commitUpdate(st=>{const ss=st.active;ss.status=kind;ss.endReason=reason;ss.endMemo=memo;ss.ended=new Date().toISOString();if(kind==='complete')ss.completedAt=ss.ended;archiveCurrent(st);}))return false;
 render();notify('練習履歴に保存しました');return true;
}

function validateMenu(obj){if(!obj||!Array.isArray(obj.steps)||obj.steps.length<1||obj.steps.length>150)throw Error('メニューの項目数が不正です');const seen=new Set();const steps=obj.steps.map(item=>{if(typeof item.name!=='string'||!item.name.trim()||item.name.length>120||!['count','timing','sync','full','rating','check'].includes(item.type))throw Error('練習項目の形式が不正です');if(['count','timing','sync'].includes(item.type)&&(!Number.isInteger(item.target)||item.target<1||item.target>500))throw Error('目標回数は1〜500にしてください');let sid=item.id;if(!sid||seen.has(sid))sid=id();seen.add(sid);let s={id:sid,group:String(item.group||'自由練習').slice(0,70),name:item.name.slice(0,120),type:item.type,target:['count','timing','sync'].includes(item.type)?item.target:1,detail:String(item.detail||'').slice(0,400)};if(['count','timing'].includes(item.type)){s.inputMode=item.inputMode==='batch'?'batch':'single';s.batchSize=item.batchSize===10?10:5;}if(item.type==='full'){if(!Array.isArray(item.skills)||item.skills.length>60)throw Error('通し練習の技一覧が不正です');s.skills=item.skills.map(x=>({id:typeof x.id==='string'&&x.id?x.id:id(),part:String(x.part||'').slice(0,40),name:String(x.name||'').slice(0,160)}));if(s.skills.some(x=>!x.name.trim()))throw Error('技名が入力されていません');s.showTiming=!!item.showTiming;s.timingLabel=String(item.timingLabel||'音ハメ').slice(0,100);}return s;});return{name:typeof obj.name==='string'?obj.name.slice(0,100):'共有メニュー',steps};}
// Phase 5: full backup v4 includes improvementTests, recordMeta and exerciseLinks.
// Only full backups are versioned to v4; menu/session formats remain version 3.
const BACKUP_VERSION=4;
const fullBackup=()=>({kind:'tricklog-backup',version:BACKUP_VERSION,exported:new Date().toISOString(),data:clone(data)});
const plainObject=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function assertBackup(condition,message){if(!condition)throw Error(message);}
function validateRestoreSession(ss,label){
 assertBackup(plainObject(ss)&&typeof ss.id==='string'&&ss.id.length>0&&ss.id.length<256,`${label}のIDが不正です`);
 assertBackup(validPracticeDate(ss.date),`${label}の練習日が不正です`);
 assertBackup(['active','paused','ended','complete'].includes(ss.status),`${label}の状態が不正です`);
 assertBackup(plainObject(ss.menu)&&Array.isArray(ss.menu.steps),`${label}のメニューが不正です`);
 assertBackup(plainObject(ss.entries),`${label}の記録が不正です`);
 assertBackup(Array.isArray(ss.archivedItems||[])&&(ss.archivedItems||[]).length<=10000,`${label}の退避記録が不正です`);
 const kinds=new Set(['count','timing','sync','full','rating','check']);
 const archive=(ss.archivedItems||[]).map(x=>{assertBackup(plainObject(x)&&plainObject(x.step)&&plainObject(x.entry),`${label}の退避記録が不正です`);return x.step;});
 const all=[...ss.menu.steps,...archive];
 assertBackup(all.length<=10150,`${label}の記録項目が多すぎます`);
 for(const step of all){
  assertBackup(typeof step.id==='string'&&step.id&&step.id.length<256&&kinds.has(step.type),`${label}の記録項目IDまたは方式が不正です`);
  const entry=ss.entries[step.id]||(ss.archivedItems||[]).find(x=>x.step.id===step.id)?.entry;
  if(!entry)continue; // Historical records may predate newer menu items.
  assertBackup(plainObject(entry),`${label}の記録内容が不正です`);
  if(['count','timing','sync'].includes(step.type)){
   assertBackup(Array.isArray(entry.trials||[])&&Array.isArray(entry.batches||[]),`${label}の回数制記録が不正です`);
   assertBackup((entry.trials||[]).length<=100000&&(entry.batches||[]).length<=100000,`${label}の記録件数が多すぎます`);
   for(const b of entry.batches||[]){
    assertBackup(plainObject(b)&&typeof b.id==='string'&&b.id&&Number.isInteger(b.attempts)&&b.attempts>=1&&b.attempts<=10&&Number.isInteger(b.successes)&&b.successes>=0&&b.successes<=b.attempts,`${label}のまとめ記録が不正です`);
   }
  }
 }
}
function prepareRestoreBackup(envelope){
 assertBackup(plainObject(envelope)&&envelope.kind==='tricklog-backup', '全データバックアップではありません');
 assertBackup(Number.isInteger(envelope.version)&&envelope.version>=1&&envelope.version<=BACKUP_VERSION,'未対応のバックアップ形式です');
 assertBackup(plainObject(envelope.data)&&plainObject(envelope.data.menu)&&Array.isArray(envelope.data.history),'バックアップの本体が不正です');
 const st=clone(envelope.data);
 assertBackup(st.history.length<=10000,'履歴の件数が多すぎます');
 const originalStepIDs=st.menu.steps.map(x=>x?.id);
 const validatedMenu=validateMenu(st.menu);
 if(envelope.version===BACKUP_VERSION){
  assertBackup(originalStepIDs.every(x=>typeof x==='string'&&x)&&new Set(originalStepIDs).size===originalStepIDs.length,'メニュー項目IDが重複または欠落しています');
 }else st.menu=validatedMenu;

 if(!st.active)st.active=newSession(st.menu);
 if(!Array.isArray(st.active.archivedItems))st.active.archivedItems=[];
 if(!plainObject(st.settings))st.settings={theme:'light'};
 if(!themeValues.includes(st.settings.theme))st.settings.theme='light';
 if(st.improvementTests===undefined)st.improvementTests=[];
 if(st.recordMeta===undefined)st.recordMeta={};
 if(st.exerciseLinks===undefined)st.exerciseLinks={};
 assertBackup(Array.isArray(st.improvementTests)&&st.improvementTests.length<=10000,'改善テストの一覧が不正です');
 assertBackup(plainObject(st.recordMeta)&&Object.keys(st.recordMeta).length<=100000,'改善セットの管理情報が不正です');
 assertBackup(plainObject(st.exerciseLinks)&&Object.keys(st.exerciseLinks).length<=10000,'メニュー引き継ぎ情報が不正です');
 validateRestoreSession(st.active,'現在の練習');
 const seenSessions=new Set();
 for(const ss of st.history){
  validateRestoreSession(ss,'過去の練習');
  assertBackup(!seenSessions.has(ss.id),'重複した履歴セッションIDがあります');
  seenSessions.add(ss.id);
 }
 for(const [key,meta] of Object.entries(st.recordMeta)){
  let parts;try{parts=JSON.parse(key);}catch{}
  assertBackup(Array.isArray(parts)&&parts.length===3&&parts.every(x=>typeof x==='string'&&x.length>0)&&plainObject(meta),'改善セットの管理キーが不正です');
  if(meta.performedDate!==undefined)assertBackup(validPracticeDate(meta.performedDate),'改善セットの練習日が不正です');
  if(meta.memo!==undefined)assertBackup(typeof meta.memo==='string'&&meta.memo.length<=700,'修正メモが不正です');
 }
 // Validate refs strictly: refusing broken v4 backup is safer than losing protected source records.
 const testIDs=new Set(),busy=new Set();
 for(const t of st.improvementTests){
  assertBackup(plainObject(t)&&typeof t.id==='string'&&t.id&&typeof t.exerciseKey==='string'&&t.exerciseKey&&['active','paused','completed'].includes(t.status),'改善テストの状態が不正です');
  assertBackup(!testIDs.has(t.id),'改善テストIDが重複しています');testIDs.add(t.id);
  assertBackup(['count','timing','sync'].includes(t.metricKey),'改善テストの記録方式が不正です');
  assertBackup(typeof t.baselineRecordKey==='string'&&Array.isArray(t.recordKeys)&&t.recordKeys.length<=100000,'改善テストの参照情報が不正です');
  assertBackup(!(t.status==='completed'&&t.recordKeys.length===0),'空の完了済みテストが存在します');
  for(const key of [t.baselineRecordKey,...t.recordKeys]){
   assertBackup(typeof key==='string'&&key.length<1024&&resolveRecord(st,key),'改善テストの参照先記録が見つかりません');
   // Same individual record must not belong to multiple improvement sets.
   assertBackup(!busy.has(key),'改善テストの参照記録が重複しています');busy.add(key);
  }
 }
 for(const [stepId,link] of Object.entries(st.exerciseLinks)){
  assertBackup(typeof stepId==='string'&&stepId&&plainObject(link)&&typeof link.exerciseKey==='string'&&link.exerciseKey&&['count','timing','sync'].includes(link.metricKey),'メニュー引き継ぎ情報が不正です');
 }
 // Do not mutate either input or current app state before successful storage commit.
 migrateSkillIds(st);
 const activeIndex=st.history.findIndex(ss=>ss.id===st.active.id);
 if(activeIndex>=0)st.history[activeIndex]=clone(st.active); // active ID wins, not a second session
 return st;
}
function commitRestoredBackup(envelope){
 let candidate;
 try{candidate=prepareRestoreBackup(envelope);}catch(err){notify('復元中止：'+err.message);return false;}
 try{
  localStorage.setItem(STORE,JSON.stringify(candidate));
 }catch(err){storageOK=false;notify('復元できません。端末の保存領域を確認してください（既存記録は保持）');return false;}
 data=candidate;lastDurableState=clone(candidate);storageOK=true;syncDraft={skill:'',timing:''};
 improvementMemoDraft={};improvementDetailOpen={};improvementHistoryLimit={};completedListOpen={};completedDetailOpen={};
 applyTheme();screen='practice';render();notify('バックアップを復元しました');return true;
}
async function importFile(kind){
 const input=document.createElement('input');input.type='file';input.accept='application/json,.json';
 input.onchange=async()=>{const file=input.files?.[0];if(!file)return;
  try{
   if(file.size>20e6)throw Error('ファイルが大きすぎます（20MB以内）');
   const obj=JSON.parse(await file.text());
   if(kind==='menu'){
    if(obj.version!==undefined&&(!Number.isInteger(obj.version)||obj.version>3||obj.version<1))throw Error('未対応のメニュー形式です');
    const menu=validateMenu(obj.kind==='tricklog-menu'?obj.menu:obj);openMenuLinkReview(menu);
   }else{
    // Eager validation before showing a destructive restore confirmation.
    prepareRestoreBackup(obj);
    dialog('全データを復元しますか？','現在の練習・履歴・メニューが上書きされます。必要なら先に現在のデータをバックアップしてください。','上書き復元',()=>commitRestoredBackup(obj));
   }
  }catch(err){notify('読み込み失敗：'+err.message);}
 };input.click();
}
function exportBackup(){download('TrickLog_backup_'+today()+'.json',JSON.stringify(fullBackup(),null,2));notify('全データ（v4）を書き出しました');}
function exportMenu(){download('TrickLog_menu.json',JSON.stringify({kind:'tricklog-menu',version:3,menu:data.menu},null,2));notify('共有用メニューを書き出しました');}
function exportSnapshot(){download('TrickLog_session_'+data.active.date+'.json',JSON.stringify({kind:'tricklog-session',version:3,session:data.active},null,2));notify('現在の記録を書き出しました');}
function summaryText(ss){
  const rows=[
    `TrickLog 練習記録｜${ss.date}`,
    `メニュー：${ss.menu.name}`,
    `状態：${({active:'練習中',paused:'一時中断',complete:'全メニュー完了',ended:'途中終了'}[ss.status])}`
  ];
  const appendStep=(s,e,prefix='')=>{
    rows.push(`・${prefix}${s.name}：${scoreLabel(s,e,ss)}`);
    if(s.type!=='full')return;
    const skills=Array.isArray(s.skills)?s.skills:[];
    const ratings=Array.isArray(e?.ratings)?e.ratings:[];
    const rated=ratings.some(x=>['ok','mid','ng'].includes(x));
    const timingRecorded=typeof e?.timing==='string'&&e.timing!=='';
    // 未着手の通しは合計行「未実施」のみ出力する。
    if(!rated&&!timingRecorded)return;
    skills.forEach((skill,i)=>{
      const mark=({ok:'○',mid:'△',ng:'×'})[ratings[i]]||'未評価';
      const part=skill.part?`${skill.part}｜`:'';
      rows.push(`  ・${part}${skill.name}：${mark}`);
    });
    if(s.showTiming){
      const timing=({fit:'合った',early:'早い',late:'遅い',unknown:'確認できず'})[e?.timing]||'未記録';
      rows.push(`  ・${s.timingLabel||'音ハメ'}：${timing}`);
    }
  };
  ss.menu.steps.forEach(s=>appendStep(s,ss.entries?.[s.id]));
  (ss.archivedItems||[]).forEach(x=>appendStep(x.step,x.entry,'[退避] '));
  return rows.join('\n');
}
async function copySummary(){const text=summaryText(data.active);try{await navigator.clipboard.writeText(text);notify('結果をコピーしました');}catch{const input=document.createElement('textarea');input.value=text;document.body.appendChild(input);input.select();const success=document.execCommand('copy');input.remove();notify(success?'結果をコピーしました':'コピーできませんでした');}}
function newSessionConfirm(){dialog('新しい練習を始めますか？','今の記録は履歴に保存され、新しい練習日が始まります。','新しく開始',()=>{if(data.active&&!['ended','complete'].includes(data.active.status)){data.active.status='ended';data.active.endReason='新規練習開始';archiveCurrent();}data.active=newSession(data.menu);syncDraft={skill:'',timing:''};if(!persist())return false;screen='practice';render();notify('新しい練習を開始しました');});}
const activeOk=()=>data.active?.status==='active';
const countInputOk=()=>['active','complete'].includes(data.active?.status);
app.addEventListener('click',ev=>{const btn=ev.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action,ss=data.active,s=ss?.menu.steps[ss.stepIndex],e=s?ss.entries[s.id]:null;
 if(action==='go-step'){ss.stepIndex=Number(btn.dataset.index);syncDraft={skill:'',timing:''};persist();render();return;}
 if(action==='step-prev'||action==='step-next'){ss.stepIndex=Math.max(0,Math.min(ss.menu.steps.length-1,ss.stepIndex+(action==='step-prev'?-1:1)));syncDraft={skill:'',timing:''};persist();render();return;}
 if(action==='batch-choose'&&countInputOk()&&['count','timing'].includes(s.type)){
  batchChoice[s.id]=Number(btn.dataset.count)===10?10:5;render();return;
 }
 if(action==='offmenu-toggle'){offMenuExpanded=!offMenuExpanded;render();return;}
 if(action==='improve-off-detail'){
  const test=data.improvementTests.find(t=>t.id===btn.dataset.testid);if(test){improvementDetailOpen[test.id]=!improvementDetailOpen[test.id];render();}return;
 }
 if(action==='improve-off-end'){
  const test=data.improvementTests.find(t=>t.id===btn.dataset.testid&&['active','paused'].includes(t.status));if(!test)return;
  if(commitUpdate(st=>completeImprovementById(st,test.id))){render();notify('メニュー外の改善テストを終了しました');}return;
 }
 if(action==='improve-off-cancel'){
  const test=data.improvementTests.find(t=>t.id===btn.dataset.testid&&['active','paused'].includes(t.status));if(!test)return;
  const doCancel=()=>{if(!commitUpdate(st=>cancelImprovementById(st,test.id)))return false;render();notify('改善テストを取り消しました（実績は保持）');return true;};
  if(!test.recordKeys.length)doCancel();else dialog('改善テストを取り消しますか？','比較履歴と修正メモのみ削除し、練習の試行・成功実績は残します。','取り消す',doCancel);
  return;
 }
 if(action==='improve-detail'&&s){const test=ongoingTest(data,s);if(test){improvementDetailOpen[test.id]=!improvementDetailOpen[test.id];render();}return;}
 if(action==='improve-edit'){openImprovementEditor(btn.dataset.recordKey);return;}
 if(action==='improve-more'){
  const tid=btn.dataset.testid,t=data.improvementTests.find(v=>v.id===tid);
  if(t){improvementHistoryLimit[tid]=Math.min(t.recordKeys.length,(improvementHistoryLimit[tid]||5)+5);render();}return;
 }
 if(action==='improve-completed-toggle'){const key=btn.dataset.exercise;completedListOpen[key]=!completedListOpen[key];render();return;}
 if(action==='improve-completed-detail'){const tid=btn.dataset.testid;completedDetailOpen[tid]=!completedDetailOpen[tid];render();return;}
 if(action==='improve-completed-delete'){
  const test=data.improvementTests.find(v=>v.id===btn.dataset.testid&&v.status==='completed');if(!test)return;
  dialog('完了済み改善テストを削除しますか？','比較履歴と修正メモを削除します。練習の試行・成功実績はすべて保持します。','履歴を削除',()=>{
   if(!commitUpdate(st=>deleteImprovementTest(st,test.id)))return false;
   delete completedDetailOpen[test.id];delete improvementHistoryLimit[test.id];render();notify('比較履歴を削除しました（練習実績は保持）');return true;
  });return;
 }
 if(action==='improve-start'&&s&&countInputOk()){
  if(commitUpdate(st=>startImprovement(st,s))){delete improvementMemoDraft[s.id];render();notify('改善テストを開始しました');}return;
 }
 if(action==='improve-pause'&&s){
  if(commitUpdate(st=>{const test=ongoingTest(st,s);if(!test||test.status!=='active')return false;test.status='paused';return true;})){delete improvementMemoDraft[s.id];render();notify('改善テストを一時停止しました');}return;
 }
 if(action==='improve-resume'&&s&&countInputOk()){
  if(commitUpdate(st=>{const test=ongoingTest(st,s);if(!test||test.status!=='paused'||!resolveRecord(st,test.baselineRecordKey))return false;test.status='active';return true;})){render();notify('改善テストを再開しました');}return;
 }
 if(action==='improve-end'&&s){
  if(commitUpdate(st=>completeImprovement(st,s))){delete improvementMemoDraft[s.id];render();notify('改善テストを終了・保存しました');}return;
 }
 if(action==='improve-cancel'&&s){
  const test=ongoingTest(data,s);if(!test)return;
  const execute=()=>{if(!commitUpdate(st=>cancelImprovement(st,s)))return false;delete improvementMemoDraft[s.id];render();notify('改善テストを取り消しました（練習実績は保持）');return true;};
  if(!test.recordKeys.length)execute();
  else dialog('改善テスト全体を取り消しますか？','比較履歴と修正メモを削除しますが、記録済みの試行・成功回数は残ります。','取り消す',execute);
  return;
 }
 if(action==='record-batch'&&countInputOk()&&['count','timing'].includes(s.type)&&batchMode(s)==='batch'){
  const attempts=Number(btn.dataset.attempts),successes=Number(btn.dataset.successes);
  if(![5,10].includes(attempts)||!Number.isInteger(successes)||successes<0||successes>attempts)return;
  if(commitUpdate(st=>{
   const entry=st.active.entries[s.id];if(!Array.isArray(entry.batches))entry.batches=[];
   const rec={id:id(),attempts,successes,recordedAt:new Date().toISOString()};entry.batches.push(rec);
   st.recordMeta[recordKey(st.active.id,s.id,rec.id)]={performedDate:ongoingTest(st,s)?.status==='active'?today():st.active.date,kind:'normal',metricKey:s.type};
   recordAsImprovement(st,s,rec.id);
   if(st.active.status==='complete')archiveCurrent(st);
  })){if(ongoingTest(data,s)?.status==='active')delete improvementMemoDraft[s.id];render();}return;
 }
 if(action==='quick-trial'&&countInputOk()&&['count','timing'].includes(s.type)&&batchMode(s)==='single'){
  if(commitUpdate(st=>{
   const entry=st.active.entries[s.id];if(!Array.isArray(entry.batches))entry.batches=[];
   const rec={id:id(),attempts:1,successes:btn.dataset.val==='ok'?1:0,recordedAt:new Date().toISOString()};entry.batches.push(rec);
   st.recordMeta[recordKey(st.active.id,s.id,rec.id)]={performedDate:ongoingTest(st,s)?.status==='active'?today():st.active.date,kind:'normal',metricKey:s.type};
   recordAsImprovement(st,s,rec.id);
   if(st.active.status==='complete')archiveCurrent(st);
  })){if(ongoingTest(data,s)?.status==='active')delete improvementMemoDraft[s.id];render();}return;
 }
 if(action==='undo-record'&&countInputOk()&&['count','timing'].includes(s.type)){
  const last=e.batches?.length?e.batches[e.batches.length-1]:null;
  const key=last&&recordKey(ss.id,s.id,last.id);
  if(key&&isProtectedRecord(data,key)){notify('改善テストが参照する記録はここでは削除できません');return;}
  if(commitUpdate(st=>{
   const entry=st.active.entries[s.id];if(entry.batches?.length){const b=entry.batches.pop();delete st.recordMeta[recordKey(st.active.id,s.id,b.id)];}
   else if(entry.trials?.length){const idx=entry.trials.length-1;const v=entry.trials[idx];const itemId=v&&typeof v==='object'&&v.id?v.id:'legacy-'+idx;const legacyKey=recordKey(st.active.id,s.id,itemId);if(isProtectedRecord(st,legacyKey))return false;entry.trials.pop();delete st.recordMeta[legacyKey];}else return false;
   if(st.active.status==='complete')archiveCurrent(st);
  }))render();return;
 }
 if(action==='sync-add'&&countInputOk()&&s.type==='sync'&&syncDraft.skill&&syncDraft.timing){
  if(commitUpdate(st=>{
   const item={...syncDraft,id:id(),recordedAt:new Date().toISOString()};st.active.entries[s.id].trials.push(item);
   st.recordMeta[recordKey(st.active.id,s.id,item.id)]={performedDate:ongoingTest(st,s)?.status==='active'?today():st.active.date,kind:'normal',metricKey:'sync'};
   recordAsImprovement(st,s,item.id);
   if(st.active.status==='complete')archiveCurrent(st);
  })){syncDraft={skill:'',timing:''};if(ongoingTest(data,s)?.status==='active')delete improvementMemoDraft[s.id];render();}return;
 }
 if(action==='undo-trial'&&countInputOk()&&s.type==='sync'&&e?.trials?.length){
  const last=e.trials[e.trials.length-1],key=last&&last.id&&recordKey(ss.id,s.id,last.id);
  if(key&&isProtectedRecord(data,key)){notify('改善テストが参照する記録はここでは削除できません');return;}
  if(commitUpdate(st=>{const removed=st.active.entries[s.id].trials.pop();if(removed?.id)delete st.recordMeta[recordKey(st.active.id,s.id,removed.id)];if(st.active.status==='complete')archiveCurrent(st);})){render();}return;
 }
 if(action==='set-full'&&activeOk()){e.ratings[Number(btn.dataset.index)]=btn.dataset.val;persist();render();return;}
 if(action==='set-rating'&&activeOk()){e.rating=btn.dataset.val;persist();render();return;}
 if(action==='pause'&&activeOk()){ss.status='paused';const saved=persist();render();if(saved)notify('一時中断しました');return;}
 if(action==='resume'&&ss.status==='paused'){ss.status='active';persist();render();return;}
 if(action==='end'&&['active','paused'].includes(ss.status)){const extra=`<div class="field"><label>終了理由</label><select id="end-reason"><option value="疲労">疲労</option><option value="時間不足">時間不足</option><option value="その他">その他</option><option value="理由なし">理由なし</option></select></div><div class="field"><label>メモ（任意）</label><textarea id="end-memo"></textarea></div>`;dialog('今日はここで終了しますか？','実施済みの記録を残し、未実施回数は失敗に数えません。','途中終了して保存',()=>endSession('ended',$('#end-reason').value,$('#end-memo').value),extra);return;}
 if(action==='complete'&&['active','paused'].includes(ss.status)&&ss.menu.steps.every(st=>entryDone(st,ss.entries[st.id]))){dialog('全メニュー完了にしますか？','今日の練習を履歴に保存します。','完了して保存',()=>endSession('complete'));return;}
 if(action==='save-snapshot'){exportSnapshot();return;}
 if(action==='copy-summary'){copySummary();return;}
 if(action==='new-session'){newSessionConfirm();return;}
 if(action==='export-backup'){exportBackup();return;}
 if(action==='export-menu'){exportMenu();return;}
 if(action==='import-menu'||action==='import-backup'){importFile(action==='import-menu'?'menu':'backup');return;}
 if(action==='history-toggle'){historyOpen=historyOpen===btn.dataset.id?null:btn.dataset.id;render();return;}
 if(action==='export-session'){const row=data.history.find(x=>x.id===btn.dataset.id);if(row)download('TrickLog_'+row.date+'_'+row.id+'.json',JSON.stringify({kind:'tricklog-session',version:3,session:row},null,2));return;}
 if(action==='set-theme'){data.settings.theme=btn.dataset.theme;applyTheme();persist();render();return;}
 if(action==='edit-toggle'){editExpanded=editExpanded===btn.dataset.id?null:btn.dataset.id;render();return;}
 if(action==='move-up'||action==='move-down'){const i=Number(btn.dataset.index),j=i+(action==='move-up'?-1:1);if(j>=0&&j<data.menu.steps.length){[data.menu.steps[i],data.menu.steps[j]]=[data.menu.steps[j],data.menu.steps[i]];applyMenuChange();render();}return;}
 if(action==='duplicate'){const i=Number(btn.dataset.index),copyStep=clone(data.menu.steps[i]);copyStep.id=id();copyStep.name+='（コピー）';data.menu.steps.splice(i+1,0,copyStep);editExpanded=copyStep.id;applyMenuChange();render();return;}
 if(action==='delete-step'){const i=Number(btn.dataset.index);if(data.menu.steps.length<=1){notify('少なくとも1項目必要です');return;}const target=data.menu.steps[i];const recorded=data.active&&['active','paused'].includes(data.active.status)&&hasData(target,data.active.entries[target.id]);dialog('項目を削除しますか？',`「${target.name}」をメニューから削除します。${recorded?'入力済みの記録は退避して残します。':''}`,'削除する',()=>{data.menu.steps.splice(i,1);editExpanded=null;applyMenuChange();render();});return;}
 if(action==='skill-add'){
  const item=data.menu.steps.find(st=>st.id===btn.dataset.id);
  if(!item||item.type!=='full')return;
  if(item.skills.length>=60){notify('評価する技は最大60件です');return;}
  const name=app.querySelector(`[data-new-skill-name="${item.id}"]`)?.value.trim()||'';
  const part=app.querySelector(`[data-new-skill-part="${item.id}"]`)?.value.trim()||'';
  if(!name){notify('技名を入力してください');return;}
  item.skills.push({id:id(),name,part});applyMenuChange();render();notify('技を追加しました');return;
 }
 if(['skill-up','skill-down','skill-delete'].includes(action)){
  const item=data.menu.steps.find(st=>st.id===btn.dataset.id);
  if(!item||item.type!=='full')return;
  const i=item.skills.findIndex(sk=>sk.id===btn.dataset.skill);
  if(i<0)return;
  if(action==='skill-delete'){
   const activeStep=data.active?.menu.steps.find(st=>st.id===item.id);
   const activeIndex=activeStep?.skills?.findIndex(sk=>sk.id===btn.dataset.skill)??-1;
   const hasRating=activeIndex>=0&&Boolean(data.active?.entries[item.id]?.ratings?.[activeIndex]);
   dialog('評価する技を削除しますか？',`「${item.skills[i].name}」を削除します。${hasRating?'この技の入力済み評価は、変更前の記録として退避します。':''}`,'削除する',()=>{item.skills.splice(i,1);applyMenuChange();render();});return;
  }
  const j=i+(action==='skill-up'?-1:1);
  if(j<0||j>=item.skills.length)return;
  [item.skills[i],item.skills[j]]=[item.skills[j],item.skills[i]];
  applyMenuChange();render();return;
 }
 if(action==='add-step'){const name=$('#new-name').value.trim(),type=$('#new-type').value,target=Number($('#new-target').value);if(!name){notify('練習名を入力してください');return;}if(['count','timing'].includes(type)&&(!Number.isInteger(target)||target<1||target>500)){notify('目標回数は1〜500で指定してください');return;}const item={id:id(),name,group:'自由練習',type,target:['count','timing'].includes(type)?target:1,detail:'',...(['count','timing'].includes(type)?{inputMode:'batch',batchSize:5}:{}),...(type==='full'?{skills:[],showTiming:false,timingLabel:'音ハメ'}:{})};const next=clone(data.menu);next.steps.push(item);openMenuLinkReview(next);return;}
 if(action==='reset-template'){openMenuLinkReview(defaultMenu());return;}
});
app.addEventListener('change',ev=>{const t=ev.target,ss=data.active,s=ss?.menu.steps[ss.stepIndex],e=s?ss.entries[s.id]:null;
 if(t.id==='session-date'&&activeOk()){ss.date=t.value;persist();return;}
 if(t.dataset.action==='check'&&activeOk()){e.done=t.checked;persist();render();return;}
 if(t.name==='syncskill'){syncDraft.skill=t.value;render();return;}
 if(t.name==='synctiming'){syncDraft.timing=t.value;render();return;}
 if(t.name==='timing'&&activeOk()){e.timing=t.value;persist();render();return;}
 if(t.name==='stopped'&&activeOk()){e.stopped=t.value;persist();render();return;}
 if(t.dataset.skillField==='name'&&!t.value.trim()){const row=data.menu.steps.find(st=>st.id===t.dataset.editId)?.skills?.find(sk=>sk.id===t.dataset.skill);if(row){t.value=row.name;notify('技名は空欄にできません');}return;}
 const item=data.menu.steps.find(st=>st.id===t.dataset.editId);
 if(!item)return;
 if(t.dataset.editKey==='type'){const next=t.value;if(next===item.type)return;const recorded=data.active&&['active','paused'].includes(data.active.status)&&hasData(item,data.active.entries[item.id]);const update=()=>{item.type=next;item.target=['count','timing','sync'].includes(next)?Math.max(1,item.target||10):1;if(['count','timing'].includes(next)){item.inputMode='batch';item.batchSize=5;}if(next==='full'&&!Array.isArray(item.skills))item.skills=[];if(next==='full'&&item.showTiming===undefined)item.showTiming=false;applyMenuChange();render();};if(recorded){dialog('記録方式を変更しますか？','入力済みの記録は退避して保持し、新しい方式の入力は未実施から開始します。','変更する',update);t.value=item.type;}else update();return;}
 if(t.dataset.editKey==='target'){const n=Number(t.value);if(!Number.isInteger(n)||n<1||n>500){notify('目標回数は1〜500にしてください');t.value=item.target;return;}item.target=n;applyMenuChange();return;}
 if(t.dataset.editKey==='inputMode'&&['count','timing'].includes(item.type)){
  item.inputMode=t.value==='batch'?'batch':'single';applyMenuChange();render();return;
 }
 if(t.dataset.editKey==='batchSize'&&['count','timing'].includes(item.type)){
  item.batchSize=Number(t.value)===10?10:5;delete batchChoice[item.id];applyMenuChange();render();return;
 }
 if(t.dataset.editKey==='showTiming'){item.showTiming=t.checked;applyMenuChange();setTimeout(()=>{if(screen==='menu')render();},0);return;}

});
app.addEventListener('input',ev=>{const t=ev.target,ss=data.active,s=ss?.menu.steps[ss.stepIndex];
 if(t.dataset.improveMemo!==undefined){improvementMemoDraft[t.dataset.improveMemo]=t.value.slice(0,700);return;}
 if(t.dataset.menuName!==undefined){data.menu.name=t.value;applyMenuChange();return;}
 if(t.dataset.skillField){const item=data.menu.steps.find(st=>st.id===t.dataset.editId);const row=item?.skills?.find(sk=>sk.id===t.dataset.skill);if(!row)return;if(t.dataset.skillField==='name'&&!t.value.trim())return;row[t.dataset.skillField]=t.value;applyMenuChange();return;}
 if(t.dataset.editKey&&['group','name','detail','timingLabel'].includes(t.dataset.editKey)){const item=data.menu.steps.find(v=>v.id===t.dataset.editId);if(!item)return;item[t.dataset.editKey]=t.value;applyMenuChange();return;}
 if(ss?.status==='active'&&s){const e=ss.entries[s.id];if(t.id==='other-miss'){e.other=t.value;persist();}if(t.id==='rating-note'){e.note=t.value;persist();}}
});
document.querySelectorAll('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>{screen=btn.dataset.nav;render();window.scrollTo({top:0,behavior:'instant'});}));
// Runtime audit surface is disabled unless a test harness explicitly requests it.
// All ordinary sessions leave this API unexposed.
if (typeof window !== 'undefined' && window.__TRICKLOG_ENABLE_AUDIT_HOOKS__ === true) window.__TRICKLOG_RC_AUDIT__={fullBackup,prepareRestoreBackup,commitRestoredBackup,BACKUP_VERSION,menuLinkPlan:(next)=>menuLinkPlan(data,next),installMenu:(next,mapping)=>commitUpdate(st=>installMenuLinks(st,next,mapping)),offMenuGroups:()=>offMenuGroups(data),exerciseFor:step=>exerciseFor(step,data),completeTestById:tid=>commitUpdate(st=>completeImprovementById(st,tid)),cancelTestById:tid=>commitUpdate(st=>cancelImprovementById(st,tid)),updateRecord:(key,changes)=>commitUpdate(st=>updateImprovementRecord(st,key,changes)),deleteRecord:key=>commitUpdate(st=>deleteImprovementRecord(st,key)),deleteCompletedTest:tid=>commitUpdate(st=>deleteImprovementTest(st,tid)),dailyTotals:date=>dailyTotals(data,date),distinctSessions:()=>distinctSessions(data),getState:()=>clone(data),commitUpdate,resolveRecord:key=>resolveRecord(data,key),ongoingTest:stepId=>ongoingTest(data,data.active.menu.steps.find(s=>s.id===stepId)),latestNormalRecord:stepId=>latestNormalRecord(data,data.active.menu.steps.find(s=>s.id===stepId))};
// Deliberately do not write to localStorage merely by opening the RC.
// The user's v1.2.1 byte-for-byte snapshot stays intact until an explicit action.
render();
})();
