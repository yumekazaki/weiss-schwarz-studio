import {cardContext,stagePositions} from './context-actions-81164c8412.mjs';

const $=s=>document.querySelector(s),all=s=>[...document.querySelectorAll(s)],esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const phaseNames=['Stand','Draw','Clock','Main','Climax','Attack','End'];
const labels={'center-left':'Center left','center-middle':'Center middle','center-right':'Center right','back-left':'Back left','back-right':'Back right'};

export function mountAtelier(api){
 const landscapeFilters=document.createElementNS('http://www.w3.org/2000/svg','svg');landscapeFilters.classList.add('landscape-filters');landscapeFilters.setAttribute('aria-hidden','true');landscapeFilters.innerHTML='<defs><filter id="meadow-breeze" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".004 .024" numOctaves="2" seed="7"><animate attributeName="baseFrequency" values=".004 .024;.006 .019;.004 .024" dur="9s" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" scale="4" xChannelSelector="R" yChannelSelector="G"/></filter><filter id="blossom-breeze" x="-2%" y="-2%" width="104%" height="104%"><feTurbulence type="fractalNoise" baseFrequency=".004 .012" numOctaves="2" seed="4"><animate attributeName="baseFrequency" values=".004 .012;.005 .016;.004 .012" dur="13s" repeatCount="indefinite"/></feTurbulence><feDisplacementMap in="SourceGraphic" scale="2.5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>';document.body.append(landscapeFilters);
 const workshopScenery=document.createElement('div');workshopScenery.id='workshop-scenery';workshopScenery.setAttribute('aria-hidden','true');workshopScenery.setAttribute('inert','');workshopScenery.innerHTML='<div class="workshop-image"></div><div class="workshop-canopy"></div><div class="workshop-sunlight"></div><div class="workshop-shade"></div>'+Array.from({length:20},(_,i)=>'<i class="workshop-petal" style="--x:'+((i*43+7)%100)+'%;--delay:-'+((i*7)%29)+'s;--duration:'+(20+i%9)+'s;--drift:'+(45+i%6*27)+'px;--size:'+(4+i%4)+'px"></i>').join('');document.body.prepend(workshopScenery);

 let menuRef=null,previewId=null,multi=false,hoverTimer=null,focusMode=false,libraryParent=null,lastMenuRect=null;
 const collection=$('#library .collection'),filters=$('#library .filters'),workspace=$('#library .workspace');
 const librarySlot=document.createElement('aside');librarySlot.className='builder-library panel';librarySlot.innerHTML='<div class="browser-heading"><p class="eyebrow">CARD LIBRARY</p><h2>Find your next ace.</h2><p>Click artwork or + to add. Use ⤢ to inspect.</p></div><details class="builder-filters"><summary>Search filters</summary></details><div class="library-content-slot"></div>';
 $('#decks .deck-layout').append(librarySlot);
 const editor=$('#decks .editor'),editorTools=document.createElement('div');editorTools.className='editor-sticky';
 [...editor.children].slice(0,2).forEach(n=>editorTools.append(n));editor.prepend(editorTools);editorTools.append($('#validation'));
 $('#decks .deck-layout>aside').classList.add('saved-deck-rail');

 const preview=document.createElement('section');preview.id='hover-inspector';preview.className='hover-inspector';preview.hidden=true;preview.setAttribute('aria-label','Enlarged card preview and English text');
 document.body.append(preview);
 preview.innerHTML='<div class="hover-inspector-bar">CARD INSPECTOR</div><div class="inspector-empty"><span>✦</span><h2>A closer look.</h2><p>Hover or focus a card to see its artwork and English gameplay text here.</p></div>';
 function syncInspector(){const eligible=['decks','library','practice','online'].includes(document.body.dataset.view)&&!document.body.classList.contains('table-focus')&&!document.querySelector('#online.online-fullscreen');document.body.classList.toggle('inspector-docked',eligible);preview.hidden=!eligible;}
 function fitBattlefield(){const table=$('#table'),frame=table.parentElement;if(!document.body.classList.contains('table-focus')){table.style.cssText='';frame.style.height='';return;}const top=48,available=Math.max(60,window.innerHeight-top-8),width=Math.max(1120,frame.clientWidth*726/available);table.style.width=width+'px';table.style.transform='none';const height=table.scrollHeight,scale=Math.min(frame.clientWidth/width,available/height);table.style.top=top+'px';table.style.transform='translateX(-50%) scale('+scale+')';frame.style.height=window.innerHeight+'px';}

 window.addEventListener('resize',()=>{fitBattlefield();syncInspector();});
 const menu=document.createElement('section');menu.id='card-action-menu';menu.className='card-action-menu';menu.hidden=true;menu.setAttribute('aria-label','Card actions');menu.setAttribute('role','dialog');document.body.append(menu);

 // Keep every existing manual operation, but gather them behind a single named secondary control.
 const manual=document.createElement('details');manual.id='manual-tools';manual.className='manual-tools panel';manual.innerHTML='<summary><span>⚙ Manual tools & overrides</span><small>Movement, costs, orientation, damage, effects and corrections</small></summary><div class="manual-tools-body"></div>';
 const controls=$('#practice .controls'),selection=$('#practice .selection-panel');manual.querySelector('.manual-tools-body').append(controls,selection);
 $('#match-content').append(manual);
 const tools=document.createElement('div');tools.className='table-toolbar';tools.innerHTML='<div class="table-player-control"><label>Controlling <select id="table-player"><option value="0">Player 1</option><option value="1">Player 2</option></select></label><label class="multi-choice"><input type="checkbox" id="multi-select"> Multi-select</label></div><div class="quick-actions"><button id="quick-draw">Draw 1</button><button id="quick-step">Attack steps</button><button id="quick-damage">Damage…</button><button id="quick-piles">Inspect / search…</button><button id="selected-actions">Selected actions</button><button id="open-manual-tools">Manual tools</button></div>';
 $('#match-content').prepend(tools);
 const ruleNote=document.createElement('p');ruleNote.className='table-hint';ruleNote.textContent='Hover or focus a face-up card to read it. Click for actions · ⤢ pins its details · Shift-click selects several.';tools.after(ruleNote);

 function setArtwork(key){
  const info={decks:['Fate','FS/S36-E002'],practice:['Sword Art Online','SAO/S20-E077'],host:['KonoSuba','KS/W55-E043'],join:['RWBY','RWBY/WX03-044']}[key];
  all('[data-backdrop]').forEach(e=>e.classList.toggle('is-active',e.dataset.backdrop===key));all('[data-feature]').forEach(e=>e.classList.toggle('is-active',e.dataset.feature===key));all('[data-menu-option]').forEach(e=>e.classList.toggle('is-featured',e.dataset.menuOption===key));$('#featured-series').textContent=info[0];$('#featured-card-code').textContent=info[1];$('#home').dataset.artwork=key; const bg=document.querySelector('[data-backdrop="'+key+'"] img[data-src]');if(bg&&!document.documentElement.classList.contains('mobile-mode')){bg.src=bg.dataset.src;delete bg.dataset.src;}const enter=$('#title-enter');if(enter){enter.textContent=key==='decks'?'Enter Deck Builder →':key==='practice'?'Enter Practice →':'Coming soon';enter.disabled=key==='host'||key==='join';}const credit=$('#title-art-credit');if(credit)credit.textContent='Created scene artwork · Credits ↗';
 }
 const titleButtons=all('[data-menu-option]');let touchPreview=false;
 titleButtons.forEach(button=>{const key=button.dataset.menuOption;button.addEventListener('pointerenter',e=>{if(e.pointerType!=='touch')setArtwork(key);});button.addEventListener('focus',()=>setArtwork(key));button.addEventListener('pointerdown',e=>{touchPreview=e.pointerType==='touch';setArtwork(key);});button.onclick=e=>{setArtwork(key);if(touchPreview||(window.matchMedia?.('(hover: none)').matches&&e.detail>0)){touchPreview=false;return;}if(key==='decks'||key==='practice')api.view(key);else api.toast('Multiplayer is coming soon. Deck Builder and Practice are ready to use.');};button.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const i=titleButtons.indexOf(button),next=e.key==='Home'?0:e.key==='End'?3:(i+(e.key==='ArrowDown'?1:-1)+4)%4;titleButtons[next].focus();e.preventDefault();});});
 if($('#title-enter'))$('#title-enter').onclick=()=>{const key=$('#home').dataset.artwork;if(key==='decks'||key==='practice')api.view(key);};
 all('[data-title-view]').forEach(b=>b.onclick=()=>{b.closest('details').open=false;api.view(b.dataset.titleView);});
 const artInfo=()=>{document.querySelector('.title-secondary').open=false;$('#dialog-body').innerHTML='<h2>Scene artwork & motion</h2><p>The featured cards are official Bushiroad card scans. Fate, Sword Art Online, KonoSuba and RWBY backgrounds are newly created fan illustrations, not official artwork. The cherry-blossom workshop and sunlit meadow battlefield are newly created scenery illustrations. The Sword Art Online scene features Kirito, Asuna and Yui sitting together on a grassy hill.</p><p>These are layered animated illustrations, not animated video: cloud banks, displaced grass and fabric, atmospheric light, drifting petals and scene depth. Independent character blinking and frame-by-frame character animation are not included.</p><p>Featured cards: “Excalibur” Saber · FS/S36-E002; 《Black Swordsman》 Kirito · SAO/S20-E077; “Detonative Dame” Megumin · KS/W55-E043; Ruby Rose · RWBY/WX03-044.</p>';$('#dialog').showModal();};
 if($('#title-art-info'))$('#title-art-info').onclick=artInfo;if($('#title-art-credit'))$('#title-art-credit').onclick=artInfo;if($('#title-sources'))$('#title-sources').onclick=()=>$('#about').click();
 if($('#title-motion'))$('#title-motion').onclick=e=>{const paused=$('#home').classList.toggle('scenery-paused');e.currentTarget.setAttribute('aria-pressed',String(paused));e.currentTarget.textContent=paused?'Play scenery':'Pause scenery';const svg=document.querySelector('.scene-filter-defs');if(svg){if(paused)svg.pauseAnimations?.();else svg.unpauseAnimations?.();}};
 const root=document.documentElement;
 const mobileModeButton=$('#title-mobile-mode');
 const preloadScenes=()=>{
  all('.scene-base[data-src]').forEach((img,i)=>window.setTimeout(()=>{
   if(!root.classList.contains('mobile-mode') && img.dataset.src){
    img.src=img.dataset.src;
    delete img.dataset.src;
   }
  },i*180));
 };
 const syncMobileMode=()=>{
  const enabled=root.classList.contains('mobile-mode');
  if(mobileModeButton){
   mobileModeButton.setAttribute('aria-pressed',String(enabled));
   mobileModeButton.textContent=enabled?'Mobile Mode · On':'Mobile Mode · Off';
  }
  const titleFilters=$('.scene-filter-defs');
  if(enabled || $('#home').classList.contains('scenery-paused')) titleFilters?.pauseAnimations?.();
  else titleFilters?.unpauseAnimations?.();
  if(enabled) landscapeFilters.pauseAnimations?.();
  else landscapeFilters.unpauseAnimations?.();
 };
 if(mobileModeButton)mobileModeButton.onclick=()=>{
  const enabled=root.classList.toggle('mobile-mode');
  root.classList.toggle('simple-scenery',enabled || root.classList.contains('scenery-compat'));
  try{window.localStorage.setItem('ws-mobile-mode',enabled?'on':'off');}catch{}
  syncMobileMode();
  if(!enabled)preloadScenes();
 };
 syncMobileMode();
 if(!root.classList.contains('mobile-mode')){
  if(window.requestIdleCallback)window.requestIdleCallback(preloadScenes,{timeout:1800});
  else window.setTimeout(preloadScenes,700);
 }
 document.querySelector('.title-secondary')?.addEventListener('keydown',e=>{if(e.key==='Escape'){e.currentTarget.open=false;e.currentTarget.querySelector('summary').focus();}});

 function onView(v){
  document.body.dataset.view=v;closeControls();closeMenu();hidePreview();syncInspector();
  if(v==='decks'&&libraryParent!=='decks'){librarySlot.querySelector('.builder-filters').append(filters);librarySlot.querySelector('.library-content-slot').append(collection);libraryParent='decks';}
  else if(v==='library'&&libraryParent!=='library'){workspace.prepend(filters);filters.after(collection);libraryParent='library';}
 }
 function revealManual(){if($('#dialog').open)$('#close-dialog').click();manual.open=true;manual.scrollIntoView?.({behavior:reducedMotion()?'auto':'smooth',block:'nearest'});}
 function reducedMotion(){return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;}
 $('#open-manual-tools').onclick=revealManual;
 $('#table-player').onchange=e=>{api.setPlayer(+e.target.value);hidePreview();};$('#multi-select').onchange=e=>{multi=e.target.checked;closeMenu();};
 $('#quick-draw').onclick=()=>{api.setAmount(1);api.action('draw');};
 $('#quick-damage').onclick=e=>{const s=api.state(),p=s.player,d=s.match?.damage[p];showSimpleMenu(e.currentTarget,'Damage · Player '+(p+1),d?[{label:'Reveal next damage card',run:()=>api.action('damage-reveal')},{label:'Resolve damage / cancellation',run:()=>api.action('damage-finish')}]:[1,2,3,4,5].map(n=>({label:'Take '+n+' damage',run:()=>{api.setAmount(n);api.action('damage');}})).concat([{label:'Other amount / manual resolution…',run:revealManual}]));};
 $('#quick-step').onclick=e=>{showSimpleMenu(e.currentTarget,'Attack step',['Attack declaration','Trigger','Counter','Damage','Battle','Encore'].map(step=>({label:step,run:()=>api.setStep(step)})).concat([{label:'Reveal trigger',run:()=>api.action('trigger')},{label:'Trigger → stock',run:()=>api.action('stock')},{label:'End / encore cleanup',run:()=>api.action('encore')}]));};
 $('#quick-piles').onclick=e=>showSimpleMenu(e.currentTarget,'Inspect / search · Player '+(api.state().player+1),['deck','hand','waiting','stock','clock','level','memory','climax','resolution'].map(z=>({label:api.zoneName(z),run:()=>api.openPile(api.state().player,z)})));
 $('#selected-actions').onclick=e=>{const selected=api.state().selected;if(!selected.length)return api.toast('Select a card first, or enable multi-select to choose several.');if(selected.length===1)return openCardMenu(selected[0],e.currentTarget);showSimpleMenu(e.currentTarget,selected.length+' selected cards',[{label:'Move selected cards…',run:revealManual},{label:'Mulligan selected hand cards',run:()=>api.action('mulligan')},{label:'Reveal / hide selected',run:()=>api.action('reveal')},{label:'Rest selected',run:()=>api.action('rest')},{label:'Stand selected',run:()=>api.action('stand-selected')},{label:'Clear selection',run:()=>api.select([])}]);};

 const fsButton=$('#fullscreen-toggle');
 const arenaFrame=$('#table').parentElement,arenaChrome=document.createElement('div');arenaChrome.className='arena-chrome';arenaChrome.innerHTML='<button id="arena-controls-toggle" aria-expanded="false" aria-controls="arena-game-controls">☰ Game Controls</button>';arenaChrome.append(fsButton);arenaFrame.prepend(arenaChrome);
 const gameControls=document.createElement('section');gameControls.id='arena-game-controls';gameControls.className='arena-game-controls';gameControls.setAttribute('role','dialog');gameControls.setAttribute('aria-label','Game controls');gameControls.hidden=true;gameControls.innerHTML='<div class="arena-controls-heading"><strong>Game controls</strong><button id="arena-controls-close" aria-label="Close game controls">×</button></div><div class="arena-controls-content"></div>';$('#practice').append(gameControls);
 const controlToggle=$('#arena-controls-toggle'),controlSlot=gameControls.querySelector('.arena-controls-content'),dockedControls=[];let controlsOpen=false,autoOpenedControls=false,lastChoiceId=null;
 function dockControls(){for(const el of [$('#practice>.heading>.toolbar'),tools,$('#resolution-panel'),$('#match-setup'),manual]){if(!el||dockedControls.some(x=>x.el===el))continue;const marker=document.createComment('arena control home');el.before(marker);dockedControls.push({el,marker});controlSlot.append(el);}}
 function restoreControls(){for(const {el,marker} of dockedControls){marker.replaceWith(el);}dockedControls.length=0;}
 function openControls(automatic=false){dockControls();controlsOpen=true;autoOpenedControls=automatic;gameControls.hidden=false;controlToggle.setAttribute('aria-expanded','true');(gameControls.querySelector('[data-response]')||$('#arena-controls-close')).focus({preventScroll:true});}
 function closeControls(returnFocus=false){controlsOpen=false;autoOpenedControls=false;gameControls.hidden=true;controlToggle.setAttribute('aria-expanded','false');if(!document.body.classList.contains('table-focus'))restoreControls();if(returnFocus)controlToggle.focus({preventScroll:true});}
 function choiceControls(){const c=api.state().match?.auto?.choice,pending=!!c;controlToggle.classList.toggle('needs-response',pending);controlToggle.textContent=pending?'☰ Game Controls · Choice':'☰ Game Controls';if(document.body.classList.contains('table-focus')){dockControls();if(pending&&c.id!==lastChoiceId&&!controlsOpen)openControls(true);else if(!pending&&autoOpenedControls)closeControls();}lastChoiceId=c?.id??null;}
 controlToggle.onclick=()=>controlsOpen?closeControls(true):openControls();$('#arena-controls-close').onclick=()=>closeControls(true);
 document.addEventListener('pointerdown',e=>{if(controlsOpen&&!gameControls.contains(e.target)&&!arenaChrome.contains(e.target)&&!e.target.closest('#card-action-menu,dialog'))closeControls();},true);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&controlsOpen&&menu.hidden){closeControls(true);e.preventDefault();e.stopImmediatePropagation();}},true);
 document.addEventListener('arena-choice-changed',choiceControls);

 function updateFullscreen(){const active=!!document.fullscreenElement||focusMode;document.body.classList.toggle('table-focus',active);if(active){dockControls();choiceControls();if(api.state().match?.auto?.choice&&!controlsOpen)openControls(true);}else closeControls();fsButton.setAttribute('aria-pressed',String(active));hidePreview();syncInspector();window.requestAnimationFrame(fitBattlefield);fsButton.textContent=active?(focusMode?'⤡ Exit focus view':'⤡ Exit fullscreen'):'⛶ Fullscreen';}
 fsButton.onclick=async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else if(focusMode){focusMode=false;}else if(document.documentElement.requestFullscreen){await document.documentElement.requestFullscreen();}else{focusMode=true;api.toast('Fullscreen is unavailable here. Focus view is on.');}}catch{focusMode=true;api.toast('This browser blocks fullscreen. Focus view is on instead.');}updateFullscreen();};
 document.addEventListener('fullscreenchange',updateFullscreen);

 function phaseBanner(){const s=api.state(),m=s.match;if(!m)return '';return '<section class="phase-banner" aria-label="Current phase and turn"><div class="phase-identity"><span class="active-player-dot"></span><div><small>PLAYER '+(m.active+1)+' · TURN '+m.turn+'</small><strong id="mid-phase">'+phaseNames[m.phase]+' <em>phase</em></strong>'+(m.phase===5?'<span class="attack-step-name">'+esc(m.step)+'</span>':'')+'</div></div><div class="phase-dots" aria-hidden="true">'+phaseNames.map((p,i)=>'<i class="'+(i===m.phase?'current':'')+'" title="'+p+'"></i>').join('')+'</div><div class="phase-actions"><button id="previous-phase" aria-label="Previous phase" title="Correct an accidental phase advance">↶</button><button id="next-phase-middle" class="primary">Next Phase <span>→</span></button></div></section>';}
 function matchUpdated(){
  const s=api.state();$('#table-player').value=String(s.player);$('#multi-select').checked=multi;if(!s.match)return;
  const atmosphere=document.createElement('div');atmosphere.className='arena-atmosphere meadow-atmosphere';atmosphere.setAttribute('aria-hidden','true');atmosphere.setAttribute('inert','');atmosphere.innerHTML='<div class="meadow-image"></div><div class="meadow-grass"></div><div class="meadow-sunlight"></div><div class="meadow-cloud meadow-cloud-one"></div><div class="meadow-cloud meadow-cloud-two"></div>'+Array.from({length:8},(_,i)=>'<i class="meadow-gust" style="--y:'+(12+i*10)+'%;--delay:-'+(i*3)+'s;--duration:'+(17+i%4*3)+'s"></i>').join('');$('#table').prepend(atmosphere);
  const halves=all('#table .player-mat');if(halves.length===2){halves[0].insertAdjacentHTML('afterend',phaseBanner());$('#previous-phase').onclick=()=>api.previousPhase();$('#next-phase-middle').onclick=()=>api.advancePhase();}
  if(s.selected.length)$('#selected-actions').textContent=s.selected.length+' selected · actions';else $('#selected-actions').textContent='Selected actions';
  window.requestAnimationFrame(fitBattlefield);
 }

 function cardPayload(target){if(preview.contains(target)||menu.contains(target))return null;const element=target.closest('[data-hover-card],[data-ref]');if(!element)return null;if(element.dataset.ref){const r=parseRef(element.dataset.ref);if(!api.readable(r))return null;return {id:api.instance(r)?.id,anchor:element};}return {id:element.dataset.hoverCard,anchor:element};}
 function parseRef(text){const [p,z,uid]=text.split('|');return {p:+p,z,uid};}
 function positionPanel(element,anchor){
  const rect=anchor.getBoundingClientRect(),width=Math.min(680,window.innerWidth-24),height=Math.min(485,window.innerHeight-32);let left=rect.right+18;if(left+width>window.innerWidth-12)left=rect.left-width-18;if(left<12)left=Math.max(12,(window.innerWidth-width)/2);const top=Math.max(12,Math.min(rect.top-45,window.innerHeight-height-12));Object.assign(element.style,{left:left+'px',top:top+'px',width:width+'px',maxHeight:height+'px'});
 }
 function showPreview(id,anchor){if(document.body.classList.contains('table-focus')||document.querySelector('#online.online-fullscreen')||$('#dialog').open||!id||!api.card(id))return;const parent=document.body;if(preview.parentElement!==parent)parent.append(preview);if(previewId!==id){preview.innerHTML='<div class="hover-inspector-bar"><span>READABLE CARD PREVIEW</span><div><button id="pin-hover-card" title="Keep a larger view open">⤢ Pin</button><button id="close-hover-card" aria-label="Close hover preview">×</button></div></div><div class="hover-inspector-body"><div class="hover-image">'+api.image(id)+'</div><div class="hover-text" tabindex="0" aria-label="Scrollable English card text">'+api.details(id)+'</div></div>';$('#pin-hover-card').onclick=()=>{hidePreview();api.inspect(id);};$('#close-hover-card').onclick=hidePreview;previewId=id;}preview.style.cssText='';syncInspector();}
 function hidePreview(){clearTimeout(hoverTimer);syncInspector();}
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
  const s=api.state(),instance=api.instance(ref);if(!instance)return;const readable=api.readable(ref),card=readable?api.card(instance.id):null,choices=cardContext({match:s.match,ref,card,englishAbility:card?api.englishAbility(card.id):''}).map(c=>({...c,hint:s.match.auto?.enabled&&c.key.startsWith('attack-')?'Guided attack: calculate soul, resolve triggers, responses and damage.':c.hint,run:()=>runContext(c.key,ref)}));
  choices.push({label:'Inspect / search this zone',run:()=>api.openPile(ref.p,ref.z)});
  if(readable)choices.unshift({label:'⤢ Pin card details',run:()=>api.inspect(instance.id)});
  choices.push({label:multi?'Leave multi-select':'Add more cards to selection',run:()=>{multi=!multi;$('#multi-select').checked=multi;api.toast(multi?'Multi-select on. Choose cards in the order you want.':'Multi-select off.');}});
  const manualChoices=[{label:'Move to any zone / player…',run:revealManual},...['stand-selected','rest','reverse','flip','reveal','note'].map(key=>({label:({'stand-selected':'Stand','rest':'Rest','reverse':'Reverse','flip':'Flip face','reveal':'Reveal / hide','note':'Power / soul note'})[key],run:()=>api.action(key)})),{label:'Attack declaration override…',run:()=>showSimpleMenu(menu,'Attack override',['direct','frontal','side'].map(type=>({label:type[0].toUpperCase()+type.slice(1)+' attack (manual override)',run:()=>api.declareAttack(ref,type,true)})))},{label:'All costs, damage and effect tools…',run:revealManual}];
  choices.push({label:'Manual overrides…',hint:'Unusual effects, movement, costs and corrections',run:()=>showSimpleMenu(menu,'Manual card overrides',manualChoices)});
  showSimpleMenu(anchor,(readable?api.name(instance.id):'Hidden card')+' · P'+(ref.p+1)+' '+api.zoneName(ref.z),choices);menuRef=ref;
 }
 function clickCard(ref,anchor,event){const rect=anchor.getBoundingClientRect(),additive=multi||event?.shiftKey||event?.ctrlKey||event?.metaKey;const current=api.state().selected;if(additive){const next=current.some(r=>r.uid===ref.uid)?current.filter(r=>r.uid!==ref.uid):[...current,ref];api.select(next);closeMenu();return;}api.select([ref],ref.p);openCardMenu(ref,{getBoundingClientRect:()=>rect});}
 function clickPile(p,z,anchor){closeMenu();hidePreview();api.openPile(p,z);}
 function emptyStage(p,z,anchor){const selected=api.state().selected;showSimpleMenu(anchor,'Player '+(p+1)+' · '+labels[z],[...(selected.length?[{label:'Move selected here (manual)',run:()=>api.move(selected,p,z)}]:[]),{label:'Inspect markers',run:()=>api.openPile(p,'markers:'+z)},{label:'Manual movement tools…',run:revealManual}]);}

 document.addEventListener('pointerdown',e=>{if(!menu.hidden&&!menu.contains(e.target))closeMenu();},true);
 menu.addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','Home','End'].includes(e.key))return;const buttons=[...menu.querySelectorAll('[data-menu-choice]:not([disabled])')],at=buttons.indexOf(document.activeElement),next=e.key==='Home'?0:e.key==='End'?buttons.length-1:(at+(e.key==='ArrowDown'?1:-1)+buttons.length)%buttons.length;buttons[next]?.focus();e.preventDefault();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape'){if(!menu.hidden){closeMenu();e.preventDefault();e.stopImmediatePropagation();}else if(!preview.hidden){hidePreview();e.preventDefault();e.stopImmediatePropagation();}else if(focusMode){focusMode=false;updateFullscreen();}}},true);
 document.addEventListener('click',e=>{if(e.target.closest('[data-inspect]')){hidePreview();closeMenu();}},true);
 setArtwork('decks');onView('home');
 return {onView,matchUpdated,hidePreview,closeMenu,clickCard,clickPile,emptyStage,showPreview,previewElement:preview,menuElement:menu,manualElement:manual};
}
