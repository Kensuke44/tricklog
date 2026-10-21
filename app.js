'use strict';
(()=>{
const STORE='tricklog_v1';
const fullSkills=[
 {part:'Part1',name:'ユウキコンボ1の締めバインド'},
 {part:'Part2',name:'くるくるぽん'},
 {part:'Part2',name:'ケンゴさんのリストマウント'},
 {part:'Part2',name:'メタスラック'},
 {part:'Part3',name:'ザックのフーディーニコンボ'},
 {part:'Part4',name:'ザックのスラックグリトラ'},
 {part:'Part4',name:'ラップテンションフック'},
 {part:'Part4',name:'スウィープアウト終盤'},
 {part:'Part4',name:'ミウラハジメさんの置き土産終盤'}
];
const id=()=> 's'+Date.now().toString(36)+Math.random().toString(36).slice(2,7);
const today=()=>new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Tokyo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
function defaultMenu(){const make=(group,name,type,target,detail='',skills)=>({id:id(),group,name,type,target,detail,...(skills?{skills:JSON.parse(JSON.stringify(skills)),showTiming:true,timingLabel:'フーディーニ終了の無音音ハメ'}:{})});return {
 name:'1Aフリースタイル｜10/19〜11/1',
 steps:[
  make('① ウォーミングアップ','基本技・軽いバインド','check',1),
  make('② 2分通し①','2分通し①','full',1,'0:00〜2:00',fullSkills),
  make('③ ★ 山場','フーディーニ終了の無音音ハメ','sync',10,'技の成功と音ハメを別々に評価'),
  make('③ ★ 山場','フーディーニ → スラックグリトラ → バインド・キャッチ','count',5),
  make('④ A：Part4','ラップテンションフック','count',8,'ユウキコンボ1から接続'),
  make('④ A：Part4','スウィープアウト終盤','count',6,'FHリジェクショントライアングルまで接続'),
  make('⑤ B：Part2','くるくるぽん','count',8),
  make('⑤ B：Part2','ケンゴさんのリストマウント','count',6),
  make('⑤ B：Part2','メタスラック','count',6),
  make('⑥ C：Part1・フィニッシュ','ユウキコンボ1の締めバインド','count',6),
  make('⑥ C：Part1・フィニッシュ','ミウラハジメさんの置き土産終盤 → バインド・キャッチ','count',6),
  make('⑥ C：Part1・フィニッシュ','Part3b（0:53〜2:00）通し','rating',1),
  make('⑦ 2分通し②','2分通し②','full',1,'0:00〜2:00',fullSkills)
 ]};}
function blankEntry(step){if(step.type==='check')return {done:false};if(step.type==='count'||step.type==='sync')return{trials:[]};if(step.type==='rating')return{rating:null,note:''};return {ratings:Array(step.skills?.length||0).fill(null),timing:'',stopped:'',other:''};}
function newSession(menu,date=today()){return {id:id(),date,status:'active',stepIndex:0,menu:JSON.parse(JSON.stringify(menu)),entries:Object.fromEntries(menu.steps.map(s=>[s.id,blankEntry(s)])),notes:'',endReason:'',endMemo:'',created:new Date().toISOString()};}
const fallback={menu:defaultMenu(),active:null,history:[]};fallback.active=newSession(fallback.menu);
let data,storageOK=true;
try {const parsed=JSON.parse(localStorage.getItem(STORE));data=parsed&&parsed.menu&&Array.isArray(parsed.menu.steps)&&Array.isArray(parsed.history)?parsed:fallback;}catch{data=fallback;storageOK=false;}
if(!data.active)data.active=newSession(data.menu);
let screen='practice', editExpanded=null, historyOpen=null, syncDraft={skill:'',timing:''};
const app=document.querySelector('#app');
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=sel=>document.querySelector(sel);
function persist(){try{localStorage.setItem(STORE,JSON.stringify(data));storageOK=true;}catch{storageOK=false;}}
function notify(msg){const el=$('#toast');el.textContent=msg;el.classList.add('show');clearTimeout(notify.timer);notify.timer=setTimeout(()=>el.classList.remove('show'),2800)}
function dialog(title,body,yes,onYes,extra=''){const root=$('#modal-root');root.innerHTML=`<div class="modal" role="dialog" aria-modal="true"><h2>${safe(title)}</h2><p>${safe(body)}</p>${extra}<div class="btnrow top-margin"><button class="btn line fill" id="modal-cancel">キャンセル</button><button class="btn primary fill" id="modal-yes">${safe(yes)}</button></div></div>`;$('#modal-cancel').onclick=()=>root.innerHTML='';$('#modal-yes').onclick=()=>{onYes();root.innerHTML=''};}
function download(filename,content,mime='application/json'){const blob=new Blob([content],{type:mime});const u=URL.createObjectURL(blob);const a=document.createElement('a');a.href=u;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),1000)}
const ratio=(a,b)=>b?Math.round(a/b*100)+'%':'—';
function entryDone(s,e){if(!e)return false;switch(s.type){case 'check':return e.done;case 'count':case 'sync':return e.trials.length>=s.target;case 'rating':return e.rating!==null;case 'full':return e.ratings.length===s.skills.length&&e.ratings.every(Boolean)&&(!s.showTiming||Boolean(e.timing))&&Boolean(e.stopped);default:return false;}}
function stepStatus(s,e){if(entryDone(s,e))return 'done';if(s.type==='check')return 'none';if(s.type==='count'||s.type==='sync')return e.trials.length?'partial':'none';if(s.type==='rating')return e.rating?'partial':'none';return e.ratings.some(Boolean)||e.timing||e.stopped?'partial':'none';}
function scoreCount(s,e){if(s.type==='count'){const n=e.trials.length,k=e.trials.filter(x=>x===true).length;return{k,n};}if(s.type==='sync'){const n=e.trials.length,k=e.trials.filter(x=>x.skill==='ok').length;return{k,n};}return null;}
function render(){document.querySelectorAll('[data-nav]').forEach(x=>x.classList.toggle('active',x.dataset.nav===screen));if(screen==='practice')practiceView();if(screen==='menu')menuView();if(screen==='history')historyView();}
function practiceView(){const ss=data.active;if(!ss){app.innerHTML=`<div class="page"><div class="empty"><strong>練習を始めましょう</strong><button class="btn primary" data-action="new-session">新しい練習を開始</button></div></div>`;return;}
const step=ss.menu.steps[ss.stepIndex], e=ss.entries[step.id];const completed=ss.menu.steps.filter(s=>entryDone(s,ss.entries[s.id])).length;
const status={active:'練習中',paused:'一時中断',ended:'途中終了',complete:'全メニュー完了'}[ss.status];
let h=`<div class="page"><div class="hero"><div class="eyebrow">TODAY'S PRACTICE</div><h1>${safe(ss.menu.name)}</h1><p>自分のペースで、1回ずつ記録しよう。</p></div>`;
if(!storageOK)h+='<div class="alert">端末への保存ができません。データが失われる前に「履歴・共有」からバックアップを書き出してください。</div>';
h+=`<div class="card"><div class="row"><div class="field" style="margin:0;max-width:170px;flex:1"><label>練習日</label><input type="date" id="session-date" value="${safe(ss.date)}" ${ss.status==='ended'||ss.status==='complete'?'disabled':''}></div><span class="pill ${ss.status==='complete'?'done':ss.status==='ended'?'warn':''}">${status}</span></div><div class="row top-margin"><span class="muted">メニュー進捗 ${completed}/${ss.menu.steps.length}項目</span><span class="muted">${Math.round(completed/Math.max(1,ss.menu.steps.length)*100)}%</span></div><div class="progress top-margin"><div style="width:${completed/Math.max(1,ss.menu.steps.length)*100}%"></div></div></div>`;
h+='<div class="sectionbar"><h2>練習ステップ</h2><span class="muted">タップして移動</span></div><div class="step-nav">';
ss.menu.steps.forEach((s,i)=>h+=`<button class="step-chip ${ss.stepIndex===i?'active':entryDone(s,ss.entries[s.id])?'complete':''}" data-action="go-step" data-index="${i}">${i+1} ${entryDone(s,ss.entries[s.id])?'✓ ':''}${safe(s.name.length>11?s.name.slice(0,11)+'…':s.name)}</button>`);
h+='</div>';
h+=`<div class="card"><div class="step-head"><span class="pill">${safe(step.group)}</span><span class="muted">${ss.stepIndex+1} / ${ss.menu.steps.length}</span></div><h2 class="step-title">${safe(step.name)}</h2>${step.detail?`<div class="step-meta">${safe(step.detail)}</div>`:''}`;
if(ss.status==='paused')h+='<div class="alert top-margin">一時中断中です。「練習再開」で入力を続けられます。</div>';
if(ss.status==='ended'||ss.status==='complete')h+='<div class="okbox top-margin">この日の記録は確定済みです。修正する場合は、履歴をJSONでバックアップしてから新しい練習を開始してください。</div>';
h+=`<div class="subsection">${renderStep(step,e,ss.status==='active')}</div><div class="divider"></div><div class="btnrow"><button class="btn line fill" data-action="step-prev" ${ss.stepIndex===0?'disabled':''}>← 前へ</button><button class="btn primary fill" data-action="step-next" ${ss.stepIndex===ss.menu.steps.length-1?'disabled':''}>次へ →</button></div></div>`;
h+=`<div class="card"><div class="sectionbar" style="margin-top:0"><h2>練習の管理</h2></div><div class="btnrow">${ss.status==='active'?`<button class="btn line fill" data-action="pause">一時中断</button><button class="btn line fill" data-action="end">今日はここで終了</button>`:ss.status==='paused'?`<button class="btn primary fill" data-action="resume">▶ 練習再開</button><button class="btn line fill" data-action="end">今日はここで終了</button>`:''}</div><div class="btnrow top-margin">${['active','paused'].includes(ss.status)?`<button class="btn green fill" data-action="complete" ${completed!==ss.menu.steps.length?'disabled':''}>✓ 全メニュー完了</button>`:''}<button class="btn line fill" data-action="save-snapshot">記録をバックアップ</button><button class="btn line fill" data-action="copy-summary">結果をコピー</button></div><p class="note">入力はこの端末のブラウザに自動保存されます。別端末への同期はありません。端末のデータ削除に備え、定期的にバックアップしてください。</p></div>`;
h+='</div>';app.innerHTML=h;
}
function renderStep(s,e,enabled){const disabled=enabled?'':'disabled';let h='';
if(s.type==='check')return `<div class="note">ウォーミングアップ完了後にチェックしてください。</div><label class="row"><span>完了</span><input type="checkbox" data-action="check" ${e.done?'checked':''} ${disabled} style="width:25px;height:25px"></label>`;
if(s.type==='count'||s.type==='sync'){
 const n=e.trials.length; const k=(s.type==='count'?e.trials.filter(x=>x===true):e.trials.filter(x=>x.skill==='ok')).length;
 h+=`<div class="row"><span class="inline-label">目標 ${s.target}回</span><span class="pill ${n>=s.target?'done':''}">${n>=s.target?'達成':'あと'+(s.target-n)+'回'}</span></div><div class="progress"><div style="width:${Math.min(100,n/s.target*100)}%"></div></div><div class="statgrid top-margin"><div class="stat"><b>${n}/${s.target}</b><small>試行</small></div><div class="stat"><b>${k}</b><small>${s.type==='sync'?'技成功':'成功'}</small></div><div class="stat"><b>${ratio(k,n)}</b><small>成功率</small></div></div>`;
 if(s.type==='count')h+=`<div class="bigactions"><button class="btn green" data-action="trial" data-val="ok" ${disabled} ${n>=s.target?'disabled':''}>○ 成功</button><button class="btn red" data-action="trial" data-val="ng" ${disabled} ${n>=s.target?'disabled':''}>× 失敗</button></div>`;
 else {const t=e.trials.filter(x=>x.timing!=='unknown').length,m=e.trials.filter(x=>x.timing==='fit').length;
 h+=`<div class="trial-summary top-margin"><div class="row"><span class="inline-label">無音音ハメ</span><b>${m}/${t}（${ratio(m,t)}）</b></div><div class="mini">判定不能：${e.trials.filter(x=>x.timing==='unknown').length}回（成功率から除外）</div></div><div class="field top-margin"><label>今回の技</label><div class="optionrow">${[['ok','○ 成功'],['ng','× 失敗']].map(([v,l])=>`<label><input type="radio" name="syncskill" value="${v}" ${syncDraft.skill===v?'checked':''} ${disabled}><span>${l}</span></label>`).join('')}</div></div><div class="field"><label>今回の音ハメ</label><div class="optionrow">${[['fit','合った'],['early','早い'],['late','遅い'],['unknown','判定不能']].map(([v,l])=>`<label><input type="radio" name="synctiming" value="${v}" ${syncDraft.timing===v?'checked':''} ${disabled}><span>${l}</span></label>`).join('')}</div></div><button class="btn primary wide" data-action="sync-add" ${disabled} ${n>=s.target||!syncDraft.skill||!syncDraft.timing?'disabled':''}>この1回を記録 ＋</button>`;
 }
 h+=`<div class="row top-margin"><span class="muted">${n?'最近の記録（○ 成功／× 失敗）':'まだ記録がありません'}</span><button class="btn line small" data-action="undo-trial" ${disabled} ${n===0?'disabled':''}>↶ 1回取り消し</button></div>`;
 if(n)h+=`<div class="trial-history">${e.trials.map((v,i)=>{const ok=s.type==='count'?v===true:v.skill==='ok';return `<span class="trial-dot ${ok?'ok':'ng'}" title="${i+1}回目">${i+1} ${ok?'○':'×'}</span>`}).join('')}</div>`;
 return h;
 }
 if(s.type==='rating')return `<div class="inline-label">通し練習の結果</div>${ratingsUI(e.rating,'rating',null,disabled)}<div class="field top-margin"><label>メモ（任意）</label><textarea id="rating-note" ${disabled} placeholder="失敗箇所・気づいたこと">${safe(e.note||'')}</textarea></div>`;
 if(s.type==='full'){
 const x=e.ratings.filter(v=>v==='ng').length,y=e.ratings.filter(v=>v==='mid').length;
 h+=`<div class="statgrid"><div class="stat"><b>${e.ratings.filter(Boolean).length}/${s.skills.length}</b><small>評価済み</small></div><div class="stat"><b>${x}</b><small>× 失敗</small></div><div class="stat"><b>${y}</b><small>△ 不安定</small></div></div><p class="note">演技後に各箇所を○／△／×で記録。未入力は成功に含めません。</p>`;
 let last='';s.skills.forEach((sk,i)=>{if(sk.part!==last){h+=`<div class="group-label">${safe(sk.part||'項目')}</div>`;last=sk.part}h+=`<div class="skillrow"><div class="skillname">${safe(sk.name)}</div>${ratingsUI(e.ratings[i],'full',i,disabled)}</div>`});
 if(s.showTiming)h+=`<div class="subsection"><h3>${safe(s.timingLabel||'無音の音ハメ')}</h3>${optionsUI('timing',e.timing,[['fit','合った'],['early','早い'],['late','遅い'],['unknown','確認できず']],disabled)}</div>`;
 h+=`<div class="subsection"><h3>途中で止まらず完走できた？</h3>${optionsUI('stopped',e.stopped,[['no','完走'],['yes','途中停止']],disabled)}</div>`;
 h+=`<div class="field top-margin"><label>その他のミス（任意）</label><textarea id="other-miss" ${disabled} placeholder="9箇所以外のミス">${safe(e.other||'')}</textarea></div>`;
 return h;
 }
 return '';
}
function ratingsUI(value,act,index,disabled){return `<div class="rating-group">${[['ok','○ 成功',''],['mid','△ 不安定','mid'],['ng','× 失敗','bad']].map(([v,label,cls])=>`<button ${disabled} type="button" data-action="${act==='full'?'set-full':'set-rating'}" ${index!==null?`data-index="${index}"`:''} data-val="${v}" class="${value===v?'selected '+cls:''}">${label}</button>`).join('')}</div>`;}
function optionsUI(act,value,arr,disabled){return `<div class="optionrow">${arr.map(([v,label])=>`<label><input type="radio" name="${act}" value="${v}" ${value===v?'checked':''} ${disabled}><span>${safe(label)}</span></label>`).join('')}</div>`;}
function menuView(){const m=data.menu;let h=`<div class="page"><div class="hero"><div class="eyebrow">CUSTOMIZE YOUR ROUTINE</div><h1>自分だけのメニューを作る</h1><p>名前・順番・目標回数を自由に変更。友人にはメニューだけ共有できます。</p></div><div class="card"><div class="field"><label>メニュー名</label><input data-menu-name value="${safe(m.name)}" maxlength="100"></div><p class="note">変更は次に開始する練習から適用されます。現在進行中の記録には影響しません。</p><div class="btnrow"><button class="btn line fill" data-action="export-menu">メニュー共有用に書き出す</button><button class="btn line fill" data-action="import-menu">メニューを読み込む</button></div></div><div class="sectionbar"><h2>練習項目（${m.steps.length}）</h2><span class="muted">順番も変更できます</span></div>`;
 m.steps.forEach((s,i)=>{let isOpen=editExpanded===s.id;h+=`<div class="edititem"><div class="row row-top"><div style="flex:1"><div class="mini">${safe(s.group||'未分類')} · ${safe(typeLabel(s.type))} ${['count','sync'].includes(s.type)?'· '+s.target+'回':''}</div><h3>${safe(s.name)}</h3></div><button class="btn small line" data-action="edit-toggle" data-id="${s.id}">${isOpen?'閉じる':'編集'}</button></div>`;
 if(isOpen){h+=`<div class="divider"></div><div class="field"><label>分類・パート名</label><input data-edit-key="group" data-edit-id="${s.id}" value="${safe(s.group||'')}"></div><div class="field"><label>練習項目名</label><input data-edit-key="name" data-edit-id="${s.id}" value="${safe(s.name)}"></div><div class="field"><label>記録方式</label><select data-edit-key="type" data-edit-id="${s.id}">${[['count','回数制（成功・失敗）'],['sync','音ハメ（技＋タイミング）'],['full','通し（各技 ○△×）'],['rating','総合評価（○△×）'],['check','完了チェック']].map(([val,label])=>`<option value="${val}" ${s.type===val?'selected':''}>${label}</option>`).join('')}</select></div>`;
 if(['count','sync'].includes(s.type))h+=`<div class="field"><label>目標試行回数</label><input type="number" min="1" max="500" data-edit-key="target" data-edit-id="${s.id}" value="${s.target}"></div>`;
 h+=`<div class="field"><label>説明（任意）</label><input data-edit-key="detail" data-edit-id="${s.id}" value="${safe(s.detail||'')}"></div>`;
 if(s.type==='full')h+=`<div class="field"><label style="display:flex;gap:10px;align-items:center"><input type="checkbox" data-edit-key="showTiming" data-edit-id="${s.id}" ${s.showTiming?'checked':''} style="width:20px;height:20px;min-height:20px">音ハメ評価を使う</label></div>${s.showTiming?`<div class="field"><label>音ハメ項目名</label><input data-edit-key="timingLabel" data-edit-id="${s.id}" value="${safe(s.timingLabel||'無音の音ハメ')}"></div>`:''}<div class="field"><label>評価する技（1行1件：Part名 | 技名）</label><textarea rows="7" data-edit-key="skills" data-edit-id="${s.id}">${safe((s.skills||[]).map(x=>x.part+' | '+x.name).join('\n'))}</textarea></div>`;
 h+=`<div class="btnrow"><button class="btn small line" data-action="move-up" data-index="${i}" ${i===0?'disabled':''}>↑ 上へ</button><button class="btn small line" data-action="move-down" data-index="${i}" ${i===m.steps.length-1?'disabled':''}>↓ 下へ</button><button class="btn small line" data-action="duplicate" data-index="${i}">複製</button><button class="btn small red" data-action="delete-step" data-index="${i}">削除</button></div>`;
 }
 h+='</div>';});
 h+=`<div class="card"><h2 style="font-size:16px;margin-top:0">項目を追加</h2><div class="field"><label>練習名</label><input id="new-name" placeholder="例：新しいコンボ" maxlength="100"></div><div class="field"><label>記録方式</label><select id="new-type"><option value="count">回数制（○×）</option><option value="sync">音ハメ（技＋タイミング）</option><option value="full">通し（各技 ○△×）</option><option value="rating">総合評価（○△×）</option><option value="check">完了チェック</option></select></div><div class="field"><label>目標回数（回数制・音ハメで使用）</label><input id="new-target" type="number" min="1" max="500" value="10"></div><button class="btn primary wide" data-action="add-step">＋ メニューに追加</button></div>`;
 h+=`<div class="card"><button class="btn line wide" data-action="reset-template">元の1Aメニューに戻す</button><p class="note">復元前に確認します。練習履歴は削除されません。</p></div></div>`;app.innerHTML=h;}
