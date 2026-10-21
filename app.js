'use strict';
(()=>{
// TrickLog 1.1.0 -- Backwards-compatible with v1.x's tricklog_v1 localStorage data.
// Deliberately no analytics, account, remote APIs, or user-data network requests.
const STORE='tricklog_v1';
const id=()=> 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
const clone=x=>JSON.parse(JSON.stringify(x));
// Default is for new installations and explicit "reset to sample" only. Existing local data is never overwritten.
function defaultMenu(){
 const make=(group,name,type,target,extra={})=>({id:id(),group,name,type,target,detail:'',...extra});
 return {name:'練習メニュー（サンプル）',steps:[
  make('① 基本技','トラピーズ','count',10),
  make('② 音ハメ','グリーントライアングル','sync',5),
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
function blankEntry(s){if(s.type==='check')return{done:false};if(s.type==='count'||s.type==='sync')return{trials:[]};if(s.type==='rating')return{rating:null,note:''};return{ratings:Array((s.skills||[]).length).fill(null),timing:'',stopped:'',other:''};}
function newSession(menu,date=today()){return{id:id(),date,status:'active',stepIndex:0,menu:clone(menu),entries:Object.fromEntries(menu.steps.map(s=>[s.id,blankEntry(s)])),archivedItems:[],notes:'',endReason:'',endMemo:'',created:new Date().toISOString()};}
function initial(){let menu=defaultMenu();return{menu,active:newSession(menu),history:[],settings:{theme:'light'}};}
let data=initial(),storageOK=true;
try{const x=JSON.parse(localStorage.getItem(STORE));if(x&&x.menu&&Array.isArray(x.menu.steps)&&Array.isArray(x.history)){data=x;if(!data.active)data.active=newSession(data.menu);if(!data.settings)data.settings={theme:'light'};if(!data.active.archivedItems)data.active.archivedItems=[];}}catch(err){storageOK=false;console.warn('Storage unavailable',err);}
migrateSkillIds(data);
const themeValues=['light','dark','system'];
if(!themeValues.includes(data.settings.theme))data.settings.theme='light';
const applyTheme=()=>{document.documentElement.dataset.theme=data.settings.theme;document.querySelector('meta[name="theme-color"]').content=(data.settings.theme==='dark'||data.settings.theme==='system'&&matchMedia('(prefers-color-scheme: dark)').matches)?'#101621':'#f7f8fc';};
applyTheme();
try{matchMedia('(prefers-color-scheme: dark)').addEventListener('change',()=>{if(data.settings.theme==='system')applyTheme();});}catch{}
let screen='practice',editExpanded=null,historyOpen=null,syncDraft={skill:'',timing:''};
const app=document.querySelector('#app');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=sel=>document.querySelector(sel);
function persist(){try{localStorage.setItem(STORE,JSON.stringify(data));storageOK=true;}catch{storageOK=false;}}
function notify(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),2800);}
function dialog(title,body,yes,onYes,extra=''){const root=$('#modal-root');root.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><h2>${safe(title)}</h2><p>${safe(body)}</p>${extra}<div class="btnrow top-margin"><button class="btn line fill" id="modal-cancel">キャンセル</button><button class="btn primary fill" id="modal-yes">${safe(yes)}</button></div></div>`;$('#modal-cancel').onclick=()=>root.innerHTML='';$('#modal-yes').onclick=()=>{const success=onYes();if(success!==false)root.innerHTML='';};}
function download(name,content,mime='application/json'){const blob=new Blob([content],{type:mime});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);}
const ratio=(a,b)=>b?Math.round(a/b*100)+'%':'—';
function hasData(s,e){if(!e)return false;switch(s.type){case 'check':return Boolean(e.done);case 'count':case 'sync':return Boolean(e.trials?.length);case 'rating':return Boolean(e.rating||e.note);case 'full':return Boolean(e.ratings?.some(Boolean)||e.timing||e.stopped||e.other);default:return false;}}
function entryDone(s,e){if(!e)return false;switch(s.type){case'check':return !!e.done;case'count':case'sync':return (e.trials?.length||0)>=s.target;case'rating':return e.rating!==null&&e.rating!==undefined;case'full':return !!((s.skills?.length||0)>0&&e.ratings?.length===s.skills?.length&&e.ratings.every(Boolean)&&(!s.showTiming||e.timing)&&e.stopped);default:return false;}}
// When a menu changes, preserve entries by stable IDs, including any recorded trials.
// Deleted items or incompatible type edits move old entries to an inspectable, exported archive.
function syncActiveMenu(){const a=data.active;if(!a||!['active','paused'].includes(a.status))return;
 if(!a.archivedItems)a.archivedItems=[];
 const oldSteps=a.menu.steps;
 const previous=oldSteps[a.stepIndex]?.id;
 for(const old of oldSteps){const updated=data.menu.steps.find(s=>s.id===old.id);if(!updated){if(hasData(old,a.entries[old.id]))a.archivedItems.push({step:clone(old),entry:clone(a.entries[old.id]),reason:'メニューから削除',date:new Date().toISOString()});delete a.entries[old.id];}
 else if(updated.type!==old.type){if(hasData(old,a.entries[old.id]))a.archivedItems.push({step:clone(old),entry:clone(a.entries[old.id]),reason:'記録方式の変更',date:new Date().toISOString()});a.entries[old.id]=blankEntry(updated);}
 else if(updated.type==='full'&&JSON.stringify(updated.skills)!==JSON.stringify(old.skills)){
  const oldEntry=a.entries[old.id];const prior=(oldEntry.ratings||[]).slice();const current=updated.skills||[];
  const sameSkill=(a,b)=>a.id&&b.id?a.id===b.id:a.name===b.name&&a.part===b.part;
  const preserved=current.map(sk=>{const oldIdx=(old.skills||[]).findIndex(os=>sameSkill(os,sk));return oldIdx>=0?prior[oldIdx]||null:null;});
  if(hasData(old,oldEntry)&&(old.skills||[]).some((sk,i)=>prior[i]&&!current.some(next=>sameSkill(next,sk))))a.archivedItems.push({step:clone(old),entry:clone(oldEntry),reason:'評価項目の変更',date:new Date().toISOString()});
  oldEntry.ratings=preserved;
 }
 }
 for(const step of data.menu.steps){if(!a.entries[step.id])a.entries[step.id]=blankEntry(step);}
 a.menu=clone(data.menu);
 const pos=a.menu.steps.findIndex(s=>s.id===previous);
 a.stepIndex=pos===-1?Math.min(a.stepIndex,a.menu.steps.length-1):pos;
}
function applyMenuChange(){syncActiveMenu();persist();}
function render(){document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===screen));if(screen==='practice')practiceView();else if(screen==='menu')menuView();else historyView();}
function ratingsUI(value,type,index,disabled){return`<div class="rating-group">${[['ok','○ 成功',''],['mid','△ 不安定','mid'],['ng','× 失敗','bad']].map(([v,t,c])=>`<button ${disabled} type="button" data-action="${type==='full'?'set-full':'set-rating'}" ${index!==null?`data-index="${index}"`:''} data-val="${v}" class="${value===v?'selected '+c:''}">${t}</button>`).join('')}</div>`;}
function optionsUI(name,value,choices,disabled){return`<div class="optionrow">${choices.map(([v,l])=>`<label><input type="radio" name="${name}" value="${v}" ${value===v?'checked':''} ${disabled}><span>${l}</span></label>`).join('')}</div>`;}
function renderStep(s,e,editable){const disabled=editable?'':'disabled';let h='';
 if(s.type==='check')return `<p class="note">ウォーミングアップ完了後にチェックしてください。</p><label class="row"><strong>完了</strong><input type="checkbox" data-action="check" ${e.done?'checked':''} ${disabled} style="height:24px;width:24px"></label>`;
 if(s.type==='count'||s.type==='sync'){
  const n=e.trials.length,k=(s.type==='count'?e.trials.filter(x=>x===true):e.trials.filter(x=>x.skill==='ok')).length;
  h+=`<div class="row"><span class="inline-label">目標 ${s.target}回</span><span class="pill ${n>=s.target?'done':''}">${n>=s.target?'目標達成':'残り'+(s.target-n)+'回'}</span></div><div class="progress"><div style="width:${Math.min(100,n/s.target*100)}%"></div></div><div class="statgrid top-margin"><div class="stat"><b>${n}/${s.target}</b><small>試行</small></div><div class="stat"><b>${k}</b><small>${s.type==='sync'?'技の成功':'成功回数'}</small></div><div class="stat"><b>${ratio(k,n)}</b><small>成功率</small></div></div>`;
  if(s.type==='count')h+=`<div class="bigactions"><button class="btn green" data-action="trial" data-val="ok" ${disabled} ${n>=s.target?'disabled':''}>○ 成功</button><button class="btn red" data-action="trial" data-val="ng" ${disabled} ${n>=s.target?'disabled':''}>× 失敗</button></div>`;
  else{const t=e.trials.filter(x=>x.timing!=='unknown').length,m=e.trials.filter(x=>x.timing==='fit').length;h+=`<div class="trial-summary top-margin"><div class="row"><span class="inline-label">音ハメ</span><b>${m}/${t}（${ratio(m,t)}）</b></div><div class="mini">判定不能：${e.trials.filter(x=>x.timing==='unknown').length}回</div></div><div class="field top-margin"><label>今回の技</label>${optionsUI('syncskill',syncDraft.skill,[['ok','○ 成功'],['ng','× 失敗']],disabled)}</div><div class="field"><label>今回の音ハメ</label>${optionsUI('synctiming',syncDraft.timing,[['fit','合った'],['early','早い'],['late','遅い'],['unknown','判定不能']],disabled)}</div><button class="btn primary wide" data-action="sync-add" ${disabled} ${n>=s.target||!syncDraft.skill||!syncDraft.timing?'disabled':''}>この1回を記録 ＋</button>`;}
  h+=`<div class="row top-margin"><span class="muted">${n?'最近の記録':'まだ記録がありません'}</span><button class="btn line small" data-action="undo-trial" ${disabled} ${n===0?'disabled':''}>↶ 1回取り消し</button></div>`;
  if(n)h+=`<div class="trial-history">${e.trials.map((v,i)=>{const ok=s.type==='count'?v===true:v.skill==='ok';return`<span class="trial-dot ${ok?'ok':'ng'}">${i+1} ${ok?'○':'×'}</span>`;}).join('')}</div>`;return h;
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
 const s=ss.menu.steps[ss.stepIndex],e=ss.entries[s.id],completed=ss.menu.steps.filter(v=>entryDone(v,ss.entries[v.id])).length;
 const status={active:'練習中',paused:'一時中断',ended:'途中終了',complete:'全メニュー完了'}[ss.status];
 let h=`<div class="page"><div class="hero"><div class="eyebrow">TODAY'S PRACTICE · v1.1.2</div><h1>${safe(ss.menu.name)}</h1></div>`;
 if(!storageOK)h+='<div class="alert">端末の保存領域に書き込めません。バックアップをお試しください。</div>';
 h+=`<div class="card"><div class="row"><div class="field" style="margin:0;max-width:180px;flex:1"><label>練習日</label><input type="date" id="session-date" value="${safe(ss.date)}" ${ss.status==='active'?'':'disabled'}></div><span class="pill ${ss.status==='complete'?'done':ss.status==='ended'?'warn':''}">${status}</span></div><div class="row top-margin"><span class="muted">進捗 ${completed}/${ss.menu.steps.length}項目</span><span class="muted">${Math.round(completed/ss.menu.steps.length*100)}%</span></div><div class="progress top-margin"><div style="width:${completed/ss.menu.steps.length*100}%"></div></div></div>`;
 h+=`<div class="sectionbar"><h2>練習ステップ</h2><span class="muted">タップして移動</span></div><div class="step-nav">${ss.menu.steps.map((st,i)=>`<button class="step-chip ${ss.stepIndex===i?'active':entryDone(st,ss.entries[st.id])?'complete':''}" data-action="go-step" data-index="${i}">${i+1} ${entryDone(st,ss.entries[st.id])?'✓ ':''}${safe(st.name.length>11?st.name.slice(0,11)+'…':st.name)}</button>`).join('')}</div>`;
 h+=`<div class="card"><div class="step-head"><span class="pill">${safe(s.group)}</span><span class="muted">${ss.stepIndex+1} / ${ss.menu.steps.length}</span></div><h2 class="step-title">${safe(s.name)}</h2>${s.detail?`<div class="step-meta">${safe(s.detail)}</div>`:''}`;
 if(ss.status==='paused')h+='<div class="alert top-margin">一時中断中です。「練習再開」で入力できます。</div>';
 if(ss.status==='ended'||ss.status==='complete')h+='<div class="okbox top-margin">この日の記録は終了しました。</div>';
 h+=`<div class="subsection">${renderStep(s,e,ss.status==='active')}</div><div class="divider"></div><div class="btnrow"><button class="btn line fill" data-action="step-prev" ${ss.stepIndex===0?'disabled':''}>← 前へ</button><button class="btn primary fill" data-action="step-next" ${ss.stepIndex===ss.menu.steps.length-1?'disabled':''}>次へ →</button></div></div>`;
 h+=`<div class="card"><div class="sectionbar" style="margin-top:0"><h2>練習の管理</h2></div><div class="btnrow">${ss.status==='active'?`<button class="btn line fill" data-action="pause">一時中断</button><button class="btn line fill" data-action="end">今日はここで終了</button>`:ss.status==='paused'?`<button class="btn primary fill" data-action="resume">▶ 練習再開</button><button class="btn line fill" data-action="end">今日はここで終了</button>`:''}</div><div class="btnrow top-margin">${['active','paused'].includes(ss.status)?`<button class="btn green fill" data-action="complete" ${completed!==ss.menu.steps.length?'disabled':''}>✓ 全メニュー完了</button>`:''}<button class="btn line fill" data-action="save-snapshot">記録をバックアップ</button><button class="btn line fill" data-action="copy-summary">結果をコピー</button></div><p class="note">記録はこの端末に保存されます。ブラウザのデータ削除に備え、定期的にバックアップしてください。</p></div>`;
 if(ss.archivedItems?.length)h+=`<div class="card"><div class="sectionbar" style="margin:0"><h2>変更前の記録（退避済み）</h2><span class="pill warn">${ss.archivedItems.length}件</span></div><p class="note">メニューの削除や記録方式変更に伴う記録を保存しています。バックアップ・履歴にも含まれます。</p>${ss.archivedItems.map(a=>`<div class="row" style="border-top:1px solid var(--line);padding:9px 0"><span class="mini">${safe(a.step.name)}</span><span class="mini">${safe(scoreLabel(a.step,a.entry))}</span></div>`).join('')}</div>`;
 h+='</div>';app.innerHTML=h;
}
function menuView(){const m=data.menu;const live=data.active&&['active','paused'].includes(data.active.status);
 let h=`<div class="page"><div class="hero"><div class="eyebrow">CUSTOMIZE YOUR ROUTINE · v1.1.2</div><h1>自分だけのメニューを作る</h1><p>技名・目標回数・順番をいつでも変更できます。</p></div>`;

 h+=`<div class="card"><div class="field"><label>メニュー名</label><input data-menu-name value="${safe(m.name)}" maxlength="100"></div><div class="okbox">${live?'追加・編集・並べ替えは、現在の練習画面へすぐ反映されます。入力済みの回数は保持します。':'このメニューは次に開始する練習から使われます。終了済みの履歴は変わりません。'}</div><div class="btnrow top-margin"><button class="btn line fill" data-action="export-menu">メニュー共有用に書き出す</button><button class="btn line fill" data-action="import-menu">メニューを読み込む</button></div></div>`;
 h+=`<div class="sectionbar"><h2>練習項目（${m.steps.length}）</h2><span class="muted">編集・移動できます</span></div>`;
 m.steps.forEach((s,i)=>{const open=editExpanded===s.id;h+=`<div class="edititem"><div class="row row-top"><div style="flex:1"><div class="mini">${safe(s.group)} · ${safe(typeLabel(s.type))} ${['count','sync'].includes(s.type)?'· '+s.target+'回':''}</div><h3>${safe(s.name)}</h3></div><button class="btn small line" data-action="edit-toggle" data-id="${s.id}">${open?'閉じる':'編集'}</button></div>`;
 if(open){h+=`<div class="divider"></div><div class="field"><label>分類・パート名</label><input data-edit-key="group" data-edit-id="${s.id}" value="${safe(s.group)}"></div><div class="field"><label>練習項目名</label><input data-edit-key="name" data-edit-id="${s.id}" value="${safe(s.name)}"></div><div class="field"><label>記録方式</label><select data-edit-key="type" data-edit-id="${s.id}">${[['count','回数制（○×）'],['sync','音ハメ（技＋タイミング）'],['full','通し（各技 ○△×）'],['rating','総合評価（○△×）']].map(([v,l])=>`<option value="${v}" ${s.type===v?'selected':''}>${l}</option>`).join('')}${s.type==='check'?'<option value="check" selected disabled>完了チェック（旧形式）</option>':''}</select></div>`;
 if(['count','sync'].includes(s.type))h+=`<div class="field"><label>目標試行回数</label><input type="number" min="1" max="500" data-edit-key="target" data-edit-id="${s.id}" value="${s.target}"></div>`;
 h+=`<div class="field"><label>説明（任意）</label><input data-edit-key="detail" data-edit-id="${s.id}" value="${safe(s.detail||'')}"></div>`;
 if(s.type==='full')h+=`<div class="field"><label style="display:flex;gap:9px;align-items:center"><input type="checkbox" data-edit-key="showTiming" data-edit-id="${s.id}" ${s.showTiming?'checked':''} style="width:20px;height:20px">音ハメ評価を使用する</label></div>${s.showTiming?`<div class="field"><label>音ハメ項目名</label><input data-edit-key="timingLabel" data-edit-id="${s.id}" value="${safe(s.timingLabel||'音ハメ')}"></div>`:''}<div class="skill-editor"><div class="row"><strong class="inline-label">評価する技（${(s.skills||[]).length}件）</strong><span class="mini">1件ずつ追加・編集</span></div>
 ${(s.skills||[]).length?'<p class="note">技名とパートを個別に入力できます。順番は↑↓で変更可能です。</p>':'<div class="alert">まだ技が登録されていません。下の欄から追加してください。</div>'}
 ${(s.skills||[]).map((sk,k)=>`<div class="skill-edit-card"><div class="row"><span class="tiny-badge">技 ${k+1}</span><div class="btnrow"><button class="btn small line" data-action="skill-up" data-id="${s.id}" data-skill="${safe(sk.id)}" ${k===0?'disabled':''}>↑</button><button class="btn small line" data-action="skill-down" data-id="${s.id}" data-skill="${safe(sk.id)}" ${k===s.skills.length-1?'disabled':''}>↓</button><button class="btn small red" data-action="skill-delete" data-id="${s.id}" data-skill="${safe(sk.id)}">削除</button></div></div><div class="field"><label>技名</label><input data-skill-field="name" data-edit-id="${s.id}" data-skill="${safe(sk.id)}" value="${safe(sk.name)}" maxlength="160"></div><div class="field"><label>パート・分類（任意）</label><input data-skill-field="part" data-edit-id="${s.id}" data-skill="${safe(sk.id)}" value="${safe(sk.part||'')}" maxlength="40" placeholder="例：Part1"></div></div>`).join('')}
 <div class="skill-add"><div class="field"><label>新しい技名</label><input data-new-skill-name="${s.id}" placeholder="例：トラピーズ" maxlength="160"></div><div class="field"><label>パート・分類（任意）</label><input data-new-skill-part="${s.id}" placeholder="例：Part1" maxlength="40"></div><button class="btn primary wide" data-action="skill-add" data-id="${s.id}">＋ 技を追加</button></div></div>`;
 h+=`<div class="btnrow"><button class="btn small line" data-action="move-up" data-index="${i}" ${i===0?'disabled':''}>↑ 上へ</button><button class="btn small line" data-action="move-down" data-index="${i}" ${i===m.steps.length-1?'disabled':''}>↓ 下へ</button><button class="btn small line" data-action="duplicate" data-index="${i}">複製</button><button class="btn small red" data-action="delete-step" data-index="${i}">削除</button></div>`;
 }h+='</div>';});
 h+=`<div class="card"><h2 style="font-size:16px;margin-top:0">項目を追加</h2><div class="field"><label>練習名</label><input id="new-name" placeholder="例：新しいコンボ" maxlength="100"></div><div class="field"><label>記録方式</label><select id="new-type"><option value="count">回数制（○×）</option><option value="sync">音ハメ（技＋タイミング）</option><option value="full">通し（各技 ○△×）</option><option value="rating">総合評価（○△×）</option></select></div><div class="field"><label>目標回数（回数制・音ハメに使用）</label><input id="new-target" type="number" min="1" max="500" value="10"></div><button class="btn primary wide" data-action="add-step">＋ メニューに追加</button></div>`;
 h+=`<div class="card"><button class="btn line wide" data-action="reset-template">初期サンプル（4項目）に戻す</button><p class="note">確認後に初期化します。終了済みの練習履歴は削除されません。</p></div></div>`;app.innerHTML=h;
}
function typeLabel(t){return{count:'回数制',sync:'音ハメ',full:'通し',rating:'総合評価',check:'チェック'}[t]||t;}
function scoreLabel(s,e){if(!e)return '未実施';if(s.type==='check')return e.done?'完了':'未実施';if(s.type==='count'||s.type==='sync'){const n=e.trials?.length||0,k=s.type==='count'?e.trials.filter(Boolean).length:e.trials.filter(x=>x.skill==='ok').length;return n?`${k}/${n}成功（${ratio(k,n)}）`:'未実施';}if(s.type==='rating')return e.rating?({ok:'○ 成功',mid:'△ 不安定',ng:'× 失敗'}[e.rating]):'未実施';if(s.type==='full'){const vals=(e.ratings||[]).filter(Boolean);return vals.length?`失敗${vals.filter(x=>x==='ng').length}・不安定${vals.filter(x=>x==='mid').length}（${vals.length}評価）`:'未実施';}return '未実施';}
function sessionDetail(ss){let o='';ss.menu.steps.forEach(s=>{const e=ss.entries[s.id];o+=`<div class="row" style="border-bottom:1px solid var(--line);padding:9px 0"><span class="mini" style="flex:1;color:var(--text)">${safe(s.name)}</span><span class="mini" style="text-align:right">${safe(scoreLabel(s,e))}</span></div>`;});for(const a of ss.archivedItems||[]){o+=`<div class="row" style="border-bottom:1px solid var(--line);padding:9px 0"><span class="mini" style="flex:1">[退避] ${safe(a.step.name)}</span><span class="mini">${safe(scoreLabel(a.step,a.entry))}</span></div>`;}if(ss.endReason)o+=`<p class="note">終了理由：${safe(ss.endReason)}${ss.endMemo?' / '+safe(ss.endMemo):''}</p>`;return o;}
function historyView(){let h=`<div class="page"><div class="hero"><div class="eyebrow">YOUR PROGRESS · v1.1.2</div><h1>履歴とデータ管理</h1><p>練習記録は端末内に保存されます。</p></div>`;
 h+=`<div class="card"><div class="sectionbar" style="margin:0 0 12px"><h2>外観設定</h2></div><div class="theme-choices">${[['light','☀ ライト'],['dark','☾ ダーク'],['system','◫ 端末に合わせる']].map(([key,label])=>`<button class="theme-choice" data-action="set-theme" data-theme="${key}" aria-pressed="${data.settings.theme===key}">${label}</button>`).join('')}</div><p class="note">選択はこの端末内に保存され、オフラインでも維持されます。</p></div>`;

 h+=`<div class="card"><h2 style="margin:0 0 10px;font-size:16px">バックアップ・共有</h2><div class="btnrow"><button class="btn primary fill" data-action="export-backup">全データをバックアップ</button><button class="btn line fill" data-action="import-backup">バックアップを復元</button></div><div class="btnrow top-margin"><button class="btn line fill" data-action="export-menu">友人にメニューを共有</button><button class="btn line fill" data-action="import-menu">友人のメニューを読み込む</button></div><p class="note">全バックアップには履歴を含みます。友人には「メニューを共有」のJSONのみ渡してください。</p></div>`;
 h+=`<div class="card"><h2 style="margin:0 0 12px;font-size:16px">現在の練習</h2><div class="row"><div><strong>${safe(data.active?.date||'—')}</strong><div class="mini">${safe(data.active?.menu?.name||'')}</div></div><span class="pill">${safe(({active:'練習中',paused:'一時中断',ended:'途中終了',complete:'全完了'}[data.active?.status])||'—')}</span></div><div class="btnrow top-margin"><button class="btn primary fill" data-action="new-session">＋ 新しい練習日を開始</button><button class="btn line fill" data-action="save-snapshot">現在の記録を保存</button></div></div>`;
 h+=`<div class="sectionbar"><h2>保存済みの練習履歴</h2><span class="muted">${data.history.length}件</span></div>`;
 if(!data.history.length)h+='<div class="empty"><span class="glyph">▤</span><strong>まだ履歴がありません</strong>練習を終了するとここに追加されます。</div>';
 for(const ss of [...data.history].reverse()){const completed=ss.menu.steps.filter(s=>entryDone(s,ss.entries[s.id])).length;h+=`<div class="historyentry"><div class="row"><div><h3>${safe(ss.date)} ${safe(ss.menu.name)}</h3><div class="mini">${completed}/${ss.menu.steps.length}項目完了 · ${ss.status==='complete'?'全メニュー完了':'途中終了'}</div></div><div class="btnrow"><button class="btn small line" data-action="history-toggle" data-id="${ss.id}">${historyOpen===ss.id?'閉じる':'詳細'}</button><button class="btn small line" data-action="export-session" data-id="${ss.id}">保存</button></div></div>${historyOpen===ss.id?`<div class="subsection">${sessionDetail(ss)}</div>`:''}</div>`;}
 h+=`<div class="card soft"><strong style="font-size:13px">保存について</strong><p class="note">アカウントやクラウド同期はありません。アプリの更新や端末変更の前にJSONバックアップを保存してください。</p></div></div>`;app.innerHTML=h;
}
function archiveCurrent(){if(!data.active)return;data.history.push(clone(data.active));data.history=data.history.slice(-400);}
function endSession(kind,reason='',memo=''){const ss=data.active;ss.status=kind;ss.endReason=reason;ss.endMemo=memo;ss.ended=new Date().toISOString();archiveCurrent();persist();render();notify('練習履歴に保存しました');}
function validateMenu(obj){if(!obj||!Array.isArray(obj.steps)||obj.steps.length<1||obj.steps.length>150)throw Error('メニューの項目数が不正です');const seen=new Set();const steps=obj.steps.map(item=>{if(typeof item.name!=='string'||!item.name.trim()||item.name.length>120||!['count','sync','full','rating','check'].includes(item.type))throw Error('練習項目の形式が不正です');if(['count','sync'].includes(item.type)&&(!Number.isInteger(item.target)||item.target<1||item.target>500))throw Error('目標回数は1〜500にしてください');let sid=item.id;if(!sid||seen.has(sid))sid=id();seen.add(sid);let s={id:sid,group:String(item.group||'自由練習').slice(0,70),name:item.name.slice(0,120),type:item.type,target:['count','sync'].includes(item.type)?item.target:1,detail:String(item.detail||'').slice(0,400)};if(item.type==='full'){if(!Array.isArray(item.skills)||item.skills.length>60)throw Error('通し練習の技一覧が不正です');s.skills=item.skills.map(x=>({id:typeof x.id==='string'&&x.id?x.id:id(),part:String(x.part||'').slice(0,40),name:String(x.name||'').slice(0,160)}));if(s.skills.some(x=>!x.name.trim()))throw Error('技名が入力されていません');s.showTiming=!!item.showTiming;s.timingLabel=String(item.timingLabel||'音ハメ').slice(0,100);}return s;});return{name:typeof obj.name==='string'?obj.name.slice(0,100):'共有メニュー',steps};}
async function importFile(kind){const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>4e6)throw Error('ファイルが大きすぎます（4MB以内）');const obj=JSON.parse(await file.text());if(kind==='menu'){const menu=validateMenu(obj.kind==='tricklog-menu'?obj.menu:obj);dialog('メニューを読み込みますか？','現在のメニューが置き換わり、練習中なら即時反映されます。古い記録は保持します。','読み込む',()=>{data.menu=menu;applyMenuChange();editExpanded=null;render();notify('メニューを読み込みました');});}else{if(obj.kind!=='tricklog-backup'||!obj.data||!obj.data.menu||!Array.isArray(obj.data.history))throw Error('バックアップ形式が正しくありません');const restored=obj.data;restored.menu=validateMenu(restored.menu);dialog('全データを復元しますか？','現在の練習・履歴・メニューが上書きされます。必要なら先に現在のデータをバックアップしてください。','上書き復元',()=>{data=restored;if(!data.active)data.active=newSession(data.menu);if(!data.active.archivedItems)data.active.archivedItems=[];migrateSkillIds(data);if(!data.settings||!themeValues.includes(data.settings.theme))data.settings={theme:'light'};applyTheme();persist();screen='practice';render();notify('バックアップを復元しました');});}}catch(err){notify('読み込み失敗：'+err.message);}};input.click();}
function exportBackup(){download('TrickLog_backup_'+today()+'.json',JSON.stringify({kind:'tricklog-backup',version:2,exported:new Date().toISOString(),data},null,2));notify('全データを書き出しました');}
function exportMenu(){download('TrickLog_menu.json',JSON.stringify({kind:'tricklog-menu',version:2,menu:data.menu},null,2));notify('共有用メニューを書き出しました');}
function exportSnapshot(){download('TrickLog_session_'+data.active.date+'.json',JSON.stringify({kind:'tricklog-session',version:2,session:data.active},null,2));notify('現在の記録を書き出しました');}
function summaryText(ss){const rows=[`TrickLog 練習記録｜${ss.date}`,`メニュー：${ss.menu.name}`,`状態：${({active:'練習中',paused:'一時中断',complete:'全メニュー完了',ended:'途中終了'}[ss.status])}`];ss.menu.steps.forEach(s=>rows.push(`・${s.name}：${scoreLabel(s,ss.entries[s.id])}`));(ss.archivedItems||[]).forEach(x=>rows.push(`・[退避] ${x.step.name}：${scoreLabel(x.step,x.entry)}`));return rows.join('\n');}
async function copySummary(){const text=summaryText(data.active);try{await navigator.clipboard.writeText(text);notify('結果をコピーしました');}catch{const input=document.createElement('textarea');input.value=text;document.body.appendChild(input);input.select();const success=document.execCommand('copy');input.remove();notify(success?'結果をコピーしました':'コピーできませんでした');}}
function newSessionConfirm(){dialog('新しい練習を始めますか？','今の記録は履歴に保存され、新しい練習日が始まります。','新しく開始',()=>{if(data.active&&!['ended','complete'].includes(data.active.status)){data.active.status='ended';data.active.endReason='新規練習開始';archiveCurrent();}data.active=newSession(data.menu);syncDraft={skill:'',timing:''};persist();screen='practice';render();notify('新しい練習を開始しました');});}
const activeOk=()=>data.active?.status==='active';
app.addEventListener('click',ev=>{const btn=ev.target.closest('[data-action]');if(!btn)return;
 const action=btn.dataset.action,ss=data.active,s=ss?.menu.steps[ss.stepIndex],e=s?ss.entries[s.id]:null;
 if(action==='go-step'){ss.stepIndex=Number(btn.dataset.index);syncDraft={skill:'',timing:''};persist();render();return;}
 if(action==='step-prev'||action==='step-next'){ss.stepIndex=Math.max(0,Math.min(ss.menu.steps.length-1,ss.stepIndex+(action==='step-prev'?-1:1)));syncDraft={skill:'',timing:''};persist();render();return;}
 if(action==='trial'&&activeOk()&&s.type==='count'&&e.trials.length<s.target){e.trials.push(btn.dataset.val==='ok');persist();render();return;}
 if(action==='sync-add'&&activeOk()&&s.type==='sync'&&e.trials.length<s.target&&syncDraft.skill&&syncDraft.timing){e.trials.push({...syncDraft});syncDraft={skill:'',timing:''};persist();render();return;}
 if(action==='undo-trial'&&activeOk()&&e?.trials?.length){e.trials.pop();persist();render();return;}
 if(action==='set-full'&&activeOk()){e.ratings[Number(btn.dataset.index)]=btn.dataset.val;persist();render();return;}
 if(action==='set-rating'&&activeOk()){e.rating=btn.dataset.val;persist();render();return;}
 if(action==='pause'&&activeOk()){ss.status='paused';persist();render();notify('一時中断しました');return;}
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
 if(action==='export-session'){const row=data.history.find(x=>x.id===btn.dataset.id);if(row)download('TrickLog_'+row.date+'_'+row.id+'.json',JSON.stringify({kind:'tricklog-session',version:2,session:row},null,2));return;}
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
 if(action==='add-step'){const name=$('#new-name').value.trim(),type=$('#new-type').value,target=Number($('#new-target').value);if(!name){notify('練習名を入力してください');return;}if(['count','sync'].includes(type)&&(!Number.isInteger(target)||target<1||target>500)){notify('目標回数は1〜500で指定してください');return;}const item={id:id(),name,group:'自由練習',type,target:['count','sync'].includes(type)?target:1,detail:'',...(type==='full'?{skills:[],showTiming:false,timingLabel:'音ハメ'}:{})};data.menu.steps.push(item);editExpanded=item.id;applyMenuChange();render();notify('項目を現在の練習にも追加しました');return;}
 if(action==='reset-template'){dialog('初期メニューへ戻しますか？','現在の編集済みメニューを新しい4項目のサンプルに置き換えます。練習中の記録がある項目は退避します。','初期化する',()=>{data.menu=defaultMenu();editExpanded=null;applyMenuChange();render();});return;}
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
 if(t.dataset.editKey==='type'){const next=t.value;if(next===item.type)return;const recorded=data.active&&['active','paused'].includes(data.active.status)&&hasData(item,data.active.entries[item.id]);const update=()=>{item.type=next;item.target=['count','sync'].includes(next)?Math.max(1,item.target||10):1;if(next==='full'&&!Array.isArray(item.skills))item.skills=[];if(next==='full'&&item.showTiming===undefined)item.showTiming=false;applyMenuChange();render();};if(recorded){dialog('記録方式を変更しますか？','入力済みの記録は退避して保持し、新しい方式の入力は未実施から開始します。','変更する',update);t.value=item.type;}else update();return;}
 if(t.dataset.editKey==='target'){const n=Number(t.value);if(!Number.isInteger(n)||n<1||n>500){notify('目標回数は1〜500にしてください');t.value=item.target;return;}item.target=n;applyMenuChange();return;}
 if(t.dataset.editKey==='showTiming'){item.showTiming=t.checked;applyMenuChange();setTimeout(()=>{if(screen==='menu')render();},0);return;}

});
app.addEventListener('input',ev=>{const t=ev.target,ss=data.active,s=ss?.menu.steps[ss.stepIndex];
 if(t.dataset.menuName!==undefined){data.menu.name=t.value;applyMenuChange();return;}
 if(t.dataset.skillField){const item=data.menu.steps.find(st=>st.id===t.dataset.editId);const row=item?.skills?.find(sk=>sk.id===t.dataset.skill);if(!row)return;if(t.dataset.skillField==='name'&&!t.value.trim())return;row[t.dataset.skillField]=t.value;applyMenuChange();return;}
 if(t.dataset.editKey&&['group','name','detail','timingLabel'].includes(t.dataset.editKey)){const item=data.menu.steps.find(v=>v.id===t.dataset.editId);if(!item)return;item[t.dataset.editKey]=t.value;applyMenuChange();return;}
 if(ss?.status==='active'&&s){const e=ss.entries[s.id];if(t.id==='other-miss'){e.other=t.value;persist();}if(t.id==='rating-note'){e.note=t.value;persist();}}
});
document.querySelectorAll('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>{screen=btn.dataset.nav;render();window.scrollTo({top:0,behavior:'instant'});}));
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
persist();render();
})();
