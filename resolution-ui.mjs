const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pickerKinds=new Set(['ability-search','ability-look-target','ability-look-order','ability-look-place','ability-salvage','entry-stock','ability-pay-card','ability-hand-move','ability-resonate','level']);
export function stageTargetOptions(choice){
 return (choice?.options||[]).filter(o=>!o.disabled&&o.ref&&/^(center|back)-/.test(o.ref.z));
}
export function modifierBreakdown(stats,turn){
 return '<h2>Power '+stats.power.toLocaleString()+' · Soul '+stats.soul+'</h2><ul>'+stats.breakdown.map(e=>{
  const expiry=e.expires==='continuous'?'While conditions are met':e.expires==='attack'?'Until the attack ends':e.expires==='persistent'?'Until manually removed':e.expires==='turn'?'Until end of '+((e.untilTurn??e.turn)===turn?'this turn':'turn '+(e.untilTurn??e.turn)):'';
  return '<li>'+esc(e.label)+' · '+(e.power||0)+' power · '+(e.soul||0)+' soul'+(e.level?' · '+e.level+' level':'')+(expiry?' <small>'+esc(expiry)+'</small>':'')+'</li>';
 }).join('')+'</ul>';
}
export function mountAbilityPicker(parent,api){
 const dialog=document.createElement('dialog');
 dialog.className='ability-zone-picker';
 dialog.setAttribute('aria-label','Choose a card for the current ability');
 parent.append(dialog);
 let displayed;
 return (choice,respond,scope)=>{
  if(!choice||!pickerKinds.has(choice.kind)){
   if(dialog.open)dialog.close();
   displayed=null;
   return;
  }
  const key=scope+'|'+choice.id;
  if(key===displayed)return;
  displayed=key;
  dialog.innerHTML='<h2>'+esc(choice.title)+'</h2><div class="ability-picker-grid">'+choice.options.filter(o=>o.card).map((o,i)=>
   '<button type="button" data-picker-card="'+i+'" '+(o.disabled?'disabled':'')+'>'+api.image(o.card)+'<span>'+esc(o.label)+'</span></button>').join('')+'</div><div class="toolbar">'+
   choice.options.filter(o=>!o.card).map((o,i)=>'<button type="button" data-picker-other="'+i+'">'+esc(o.label)+'</button>').join('')+
   '<button type="button" data-picker-board>Review board</button></div><p data-picker-status role="status"></p>';
  for(const [selector,options] of [['data-picker-card',choice.options.filter(o=>o.card)],['data-picker-other',choice.options.filter(o=>!o.card)]]){
   dialog.querySelectorAll('['+selector+']').forEach(button=>button.onclick=async()=>{
    const status=dialog.querySelector('[data-picker-status]');
    button.disabled=true;
    status.textContent='Resolving…';
    status.classList.remove('bad');
    const accepted=await respond(options[+button.getAttribute(selector)].value,message=>{status.textContent=message;status.classList.add('bad');});
    if(accepted!==false&&status.isConnected&&dialog.open)dialog.close();
    else if(button.isConnected)button.disabled=false;
   });
  }
  dialog.querySelector('[data-picker-board]').onclick=()=>dialog.close();
  if(!dialog.open)dialog.showModal();
 };
}
export function mountResolution(api){
 const picker=mountAbilityPicker(document.body,api);
 const table=$('#table');
 table.addEventListener('click',event=>{
  const s=api.state(),choice=s?.auto?.choice,zone=event.target.closest('[data-stage]');
  if(!zone||event.target.closest('[data-inspect],[data-soul],[data-pile]')||s?.practiceBot&&choice?.p===1)return;
  const selected=stageTargetOptions(choice).find(o=>zone.dataset.stage===o.ref.p+'|'+o.ref.z);
  if(!selected)return;
  event.stopPropagation();
  api.commit('Choose '+selected.label,()=>api.resolver.respond(s,choice.id,selected.value));
 },true);
 const panel=document.createElement('section');panel.id='resolution-panel';panel.className='resolution-panel';panel.setAttribute('aria-label','Guided game resolution');$('.match-layout').before(panel);
 const refit=()=>window.dispatchEvent(new window.Event('resize'));panel.addEventListener('toggle',refit,true);if(window.ResizeObserver){const observer=new window.ResizeObserver(refit);[panel,document.querySelector('#practice>.heading'),document.querySelector('.table-toolbar')].filter(Boolean).forEach(e=>observer.observe(e));}
 const revealPanel=document.createElement('section');revealPanel.id='check-reveal-flash';revealPanel.setAttribute('role','status');revealPanel.setAttribute('aria-live','polite');revealPanel.hidden=true;document.body.append(revealPanel);
 let flashState=null,flashId=null,revealTimer=null,loadTimer=null;
 function clearFlash(){window.clearTimeout(revealTimer);window.clearTimeout(loadTimer);revealTimer=null;loadTimer=null;flashState=null;flashId=null;revealPanel.hidden=true;}
 function renderFlash(s){const a=api.resolver.auto(s),r=a.reveal;if(!r||a.gameOver){clearFlash();return;}if(flashState===s&&flashId===r.id)return;clearFlash();flashState=s;flashId=r.id;
  revealPanel.innerHTML='<p class="check-reveal-label">PLAYER '+(r.p+1)+' · '+(r.kind==='trigger'?'TRIGGER CHECK':r.kind==='ability'?'ABILITY REVEAL':'DAMAGE CHECK')+'</p><div class="check-reveal-art">'+api.image(r.card).replace('loading="lazy"','loading="eager" fetchpriority="high"')+'</div><strong>'+esc(api.name(r.card))+'</strong><p>'+esc(r.label)+'</p>';revealPanel.dataset.kind=r.kind;revealPanel.classList.toggle('is-canceled',/CANCELED/.test(r.label));revealPanel.hidden=false;
  function finish(){if(api.state()!==s||s.auto?.reveal?.id!==r.id){clearFlash();return;}if(s.auto.paused||document.querySelector('#dialog')?.open||document.body.dataset.view!=='practice'){revealTimer=window.setTimeout(finish,100);return;}api.commit(r.kind==='trigger'?'Trigger check revealed':r.kind==='ability'?'Ability card revealed':'Damage check revealed',()=>api.resolver.finishReveal(s,r.id));}
  let started=false;function ready(){if(started)return;started=true;window.clearTimeout(loadTimer);revealTimer=window.setTimeout(finish,api.revealMs??700);}const img=revealPanel.querySelector('img');if(!img||img.complete)ready();else{img.addEventListener('load',ready,{once:true});img.addEventListener('error',ready,{once:true});loadTimer=window.setTimeout(ready,api.revealLoadMs??1800);}
 }
 function render(){const s=api.state();if(!s){clearFlash();picker(null);return;}if(api.ready&&!api.ready()){panel.innerHTML='<p>Loading match cards…</p>';return;}const a=api.resolver.auto(s),c=a.choice,attack=a.attack,stats=attack?api.resolver.stats(s,attack.ref):null;
  picker(document.body.dataset.view==='practice'&&(!s.practiceBot||c?.p!==1)?c:null,(value,onError)=>api.commit('Resolve card choice',()=>api.resolver.respond(s,c.id,value),onError),s.deckNames?.join('|')||'practice');
  const targets=!s.practiceBot||c?.p!==1?stageTargetOptions(c):[];
  table.querySelectorAll('[data-stage]').forEach(zone=>zone.classList.toggle('eligible-ability-target',targets.some(o=>zone.dataset.stage===o.ref.p+'|'+o.ref.z)));
  panel.innerHTML='<div class="resolution-header"><b>✦ '+esc(a.gameOver?'Game ended':c?.title||a.reveal?.label||(s.phase===5?s.step:['Stand','Draw','Clock','Main','Climax','Attack','End'][s.phase]+' phase')||'Core game procedures')+'</b><label><input id="auto-enabled" type="checkbox" '+(a.enabled?'checked':'')+'> Guided resolution</label><button id="core-rules">Check core rules</button><button id="pause-resolution">'+(a.paused?'Resume':'Pause')+'</button><button id="effect-tools">Effects & corrections</button><a class="support-link" href="automation-support.html" target="_blank" rel="noopener">Ability support ↗</a></div>'+(a.gameOver?'<p class="bad">Player '+a.gameOver.players.map(p=>p+1).join(' & ')+' loses · '+esc(a.gameOver.reason)+'</p>':'')+(stats?'<div class="attack-soul"><b>'+esc(attack.type.toUpperCase())+' · Soul '+stats.soul+'</b><button id="soul-breakdown">Soul & power breakdown'+(stats.unsupported.length?' · review abilities':'')+'</button></div>':'')+(c?(s.practiceBot&&c.p===1&&['ability-look-target','ability-look-order','ability-look-place','ability-search','ability-pay-card','ability-hand-move','ability-resonate','discard','act-target'].includes(c.kind)?'<p>Practice bot is choosing a card.</p>':choiceHTML(c)):'<p class="resolution-idle">'+(a.enabled?'Routine checks resolve automatically. Only available responses and card choices pause play.':'Manual mode. Existing controls remain available; turn guided resolution on to automate core procedures.')+'</p>')+(a.results[0]?'<details><summary>Last damage: '+esc(a.results[0].label)+' · '+(a.results[0].canceled?'canceled':a.results[0].n+' to clock')+'</summary><p>Revealed '+a.results[0].uids.length+' card(s). This outcome applies only to that damage instance.</p></details>':'');
  if(a.notice&&(!s.practiceBot||a.notice.p!==1))panel.insertAdjacentHTML('beforeend','<p class="ability-prompt-text" role="status">'+esc(a.notice.message)+'</p>');
  panel.insertAdjacentHTML('beforeend','<details><summary>Action log</summary><div class="resolution-log">'+s.log.filter(t=>!t.includes('Resolution choice: Pending abilities resolved / none pending')).slice(0,20).map(t=>'<p>'+esc(t)+'</p>').join('')+'</div></details>');
  if(a.reviews.length)panel.insertAdjacentHTML('beforeend','<details class="manual-review"><summary>Other card text remains manual · '+a.reviews.length+' item(s)</summary><p>These effects are not automated. Pause to apply any applicable modifiers or other effects with the manual tools.</p>'+a.reviews.map(t=>'<p><b>'+esc(t.code)+'</b> '+esc(t.text)+'</p>').join('')+'</details>');
  $('#pause-resolution').onclick=()=>api.commit(a.paused?'Resumed automatic resolution':'Paused automatic resolution',()=>{a.paused=!a.paused;if(!a.paused)api.resolver.run(s);});
  $('#auto-enabled').onchange=e=>api.commit('Changed guided resolution',()=>{if(a.choice||a.reveal||a.attack||a.queue.length)throw Error('Finish the pending resolution or use the explicit abort override.');a.enabled=e.target.checked;});
  $('#core-rules').onclick=()=>api.commit('Check core procedures',()=>api.resolver.run(s));$('#effect-tools').onclick=effectsDialog;
  if($('#soul-breakdown'))$('#soul-breakdown').onclick=()=>breakdown(attack.ref);
  if(c)panel.insertAdjacentHTML('beforeend','<p id="practice-choice-status" role="status"></p>');
  panel.querySelectorAll('[data-response]').forEach(b=>b.onclick=()=>{const extras={};if($('#battle-atk')){extras.attacker=+$('#battle-atk').value;extras.defender=+$('#battle-def').value;}api.commit('Resolution choice: '+b.textContent,()=>api.resolver.respond(s,c.id,b.dataset.response,extras),message=>{const status=$('#practice-choice-status');status.textContent=message;status.classList.add('bad');});});
  panel.querySelectorAll('[data-choice-inspect]').forEach(b=>b.onclick=()=>api.inspect(b.dataset.choiceInspect));
  for(const id of ['next-phase-middle','advance','previous-phase'])if($('#'+id))$('#'+id).disabled=!!(a.choice||a.reveal||a.paused||a.attack||a.queue.length||a.gameOver);
  document.querySelectorAll('.auto-soul').forEach(b=>b.onclick=e=>{e.stopPropagation();const [p,z,uid]=b.dataset.soul.split('|');breakdown({p:+p,z,uid});});
  const next=$('#next-phase-middle');if(next){next.innerHTML=s.phase===5?'End attacks →':s.phase===6?'End turn →':'Continue to '+({0:'Clock',1:'Clock',2:'Main',3:'Climax',4:'Attack'}[s.phase]||'next phase')+' →';}
  for(const id of ['quick-draw','quick-step','quick-damage'])if($('#'+id))$('#'+id).disabled=!!(a.reveal||a.attack||a.choice||a.gameOver);
  document.dispatchEvent(new window.Event('arena-choice-changed'));renderFlash(s);window.dispatchEvent(new window.Event('resize'));
 }
 function choiceHTML(c){return (c.abilityText?'<p class="ability-prompt-text">'+esc(c.abilityText)+'</p>':'')+(c.kind==='checkpoint'?'<p class="timing-note">Check timing · resolve pending AUTO abilities in turn-player order. This is not a timing to play an arbitrary event or ACT ability. Confirm only after required abilities are resolved.</p>':'')+(c.kind==='counter'?'<p class="timing-note">Defender only: one counter-icon event or activated ability. Backup checks level and stock; events additionally check color. Printed restrictions and unsupported costs must be verified manually.</p>':'')+(c.kind==='level-order'?'<p>Choose the next card for waiting room, first → last. The group of six remains reserved until its order is complete.</p>':'')+(c.unsupported?.length?'<details class="unsupported"><summary>'+c.unsupported.length+' card text(s) require manual review</summary>'+c.unsupported.map(x=>'<p><b>'+esc(x.code||'Manual effect')+'</b> '+esc(x.text)+'</p>').join('')+'</details>':'')+(c.cards&&c.kind==='damage-view'?'<div class="resolution-reveals">'+c.cards.map(id=>api.image(id)).join('')+'</div>':'')+(c.kind==='battle'?'<div class="battle-inputs"><label>Attacker current power<input id="battle-atk" type="number" value="'+c.attacker.power+'"></label><label>Defender current power<input id="battle-def" type="number" value="'+c.defender.power+'"></label><span>Confirm power after manual effects. Unsupported abilities are not included automatically.</span></div>':'')+'<div class="resolution-choices">'+c.options.map(o=>'<div><button data-response="'+esc(o.value)+'" '+(o.disabled?'disabled':'')+'>'+(o.card&&['ability-look-target','ability-salvage','ability-search','ability-pay-card','ability-resonate'].includes(c.kind)?api.image(o.card):'')+esc(o.label)+'</button>'+(o.card?'<button class="choice-inspect" data-choice-inspect="'+esc(o.card)+'" aria-label="Inspect choice card">⤢</button>':'')+'</div>').join('')+'</div>';
 }
 function breakdown(r){const stats=api.resolver.stats(api.state(),r);api.dialog('<p class="eyebrow">CURRENT CHARACTER VALUES</p>'+modifierBreakdown(stats,api.state().turn)+(stats.unsupported.length?'<h3>Manual review required</h3>'+stats.unsupported.map(x=>'<p><b>'+esc(x.code)+'</b> '+esc(x.text)+'</p>').join(''):'<p>No unrecognized text on this player’s current stage or climax area.</p>')+'<p>Use Effects & corrections to record unsupported modifiers. Text on cards in other zones may also require manual handling.</p>');}
 function effectsDialog(){const s=api.state(),refs=[0,1].flatMap(p=>api.resolver.allStage(s,p));api.dialog('<h2>Effects & manual corrections</h2><p>Record only the modifier described by the card. Other text and conditions remain manual. A turn-duration modifier expires during end-phase cleanup; a persistent modifier must be removed manually.</p><label>Character<select id="effect-target">'+refs.map(r=>'<option value="'+r.p+'|'+r.z+'|'+r.uid+'">P'+(r.p+1)+' · '+esc(api.name(api.resolver.inst(s,r).id))+'</option>').join('')+'</select></label><div class="two"><label>Soul adjustment<input id="effect-soul" type="number" value="0"></label><label>Power adjustment<input id="effect-power" type="number" value="0"></label></div><label>Level adjustment<input id="effect-level" type="number" value="0"></label><label>Source / condition<input id="effect-label" value="Manual card effect"></label><label>Duration<select id="effect-duration"><option value="turn">Until end of this turn</option><option value="persistent">Until removed manually</option></select></label><button id="apply-effect">Apply modifier</button><label><input id="auto-optional-triggers" type="checkbox" '+(api.resolver.auto(s).optionalTop!=='ask'?'checked':'')+'> Automatically take optional Draw / Pool / Treasure top-card effects</label><h3>Additional damage instance</h3><label>Receiving player<select id="effect-player"><option value="0">Player 1</option><option value="1">Player 2</option></select></label><label>Damage<input id="effect-damage" type="number" min="1" max="50" value="1"></label><p>Finish pending choices first. Damage source is the chosen character, including Shot tracking.</p><button id="deal-effect">Resolve separate damage</button><h3>Active recorded modifiers</h3>'+api.resolver.auto(s).effects.map((e,i)=>'<p>'+esc(e.label)+' · '+(e.soul||0)+' soul / '+(e.power||0)+' power <button data-clear-effect="'+i+'">Remove</button></p>').join('')+'<details><summary>Resolution overrides</summary><p>Undo is preferred. Abort retains moved cards but clears the unfinished sequence; use manual tools to correct zones, then check core rules.</p><button id="abort-resolution">Abort pending sequence (manual correction)</button><label><input id="cost-suspension" type="checkbox" '+(s.cost?'checked':'')+'> Paying a complete multi-part cost: defer refresh and level-up</label></details>');
  const ref=()=>{const [p,z,uid]=$('#effect-target').value.split('|');return {p:+p,z,uid};};
  $('#auto-optional-triggers').onchange=e=>api.commit('Optional trigger preference',()=>api.resolver.auto(s).optionalTop=e.target.checked?'take':'ask');
  $('#apply-effect').onclick=()=>{const r=ref(),vals={soul:+$('#effect-soul').value,power:+$('#effect-power').value,level:+$('#effect-level').value},label=$('#effect-label').value,duration=$('#effect-duration').value;api.commit('Recorded manual modifier',()=>api.resolver.manualEffect(s,r,vals,label,duration));effectsDialog();};
  $('#deal-effect').onclick=()=>{const p=+$('#effect-player').value,n=+$('#effect-damage').value,source=ref().uid;if(!Number.isInteger(n)||n<1||n>50)return;api.commit('Separate damage instance',()=>api.resolver.damage(s,p,n,source));$('#dialog').close();};
  document.querySelectorAll('[data-clear-effect]').forEach(b=>b.onclick=()=>{api.commit('Removed manual modifier',()=>api.resolver.auto(s).effects.splice(+b.dataset.clearEffect,1));effectsDialog();});
  $('#abort-resolution').onclick=()=>{api.commit('Aborted guided sequence for manual correction',()=>{const a=api.resolver.auto(s);a.choice=null;a.queue=[];a.attack=null;a.damage=null;a.trigger=null;a.reveal=null;a.paused=false;a.gameOver=null;s.step='Attack declaration';});$('#dialog').close();};
  $('#cost-suspension').onchange=e=>api.commit('Cost payment '+(e.target.checked?'started':'ended'),()=>s.cost=e.target.checked);
 }
 return {render,breakdown,viewChanged:v=>{if(v!=='practice')clearFlash();}};
}