function typeLabel(t){return{count:'回数制',sync:'音ハメ',full:'通し',rating:'総合評価',check:'チェック'}[t]||t;}

function sessionDetail(ss){let o='';ss.menu.steps.forEach(s=>{const e=ss.entries[s.id];if(!e)return;let info='未実施';if(s.type==='count'||s.type==='sync'){const n=e.trials.length;const k=s.type==='count'?e.trials.filter(Boolean).length:e.trials.filter(x=>x.skill==='ok').length;info=n?`${k}/${n}成功（${ratio(k,n)}）`:'未実施';if(s.type==='sync'&&n){let t=e.trials.filter(x=>x.timing!=='unknown').length,fit=e.trials.filter(x=>x.timing==='fit').length;info+=` · 音ハメ${fit}/${t}（${ratio(fit,t)}）`;}}else if(s.type==='check')info=e.done?'完了':'未実施';else if(s.type==='rating')info=e.rating?({ok:'○ 成功',mid:'△ 不安定',ng:'× 失敗'}[e.rating]):'未実施';else if(s.type==='full'){const tried=e.ratings.filter(Boolean).length;info=tried?`失敗${e.ratings.filter(x=>x==='ng').length}・不安定${e.ratings.filter(x=>x==='mid').length}（${tried}/${e.ratings.length}評価）`:'未実施'}o+=`<div class="row" style="border-bottom:1px solid #eff1f5;padding:9px 0"><span class="mini" style="flex:1;color:#26364f">${safe(s.name)}</span><span class="mini" style="text-align:right">${safe(info)}</span></div>`;});if(ss.endReason)o+=`<p class="note">終了理由：${safe(ss.endReason)}${ss.endMemo?' / '+safe(ss.endMemo):''}</p>`;return o;}
function summaryText(ss){const lines=[`TrickLog 練習記録｜${ss.date}`,`メニュー：${ss.menu.name}`,`状態：${{active:'練習中',paused:'一時中断',complete:'全メニュー完了',ended:'途中終了'}[ss.status]}`];ss.menu.steps.forEach(s=>{const e=ss.entries[s.id];if(!e)return;let res='未実施';if(s.type==='check')res=e.done?'完了':'未実施';if(s.type==='count'){const n=e.trials.length,k=e.trials.filter(Boolean).length;res=n?`${k}/${n}回成功（${ratio(k,n)}）`:'未実施';}if(s.type==='sync'){const n=e.trials.length,k=e.trials.filter(x=>x.skill==='ok').length,t=e.trials.filter(x=>x.timing!=='unknown').length,fit=e.trials.filter(x=>x.timing==='fit').length;res=n?`技${k}/${n}（${ratio(k,n)}）、音ハメ${fit}/${t}（${ratio(fit,t)}）`:'未実施';}if(s.type==='rating')res=e.rating?{ok:'○',mid:'△',ng:'×'}[e.rating]:'未実施';if(s.type==='full'){const v=e.ratings.filter(Boolean);res=v.length?`×${v.filter(x=>x==='ng').length}・△${v.filter(x=>x==='mid').length}（${v.length}/${e.ratings.length}入力）`:'未実施';res+=e.timing?'、音ハメ：'+{fit:'合った',early:'早い',late:'遅い',unknown:'確認できず'}[e.timing]:'';}lines.push(`・${s.name}：${res}`)});if(ss.endReason)lines.push('終了理由：'+ss.endReason);return lines.join('\n');}
async function copySummary(){const txt=summaryText(data.active);try{await navigator.clipboard.writeText(txt);notify('記録をコピーしました')}catch{let ta=document.createElement('textarea');ta.value=txt;ta.style.position='fixed';document.body.appendChild(ta);ta.select();const ok=document.execCommand('copy');ta.remove();notify(ok?'記録をコピーしました':'コピーができませんでした。バックアップをご利用ください')}}

