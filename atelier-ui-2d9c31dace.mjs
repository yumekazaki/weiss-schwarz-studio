import {cardContext,stagePositions} from './context-actions-81164c8412.mjs';

const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phaseNames=['Stand','Draw','Clock','Main','Climax','Attack','End'];
const labels={'center-left':'Center left','center-middle':'Center middle','center-right':'Center right','back-left':'Back left','back-right':'Back right'};

export function mountAtelier(api){
 let menuRef=null,previewId=null,multi=false,hoverTimer=null,focusMode=false,libraryParent=null,lastMenuRect=null;
 const collection=$('#library .collection'),filters=$('#library .filters'),workspace=$('#library .workspace');
 const librarySlot=document.createElement('aside');librarySlot.className='builder-library panel';librarySlot.innerHTML='<div class="browser-heading"><p class="eyebrow">CARD LIBRARY</p><h2>Find your next ace.</h2><p>Click artwork or + to add. Use ⤢ to inspect.</p></div><details class="builder-filters"><summary>Search filters</summary></details><div class="library-content-slot"></div>';
 $('#decks .deck-layout').append(librarySlot);
 const editor=$('#decks .editor'),editorTools=document.createElement('div');editorTools.className='editor-sticky';
 [...editor.children].slice(0,2).forEach(n=>editorTools.append(n));editor.prepend(editorTools);editorTools.append($('#validation'));
 $('#decks .deck-layout>aside').classList.add('saved-deck-rail');

 const preview=document.createElement('section');preview.id='hover-inspector';preview.className='hover-inspector';preview.hidden=true;preview.setAttribute('aria-label','Enlarged card preview and English text');
 document.body.append(preview);
 const menu=document.createElement('section');menu.id='card-action-menu';menu.className='card-action-menu';menu.hidden=true;menu.setAttribute('aria-label','Card actions');menu.setAttribute('role','dialog');document.body.append(menu);

 // Keep every existing manual operation, but gather them behind a single named secondary control.
 const manual=document.createElement('details');manual.id='manual-tools';manual.className='manual-tools panel';manual.innerHTML='<summary><span>⚙ Manual tools & overrides</span><small>Movement, costs, orientation, damage, effects and corrections</small></summary><div class="manual-tools-body"></div>';
 const controls=$('#practice .controls'),selection=$('#practice .selection-panel');manual.querySelector('.manual-tools-body').append(controls,selection);
 $('#match-content').append(manual);
 const tools=document.createElement('div');tools.className='table-toolbar';tools.innerHTML='<div class="table-player-control"><label>Controlling <select id="table-player"><option value="0">Player 1</option><option value="1">Player 2</option></select></label><label class="multi-choice"><input type="checkbox" id="multi-select"> Multi-select</label></div><div class="quick-actions"><button id="quick-draw">Draw 1</button><button id="quick-step">Attack steps</button><button id="quick-damage">Damage…</button><button id="quick-piles">Inspect / search…</button><button id="selected-actions">Selected actions</button><button id="open-manual-tools">Manual tools</button></div>';
 $('#match-content').prepend(tools);
 const ruleNote=document.createElement('p');ruleNote.className='table-hint';ruleNote.textContent='Hover or focus a face-up card to read it. Click for actions · ⤢ pins its details · Shift-click selects several.';tools.after(ruleNote);

 function setArtwork(key){
  const info={decks:['Fate','FS/S36-E002'],practice:['Sword Art Online','SAO/S20-E077'],host:["Miss Kobayashi’s Dragon Maid",'KMD/W96-E003'],join:['RWBY','RWBY/WX03-044']}[key];
  all('[data-backdrop]').forEach(e=>e.classList.toggle('is-active',e.dataset.backdrop===key));all('[data-feature]').forEach(e=>e.classList.toggle('is-active',e.dataset.feature===key));all('[data-menu-option]').forEach(e=>e.classList.toggle('is-featured',e.dataset.menuOption===key));$('#featured-series').textContent=info[0];$('#featured-card-code').textContent=info[1];$('#home').dataset.artwork=key;
 }
 all('[data-menu-option]').forEach(button=>{const key=button.dataset.menuOption;button.addEventListener('pointerenter',()=>setArtwork(key));button.addEventListener('focus',()=>setArtwork(key));button.addEventListener('pointerdown',()=>setArtwork(key));button.onclick=()=>{setArtwork(key);if(key==='decks'||key==='practice')api.view(key);else api.toast('Multiplayer is coming soon. Deck Builder and Practice are ready to use.');};});

 function onView(v){
  document.body.dataset.view=v;closeMenu();hidePreview();
  if(v==='decks'&&libraryParent!=='decks'){librarySlot.querySelector('.builder-filters').append(filters);librarySlot.querySelector('.library-content-slot').append(collection);libraryParent='decks';}
  else if(v==='library'&&libraryParent!=='library'){workspace.prepend(filters);filters.after(collection);libraryParent='library';}
 }
 function revealManual(){manual.open=true;manual.scrollIntoView?.({behavior:reducedMotion()?'auto':'smooth',block:'nearest'});}
 function reducedMotion(){return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
 $('#open-manual-tools').onclick=revealManual;
 $('#table-player').onchange=e=>{api.setPlayer(+e.target.value);hidePreview();};$('#multi-select').onchange=e=>{multi=e.target.checked;closeMenu();};
 $('#quick-draw').onclick=()=>{api.setAmount(1);api.action('draw');};
 $('#quick-damage').onclick=e=>{const s=api.state(),p=s.player,d=s.match?.damage[p];showSimpleMenu(e.currentTarget,'Damage · Player '+(p+1),d?[{label:'Reveal next damage card',run:()=>api.action('damage-reveal')},{label:'Resolve damage / cancellation',run:()=>api.action('damage-finish')}]:[1,2,3,4,5].map(n=>({label:'Take '+n+' damage',run:()=>{api.setAmount(n);api.action('damage');}})).concat([{label:'Other amount / manual resolution…',run:revealManual}]));};
 $('#quick-step').onclick=e=>{showSimpleMenu(e.currentTarget,'Attack step',['Attack declaration','Trigger','Counter','Damage','Battle','Encore'].map(step=>({label:step,run:()=>api.setStep(step)})).concat([{label:'Reveal trigger',run:()=>api.action('trigger')},{label:'Trigger → stock',run:()=>api.action('stock')},{label:'End / encore cleanup',run:()=>api.action('encore')}]));};
 $('#quick-piles').onclick=e=>showSimpleMenu(e.currentTarget,'Inspect / search · Player '+(api.state().player+1),['deck','hand','waiting','stock','clock','level','memory','climax','resolution'].map(z=>({label:api.zoneName(z),run:()=>api.openPile(api.state().player,z)})));
 $('#selected-actions').onclick=e=>{const selected=api.state().selected;if(!selected.length)return api.toast('Select a card first, or enable multi-select to choose several.');if(selected.length===1)return openCardMenu(selected[0],e.currentTarget);showSimpleMenu(e.currentTarget,selected.length+' selected cards',[{label:'Move selected cards…',run:revealManual},{label:'Mulligan selected hand cards',run:()=>api.action('mulligan')},{label:'Reveal / hide selected',run:()=>api.action('reveal')},{label:'Rest selected',run:()=>api.action('rest')},{label:'Stand selected',run:()=>api.action('stand-selected')},{label:'Clear selection',run:()=>api.select([])}]);};

 const fsButton=$('#fullscreen-toggle');
 function updateFullscreen(){const active=!!document.fullscreenElement||focusMode;document.body.classList.toggle('table-focus',active);fsButton.setAttribute('aria-pressed',String(active));fsButton.textContent=active?(focusMode?'⤡ Exit focus view':'⤡ Exit fullscreen'):'⛶ Fullscreen';}
 fsButton.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(focusMode){focusMode=false;}else if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();}else{focusMode=true;api.toast('Fullscreen is unavailable here. Focus view is on.');}}catch{focusMode=true;api.toast('This browser blocks fullscreen. Focus view is on instead.');}updateFullscreen();};
 document.addEventListener('fullscreenchange',updateFullscreen);

 function phaseBanner(){const s=api.state(),m=s.match;if(!m)return '';return '<section class="phase-banner" aria-label="Current phase and turn"><div class="phase-identity"><span class="active-player-dot"></span><div><small>PLAYER '+(m.active+1)+' · TURN '+m.turn+'</small><strong id="mid-phase">'+phaseNames[m.phase]+' <em>phase</em></strong>'+(m.phase===5?'<span class="attack-step-name">'+esc(m.step)+'</span>':'')+'</div></div><div class="phase-dots" aria-hidden="true">'+phaseNames.map((p,i)=>'<i class="'+(i===m.phase?'current':'')+'" title="'+p+'"></i>').join('')+'</div><div class="phase-actions"><button id="previous-phase" aria-label="Previous phase" title="Correct an accidental phase advance">↶</button><button id="next-phase-middle" class="primary">Next Phase <span>→</span></button></div></section>';}
 function matchUpdated(){
  const s=api.state();$('#table-player').value=String(s.player);$('#multi-select').checked=multi;if(!s.match)return;
  const halves=all('#table .player-mat');if(halves.length===2){halves[0].insertAdjacentHTML('afterend',phaseBanner());$('#previous-phase').onclick=()=>api.previousPhase();$('#next-phase-middle').onclick=()=>api.advancePhase();}
  if(s.selected.length)$('#selected-actions').textContent=s.selected.length+' selected · actions';else $('#selected-actions').textContent='Selected actions';
 }

 function cardPayload(target){if(preview.contains(target)||menu.contains(target))return null;const element=target.closest('[data-hover-card],[data-ref]');if(!element)return null;if(element.dataset.ref){const r=parseRef(element.dataset.ref);if(!api.readable(r))return null;return {id:api.instance(r)?.id,anchor:element};}return {id:element.dataset.hoverCard,anchor:element};}
 function parseRef(text){const [p,z,uid]=text.split('|');return {p:+p,z,uid};}
 function positionPanel(element,anchor){
  const rect=anchor.getBoundingClientRect(),width=Math.min(680,window.innerWidth-24),height=Math.min(485,window.innerHeight-32);let left=rect.right+18;if(left+width>window.innerWidth-12)left=rect.left-width-18;if(left<12)left=Math.max(12,(window.innerWidth-width)/2);const top=Math.max(12,Math.min(rect.top-45,window.innerHeight-height-12));Object.assign(element.style,{left:left+'px',top:top+'px',width:width+'px',maxHeight:height+'px'});
 }
 function showPreview(id,anchor){if(!id||!api.card(id))return;const parent=$('#dialog').open?$('#dialog'):document.body;if(preview.parentElement!==parent)parent.append(preview);if(previewId!==id){preview.innerHTML='<div class="hover-inspector-bar"><span>READABLE CARD PREVIEW</span><div><button id="pin-hover-card" title="Keep a larger view open">⤢ Pin</button><button id="close-hover-card" aria-label="Close hover preview">×</button></div></div><div class="hover-inspector-body"><div class="hover-image">'+api.image(id)+'</div><div class="hover-text" tabindex="0" aria-label="Scrollable English card text">'+api.details(id)+'</div></div>';$('#pin-hover-card').onclick=()=>{hidePreview();api.inspect(id);};$('#close-hover-card').onclick=hidePreview;previewId=id;}positionPanel(preview,anchor);preview.hidden=false;}
 function hidePreview(){clearTimeout(hoverTimer);preview.hidden=true;previewId=null;}
 document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const payload=cardPayload(e.target);if(!payload)return;if(e.relatedTarget&&payload.anchor.contains(e.relatedTarget))return;clearTimeout(hoverTimer);hoverTimer=setTimeout(()=>showPreview(payload.id,payload.anchor),160);});
 document.addEventListener('focusin',e=>{const payload=cardPayload(e.target);if(payload)showPreview(payload.id,payload.anchor);});
 // No pointer-leave dismissal: the preview remains available while entering and scrolling its text.

 function closeMenu(){menu.hidden=true;menuRef=null;}
 function positionMenu(anchor){const rect=anchor===menu&&lastMenuRect?lastMenuRect:anchor.getBoundingClientRect(),width=Math.min(310,window.innerWidth-24);lastMenuRect=rect;Object.assign(menu.style,{width:width+'px',left:Math.max(12,Math.min(rect.left,window.innerWidth-width-12))+'px',top:Math.max(12,Math.min(rect.bottom+8,window.innerHeight-Math.min(menu.scrollHeight,600)-12))+'px',maxHeight:'min(600px, calc(100dvh - 24px))'});}
 function showSimpleMenu(anchor,title,choices){hidePreview();const parent=$('#dialog').open?$('#dialog'):document.body;parent.append(menu);menu.innerHTML='<div class="context-heading"><b>'+esc(title)+'</b><button class="context-close" aria-label="Close action menu">×</button></div><div class="context-options">'+choices.map((c,i)=>'<button data-menu-choice="'+i+'" '+(c.disabled?'disabled':'')+'><span>'+esc(c.label)+'</span>'+(c.hint?'<small>'+esc(c.hint)+'</small>':'')+'</button>').join('')+'</div>';menu.hidden=false;positionMenu(anchor);menu.querySelector('.context-close').onclick=closeMenu;all('#card-action-menu [data-menu-choice]').forEach(b=>b.onclick=()=>{const c=choices[+b.dataset.menuChoice];closeMenu();c.run?.();});menu.querySelector('[data-menu-choice]:not([disabled])')?.focus({preventScroll:true});}
 function moveTo(ref,to,orientation){api.move([ref],ref.p,to,'top',orientation);}
 function stageChoice(ref,rested=false,swap=false){const anchor=menu;showSimpleMenu(anchor,swap?'Move / swap position':'Choose stage position',stagePositions.map(z=>({label:labels[z]+(api.state().match.players[ref.p].zones[z].length?' · occupied':''),run:()=>{if(swap)api.swapStage(ref,z);else api.placeStage(ref,z,rested);}})));}
 function runContext(key,ref){
  if(key==='play-stage')return stageChoice(ref);
  if(key==='swap-stage')return stageChoice(ref,false,true);
  if(key==='return-stage-rested')return stageChoice(ref,true);
  if(key==='event'||key==='counter')return moveTo(ref,'resolution');
  if(key==='backup')return showSimpleMenu(menu,'Backup cost · resolve its text manually',[{label:'Discard this card → waiting room',hint:'Pay any printed stock cost separately. No power or effects are applied automatically.',run:()=>moveTo(ref,'waiting')},{label:'Pay stock / other printed costs…',run:revealManual}]);
  if(key==='counter-ability')return revealManual();
  if(key==='climax')return moveTo(ref,'climax');
  if(key==='discard')return moveTo(ref,'waiting');
  if(key==='return-hand')return moveTo(ref,'hand');
  if(key==='deck-top'||key==='deck-bottom')return api.move([ref],ref.p,'deck',key==='deck-top'?'top':'bottom');
  if(key.startsWith('attack-'))return api.declareAttack(ref,key.slice(7));
  api.setAmount(1);api.action(key);
 }
 function openCardMenu(ref,anchor){
  const s=api.state(),instance=api.instance(ref);if(!instance)return;const readable=api.readable(ref),card=readable?api.card(instance.id):null,choices=cardContext({match:s.match,ref,card,englishAbility:card?api.englishAbility(card.id):''}).map(c=>({...c,run:()=>runContext(c.key,ref)}));
  choices.push({label:'Inspect / search this zone',run:()=>api.openPile(ref.p,ref.z)});
  if(readable)choices.unshift({label:'⤢ Pin card details',run:()=>api.inspect(instance.id)});
  choices.push({label:multi?'Leave multi-select':'Add more cards to selection',run:()=>{multi=!multi;$('#multi-select').checked=multi;api.toast(multi?'Multi-select on. Choose cards in the order you want.':'Multi-select off.');}});
  const manualChoices=[{label:'Move to any zone / player…',run:revealManual},...['stand-selected','rest','reverse','flip','reveal','note'].map(key=>({label:({'stand-selected':'Stand','rest':'Rest','reverse':'Reverse','flip':'Flip face','reveal':'Reveal / hide','note':'Power / soul note'})[key],run:()=>api.action(key)})),{label:'Attack declaration override…',run:()=>showSimpleMenu(menu,'Attack override',['direct','frontal','side'].map(type=>({label:type[0].toUpperCase()+type.slice(1)+' attack (manual override)',run:()=>api.declareAttack(ref,type,true)})))},{label:'All costs, damage and effect tools…',run:revealManual}];
  choices.push({label:'Manual overrides…',hint:'Unusual effects, movement, costs and corrections',run:()=>showSimpleMenu(menu,'Manual card overrides',manualChoices)});
  showSimpleMenu(anchor,(readable?api.name(instance.id):'Hidden card')+' · P'+(ref.p+1)+' '+api.zoneName(ref.z),choices);menuRef=ref;
 }
 function clickCard(ref,anchor,event){const rect=anchor.getBoundingClientRect(),additive=multi||event?.shiftKey||event?.ctrlKey||event?.metaKey;const current=api.state().selected;if(additive){const next=current.some(r=>r.uid===ref.uid)?current.filter(r=>r.uid!==ref.uid):[...current,ref];api.select(next);closeMenu();return;}api.select([ref],ref.p);openCardMenu(ref,{getBoundingClientRect:()=>rect});}
 function clickPile(p,z,anchor){const rect=anchor.getBoundingClientRect(),fixedAnchor={getBoundingClientRect:()=>rect},s=api.state();api.setPlayer(p);const a=s.match.players[p].zones[z];if(a.length){const ref={p,z,uid:a.at(-1).uid};api.select([ref],p);openCardMenu(ref,fixedAnchor);}else{const choices=[{label:'Inspect '+api.zoneName(z),run:()=>api.openPile(p,z)}];if(z==='deck')choices.unshift({label:'Refresh empty deck',run:()=>api.action('refresh')});showSimpleMenu(fixedAnchor,'Player '+(p+1)+' · '+api.zoneName(z),choices);}}
 function emptyStage(p,z,anchor){const selected=api.state().selected;showSimpleMenu(anchor,'Player '+(p+1)+' · '+labels[z],[...(selected.length?[{label:'Move selected here (manual)',run:()=>api.move(selected,p,z)}]:[]),{label:'Inspect markers',run:()=>api.openPile(p,'markers:'+z)},{label:'Manual movement tools…',run:revealManual}]);}

 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target))closeMenu();},true);
 menu.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=[...menu.querySelectorAll('[data-menu-choice]:not([disabled])')],at=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(at+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();e.preventDefault();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!menu.hidden){closeMenu();e.preventDefault();e.stopImmediatePropagation();}else if(!preview.hidden){hidePreview();e.preventDefault();e.stopImmediatePropagation();}else if(focusMode){focusMode=false;updateFullscreen();}}},true);
 document.addEventListener('click',e=>{if(e.target.closest('[data-inspect]')){hidePreview();closeMenu();}},true);
 setArtwork('decks');onView('home');
 return {onView,matchUpdated,hidePreview,closeMenu,clickCard,clickPile,emptyStage,showPreview,previewElement:preview,menuElement:menu,manualElement:manual};
}