function historyView(){let h=`<div class="page"><div class="hero"><div class="eyebrow">YOUR PROGRESS</div><h1>履歴とデータ管理</h1><p>記録は端末内で保管。共有するのはメニューだけ、練習結果は自分用に。</p></div>`;
h+=`<div class="card"><h2 style="margin:0 0 10px;font-size:16px">保存・バックアップ</h2><div class="btnrow"><button class="btn primary fill" data-action="export-backup">全データをバックアップ</button><button class="btn line fill" data-action="import-backup">バックアップを復元</button></div><div class="btnrow top-margin"><button class="btn line fill" data-action="export-menu">友人にメニューを共有</button><button class="btn line fill" data-action="import-menu">友人のメニューを読み込む</button></div><p class="note">バックアップには練習履歴も含まれます。友人と共有する際は「メニューを共有」を選択してください。復元はこの端末の現在のデータを上書きします。</p></div>`;
h+=`<div class="card"><h2 style="margin:0 0 12px;font-size:16px">現在の練習</h2><div class="row"><div><strong>${safe(data.active?.date||'—')}</strong><div class="mini">${safe(data.active?.menu?.name||'')}</div></div><span class="pill">${safe(({active:'練習中',paused:'一時中断',ended:'途中終了',complete:'全完了'}[data.active?.status])||'—')}</span></div><div class="btnrow top-margin"><button class="btn primary fill" data-action="new-session">＋ 新しい練習日を開始</button><button class="btn line fill" data-action="save-snapshot">現在の記録を保存</button></div></div>`;
h+=`<div class="sectionbar"><h2>保存済みの練習履歴</h2><span class="muted">${data.history.length}件</span></div>`;
if(!data.history.length)h+='<div class="empty"><span class="glyph">▤</span><strong>まだ履歴がありません</strong>練習を終了するとここに追加されます。</div>';
for(const ss of [...data.history].reverse()){
 const filled=ss.menu.steps.filter(s=>entryDone(s,ss.entries[s.id])).length;
 h+=`<div class="historyentry"><div class="row"><div><h3>${safe(ss.date)}　${safe(ss.menu.name)}</h3><div class="mini">${filled}/${ss.menu.steps.length}項目完了 · ${ss.status==='complete'?'全メニュー完了':'途中終了'}</div></div><div class="btnrow"><button class="btn small line" data-action="history-toggle" data-id="${ss.id}">${historyOpen===ss.id?'閉じる':'詳細'}</button><button class="btn small line" data-action="export-session" data-id="${ss.id}">保存</button></div></div>${historyOpen===ss.id?`<div class="subsection">${sessionDetail(ss)}</div>`:''}</div>`;
}
h+=`<div class="card soft"><strong style="font-size:13px">保存について</strong><p class="note">アカウント登録やサーバー送信はありません。同じURLでも、iPhoneとAndroidの記録は自動同期されません。ブラウザのデータ削除や端末変更に備えて、JSONバックアップを保管してください。</p></div></div>`;app.innerHTML=h;}
function archiveCurrent(){if(!data.active)return;data.history.push(JSON.parse(JSON.stringify(data.active)));data.history=data.history.slice(-400);}
function endSession(kind,reason='',memo=''){const s=data.active;s.status=kind;s.endReason=reason;s.endMemo=memo;s.ended=new Date().toISOString();archiveCurrent();persist();render();notify(kind==='complete'?'全メニュー完了を記録しました':'途中終了の記録を保存しました');}
function validateMenu(obj){if(!obj||!Array.isArray(obj.steps)||obj.steps.length<1||obj.steps.length>150)throw Error('メニューの項目数が不正です');let ids=new Set();obj.steps.forEach(s=>{if(!s.name||typeof s.name!=='string'||s.name.length>120||!['count','sync','full','rating','check'].includes(s.type))throw Error('練習項目の形式が不正です');if(['count','sync'].includes(s.type)&&(!Number.isInteger(s.target)||s.target<1||s.target>500))throw Error('目標回数は1〜500にしてください');if(s.type==='full'&&(!Array.isArray(s.skills)||!s.skills.length||s.skills.length>60||s.skills.some(x=>typeof x.name!=='string'||!x.name.trim())))throw Error('通し練習の技一覧が不正です');if(ids.has(s.id)||!s.id){s.id=id();}ids.add(s.id)});return {name:typeof obj.name==='string'?obj.name.slice(0,100):'共有メニュー',steps:obj.steps.map(s=>({id:s.id,group:String(s.group||'自由練習').slice(0,70),name:s.name.slice(0,120),type:s.type,target:['count','sync'].includes(s.type)?s.target:1,detail:String(s.detail||'').slice(0,400),...(s.type==='full'?{skills:s.skills.map(x=>({part:String(x.part||'項目').slice(0,40),name:x.name.slice(0,160)})),showTiming:Boolean(s.showTiming),timingLabel:String(s.timingLabel||'音ハメ').slice(0,100)}:{})}))};}
async function importFile(kind){const input=document.createElement('input');input.type='file';input.accept='application/json,.json';input.onchange=async()=>{const file=input.files?.[0];if(!file)return;try{if(file.size>4e6)throw Error('ファイルが大きすぎます（4MB以内）');const obj=JSON.parse(await file.text());if(kind==='menu'){const menu=validateMenu(obj.kind==='tricklog-menu'?obj.menu:obj);dialog('メニューを読み込みますか？','今のメニューが置き換わります。進行中の練習には影響しません。','読み込む',()=>{data.menu=menu;persist();editExpanded=null;render();notify('メニューを読み込みました')});}else{if(obj.kind!=='tricklog-backup'||!obj.data||!obj.data.menu||!Array.isArray(obj.data.history))throw Error('バックアップ形式が正しくありません');const menu=validateMenu(obj.data.menu);dialog('全データを復元しますか？','現在の練習・履歴・メニューが置き換わります。戻せないため、必要なら先に現在のデータをバックアップしてください。','上書き復元',()=>{data=obj.data;data.menu=menu;if(!data.active)data.active=newSession(menu);persist();screen='practice';render();notify('バックアップを復元しました')});}}catch(err){notify('読み込み失敗：'+err.message)}};input.click();}
function exportBackup(){download('TrickLog_backup_'+today()+'.json',JSON.stringify({kind:'tricklog-backup',version:1,exported:new Date().toISOString(),data},null,2));notify('全データを書き出しました')}
function exportMenu(){download('TrickLog_menu.json',JSON.stringify({kind:'tricklog-menu',version:1,menu:data.menu},null,2));notify('共有用メニューを書き出しました')}
function exportSnapshot(){if(!data.active)return;download('TrickLog_session_'+data.active.date+'.json',JSON.stringify({kind:'tricklog-session',version:1,session:data.active},null,2));notify('現在の記録を書き出しました')}
function newSessionConfirm(){dialog('新しい練習を始めますか？','今の記録は履歴に保存されます。途中の入力も失敗扱いになりません。新しい練習には編集済みのメニューを使います。','新しく開始',()=>{if(data.active&&!['ended','complete'].includes(data.active.status)){data.active.status='ended';data.active.endReason='新規練習開始';archiveCurrent()}data.active=newSession(data.menu);syncDraft={skill:'',timing:''};persist();screen='practice';render();notify('新しい練習を開始しました')})}
function activeOk(){return data.active?.status==='active'}
app.addEventListener('click',evt=>{const btn=evt.target.closest('[data-action]');if(!btn)return;const a=btn.dataset.action;const ss=data.active;const step=ss?.menu.steps[ss.stepIndex];const e=step?ss.entries[step.id]:null;
if(a==='go-step'){ss.stepIndex=Number(btn.dataset.index);syncDraft={skill:'',timing:''};persist();render();return;}
if(a==='step-prev'||a==='step-next'){ss.stepIndex=Math.max(0,Math.min(ss.menu.steps.length-1,ss.stepIndex+(a==='step-prev'?-1:1)));syncDraft={skill:'',timing:''};persist();render();return;}
if(a==='trial'&&activeOk()&&['count','sync'].includes(step.type)&&e.trials.length<step.target){e.trials.push(btn.dataset.val==='ok');persist();render();return;}
if(a==='sync-add'&&activeOk()&&step.type==='sync'&&e.trials.length<step.target&&syncDraft.skill&&syncDraft.timing){e.trials.push({...syncDraft});syncDraft={skill:'',timing:''};persist();render();return;}
if(a==='undo-trial'&&activeOk()&&e?.trials?.length){e.trials.pop();persist();render();return;}
if(a==='set-full'&&activeOk()){e.ratings[Number(btn.dataset.index)]=btn.dataset.val;persist();render();return;}
if(a==='set-rating'&&activeOk()){e.rating=btn.dataset.val;persist();render();return;}
if(a==='pause'&&activeOk()){ss.status='paused';persist();render();notify('一時中断しました');return;}
if(a==='resume'&&ss.status==='paused'){ss.status='active';persist();render();return;}
if(a==='end'&&['active','paused'].includes(ss.status)){const extra=`<div class="field"><label>終了理由</label><select id="end-reason"><option value="疲労">疲労</option><option value="時間不足">時間不足</option><option value="その他">その他</option><option value="理由なし">理由なし</option></select></div><div class="field"><label>メモ（任意）</label><textarea id="end-memo" placeholder="今日の気づき"></textarea></div>`;dialog('今日はここで終了しますか？','実施した回数だけを保存し、未実施は失敗に含めません。','途中終了して保存',()=>endSession('ended',$('#end-reason').value,$('#end-memo').value),extra);return;}
if(a==='complete'&&['active','paused'].includes(ss.status)&&ss.menu.steps.every(s=>entryDone(s,ss.entries[s.id]))){dialog('全メニュー完了にしますか？','今日のすべての練習項目を履歴に保存します。','完了して保存',()=>endSession('complete'));return;}
if(a==='save-snapshot'){exportSnapshot();return;}
if(a==='copy-summary'){copySummary();return;}
if(a==='history-toggle'){historyOpen=historyOpen===btn.dataset.id?null:btn.dataset.id;render();return;}
if(a==='new-session'){newSessionConfirm();return;}
if(a==='export-backup'){exportBackup();return;}
if(a==='export-menu'){exportMenu();return;}
if(a==='import-menu'||a==='import-backup'){importFile(a==='import-menu'?'menu':'backup');return;}
if(a==='export-session'){const s=data.history.find(x=>x.id===btn.dataset.id);if(s)download('TrickLog_'+s.date+'_'+s.id+'.json',JSON.stringify({kind:'tricklog-session',version:1,session:s},null,2));return;}
if(a==='edit-toggle'){editExpanded=editExpanded===btn.dataset.id?null:btn.dataset.id;render();return;}
if(a==='move-up'||a==='move-down'){const i=Number(btn.dataset.index),j=i+(a==='move-up'?-1:1);if(j>=0&&j<data.menu.steps.length){[data.menu.steps[i],data.menu.steps[j]]=[data.menu.steps[j],data.menu.steps[i]];persist();render()}return;}
if(a==='duplicate'){const i=Number(btn.dataset.index);const copy=JSON.parse(JSON.stringify(data.menu.steps[i]));copy.id=id();copy.name+='（コピー）';data.menu.steps.splice(i+1,0,copy);editExpanded=copy.id;persist();render();return;}
if(a==='delete-step'){const i=Number(btn.dataset.index);if(data.menu.steps.length===1){notify('少なくとも1項目必要です');return;}dialog('項目を削除しますか？',data.menu.steps[i].name+'をメニューから削除します。','削除する',()=>{data.menu.steps.splice(i,1);editExpanded=null;persist();render()});return;}
if(a==='add-step'){const name=$('#new-name').value.trim(),type=$('#new-type').value,target=Number($('#new-target').value);if(!name){notify('練習名を入力してください');return;}if(['count','sync'].includes(type)&&(!Number.isInteger(target)||target<1||target>500)){notify('目標回数は1〜500で指定してください');return;}const s={id:id(),name,group:'自由練習',type,target:['count','sync'].includes(type)?target:1,detail:'',...(type==='full'?{skills:[{part:'Part1',name:'評価する技'}],showTiming:false,timingLabel:'音ハメ'}:{})};data.menu.steps.push(s);editExpanded=s.id;persist();render();notify('練習項目を追加しました');return;}
if(a==='reset-template'){dialog('初期メニューへ戻しますか？','現在の編集済みメニューが初期の1Aメニューに戻ります。練習履歴は残ります。','初期化する',()=>{data.menu=defaultMenu();editExpanded=null;persist();render()});return;}
});
app.addEventListener('change',evt=>{const t=evt.target;const ss=data.active;const step=ss?.menu.steps[ss.stepIndex];const e=step?ss.entries[step.id]:null;
if(t.id==='session-date'&&ss&&ss.status==='active'){ss.date=t.value;persist();return;}
if(t.dataset.action==='check'&&activeOk()){e.done=t.checked;persist();render();return;}
if(t.name==='syncskill'){syncDraft.skill=t.value;render();return;}
if(t.name==='synctiming'){syncDraft.timing=t.value;render();return;}
if(t.name==='timing'&&activeOk()){e.timing=t.value;persist();render();return;}
if(t.name==='stopped'&&activeOk()){e.stopped=t.value;persist();render();return;}
if(t.dataset.editKey==='showTiming'){const item=data.menu.steps.find(s=>s.id===t.dataset.editId);item.showTiming=t.checked;persist();render();return;}
if(t.dataset.editKey==='type'){const item=data.menu.steps.find(s=>s.id===t.dataset.editId);item.type=t.value;if(item.type==='full'&&(!item.skills||!item.skills.length))item.skills=[{part:'Part1',name:'評価する技'}];if(item.type==='full'&&item.showTiming===undefined)item.showTiming=false;persist();render();return;}
if(t.dataset.editKey==='target'){const item=data.menu.steps.find(s=>s.id===t.dataset.editId);const n=Number(t.value);if(Number.isInteger(n)&&n>=1&&n<=500){item.target=n;persist()}else{notify('1〜500の整数を入力してください');t.value=item.target}return;}
});
app.addEventListener('input',evt=>{const t=evt.target,ss=data.active,step=ss?.menu.steps[ss.stepIndex];if(t.dataset.menuName!==undefined){data.menu.name=t.value;persist();return;}
if(t.dataset.editKey&&t.dataset.editKey!=='target'&&t.dataset.editKey!=='type'){const item=data.menu.steps.find(s=>s.id===t.dataset.editId);if(!item)return;if(t.dataset.editKey==='skills'){const rows=t.value.split('\n').filter(x=>x.trim()).slice(0,60).map(line=>{const p=line.split('|');return{part:(p.length>1?p.shift():'項目').trim().slice(0,40),name:p.join('|').trim().slice(0,160)||'名称未入力'}});item.skills=rows;}else item[t.dataset.editKey]=t.value;persist();return;}
if(ss?.status==='active'&&step){const e=ss.entries[step.id];if(t.id==='other-miss'){e.other=t.value;persist()}if(t.id==='rating-note'){e.note=t.value;persist()}}
});
document.querySelectorAll('[data-nav]').forEach(btn=>btn.addEventListener('click',()=>{screen=btn.dataset.nav;render();window.scrollTo({top:0,behavior:'instant'});}));
if('serviceWorker' in navigator&&location.protocol==='https:')navigator.serviceWorker.register('./sw.js').catch(()=>{});
persist();render();
})();
