import {onlineConfig as config} from './online-config.mjs';
import {noSideAttack,phases,zones,playFromHandError} from './engine-3ec9e8cad9.mjs';
import {cardMoveOptions,facingPosition,statAdjustments} from './context-actions-b33aeaaefa.mjs';
import {abilityLines,activatedAbilities,parseAbility} from './automation-4ad1ad29a5.mjs';
import {modifierBreakdown,mountAbilityPicker,stageTargetOptions} from './resolution-ui-8c63a7d49c.mjs';
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const clone=x=>structuredClone(x),stage=['center-left','center-middle','center-right','back-left','back-right'];
export async function mountOnline(api,loadAuth=()=>import('https://esm.sh/@supabase/supabase-js@2.81.1?bundle')){
 let client,user=null,room=null,busy=false,polling=false,timer,cloud=[],selections=[],peek=null,lastVersion=-1,recovery=false,pendingLobby=null,authBusy=false,lobbyDeck='',syncRun=null;
 const section=document.createElement('section');section.id='online';section.className='view';section.hidden=true;section.innerHTML='<div id="online-content"></div>';document.querySelector('main').append(section);
 const mulliganDialog=document.createElement('dialog');
 mulliganDialog.id='opening-hand';
 mulliganDialog.setAttribute('aria-labelledby','opening-hand-title');
 section.append(mulliganDialog);
 const abilityPicker=mountAbilityPicker(section,api);
 let mulliganRoom=null,mulliganMinimized=false;
 mulliganDialog.addEventListener('cancel',()=>{mulliganMinimized=true;});
 const account=document.createElement('button');account.id='account-button';account.textContent='Account';document.querySelector('header').append(account);
 const nav=document.createElement('button');nav.id='online-nav';nav.textContent='Online match';document.querySelector('nav').append(nav);
 const titleAccount=document.createElement('button');titleAccount.id='title-account';titleAccount.textContent='Account';document.querySelector('.title-topline')?.append(titleAccount);titleAccount.onclick=()=>account.click();
 const defaultButton=document.createElement('button');defaultButton.id='set-default-deck';defaultButton.textContent='Set deck to default';$('#save-deck').after(defaultButton);
 const accountRail=document.createElement('div');accountRail.id='account-deck-rail';accountRail.hidden=true;$('#saved-list').after(accountRail);
 const defaultId=()=>user?.user_metadata?.ws_default_deck||'';
 function renderRail(){accountRail.hidden=!user;accountRail.innerHTML=user?'<h3>Account decks</h3>'+cloud.map((d,i)=>'<div class="saved-item"><b>'+esc(d.name)+'</b>'+(d.id===defaultId()?'<small class="included-badge">Default deck</small>':'')+'<button data-account-load="'+i+'">Load</button></div>').join(''):'';accountRail.querySelectorAll('[data-account-load]').forEach(b=>b.onclick=()=>api.loadDraft(cloud[+b.dataset.accountLoad],false));}
 function openDefault(){const d=cloud.find(d=>d.id===defaultId());if(d)api.loadDraft(d,false);}
 async function syncAccount(){const uid=user?.id;if(!uid)return;if(syncRun?.uid===uid)return syncRun.promise;const promise=(async()=>{await decks();if(user?.id===uid)openDefault();})();syncRun={uid,promise};try{await promise;}finally{if(syncRun?.promise===promise)syncRun=null;}}
 defaultButton.onclick=async()=>{if(!user)return account.click();const d=api.draft();if(!d.name?.trim()||!Object.keys(d.cards||{}).length)return api.toast('Load or build a deck first.');defaultButton.disabled=true;try{d.id||=crypto.randomUUID();const {deck}=await call('save-deck',{deck:d});const {data,error}=await client.auth.updateUser({data:{ws_default_deck:deck.id}});if(error)throw error;user=data.user;api.loadDraft(deck,false);await decks();api.toast('Default deck saved. It will load when you return signed in.');}catch(e){api.toast('Could not set the default deck: '+e.message);}finally{defaultButton.disabled=false;}};

 function message(t,error=false){const node=$('#online-message');if(node){node.textContent=t;node.classList.toggle('error',error);}else api.toast(t);}
 async function call(op,args={}){const {data:{session}}=await client.auth.getSession();if(!session)throw Error('Sign in to use online play.');const response=await fetch(config.url+'/functions/v1/ws-online',{method:'POST',headers:{Authorization:'Bearer '+session.access_token,apikey:config.key,'Content-Type':'application/json'},body:JSON.stringify({op,...args})});const b=await response.json();if(!response.ok||b.error)throw Error(b.error||'Online service unavailable.');return b;}
 function show(html){api.dialog(html);}
 function stamp(){return {room:room.id,version:room.version,actionId:crypto.randomUUID()};}
 async function command(op,args={},onError=api.toast){if(busy){onError('Wait for the current action to finish.');return false;}busy=true;$('#online-content')?.setAttribute('aria-busy','true');try{const next=await call(op,{...stamp(),...args});if(next.left){closeMulligan();localStorage.removeItem('ws-online-room');room=null;lastVersion=-1;api.view('home');return;}accept(next);return true;}catch(e){onError(e.message);await poll();return false;}finally{busy=false;$('#online-content')?.removeAttribute('aria-busy');}}
 function accept(next){if(!next.id)return;const previous=room;room=next;if(next.seat!==-1)localStorage.setItem('ws-online-room',next.id);if(next.version!==lastVersion){lastVersion=next.version;if(previous?.id!==next.id||!mulliganPending(previous)||!mulliganPending(next))selections=[];render();}else renderStatus();}
 function mulliganPending(snapshot){
  const setup=snapshot?.state?.setup,p=snapshot?.seat;
  return (p===0||p===1)&&setup&&(!setup.stage||setup.stage==='mulligan')&&!setup.done?.[p]&&!snapshot.state.auto.gameOver;
 }
 function closeMulligan(){
  if(mulliganDialog.open)mulliganDialog.close();
 }
 function renderMulligan(){
  if(!mulliganPending(room)||section.hidden){
   closeMulligan();
   return;
  }
  if(mulliganRoom!==room.id){mulliganRoom=room.id;mulliganMinimized=false;}
  const p=room.seat,setup=room.state.setup,ready=setup.p===p;
  const hand=room.state.players[p].zones.hand;
  const count=selections.length;
  mulliganDialog.innerHTML='<h2 id="opening-hand-title">Your opening hand</h2><p>Select any cards to replace, or keep all five. Replaced cards go to your Waiting Room before you draw.</p><div class="mulligan-hand">'+hand.map((card,i)=>{
   const marked=selections.some(ref=>ref.uid===card.uid);
   return '<button type="button" class="mulligan-card" aria-pressed="'+marked+'" data-mulligan-card="'+i+'">'+api.image(card.id)+'<span>'+esc(api.name(card.id))+'</span><small>'+(marked?'Replace':'Keep')+'</small></button>';
  }).join('')+'</div><p role="status" id="opening-hand-status">'+(ready?'Replace '+count+' of '+hand.length+' cards.':'You can select cards now. '+esc(room.names[setup.p])+' confirms first.')+'</p><div class="toolbar"><button type="button" class="primary" id="online-mulligan" '+(ready?'':'disabled')+'>Done mulligan</button><button type="button" id="minimize-mulligan">Review board</button></div>';
  mulliganDialog.querySelectorAll('[data-mulligan-card]').forEach(button=>button.onclick=()=>{
   const card=hand[+button.dataset.mulliganCard];
   const index=selections.findIndex(ref=>ref.uid===card.uid);
   if(index<0)selections.push({p,z:'hand',uid:card.uid});else selections.splice(index,1);
   const marked=index<0;
   button.setAttribute('aria-pressed',String(marked));
   button.querySelector('small').textContent=marked?'Replace':'Keep';
   if(ready)$('#opening-hand-status').textContent='Replace '+selections.length+' of '+hand.length+' cards.';
  });
  $('#minimize-mulligan').onclick=()=>{mulliganMinimized=true;closeMulligan();};
  $('#online-mulligan').onclick=async event=>{
   const button=event.currentTarget;
   button.disabled=true;
   if(!await act('mulligan',{refs:selections})&&button.isConnected)button.disabled=false;
  };
  if(!mulliganMinimized&&!mulliganDialog.open)mulliganDialog.showModal();
 }
 async function poll(){if(!user||!room||polling)return;polling=true;try{const current=room;const next=await call(current.seat===-1?'watch-state':'state',{room:current.id});if(room?.id===current.id&&room.seat===current.seat&&next.version>=room.version)accept(next);}catch(e){const status=$('#online-connection');if(status)status.textContent=room?.seat===-1?'Spectator connection interrupted. Retrying…':'Disconnected — retrying. Your seat is reserved.';}finally{polling=false;}}
 function renderStatus(){const e=$('#online-connection');if(e)e.textContent=room.seat===-1?'Spectating · Room '+room.code:!room.hasOpponent?'Waiting for another player':room.opponentPresent?'Opponent connected':'Opponent disconnected — their seat is reserved';}
 async function decks(){const uid=user?.id;const result=await call('decks');if(user?.id===uid){cloud=result.decks;renderRail();}return cloud;}
 function accountDialog(){show('<h2>Your account</h2><p id="online-message" role="status">'+(user?'Signed in as '+esc(user.email):'Sign in to save decks across devices and play online.')+'</p>'+(user?'<div class="toolbar"><button id="cloud-local">Import browser decks</button><button id="cloud-reload">Refresh account decks</button><button id="account-out">Sign out</button></div><p>New saves and copies sync while signed in. Import existing browser decks to add them to this account.</p><div id="cloud-decks"></div>':'<form id="account-form"><button class="primary" type="button" id="account-google">Continue with Google</button><p>Or sign in with email</p><label>Email<input type="email" id="account-email" autocomplete="email" required></label><label>Password<input type="password" id="account-password" minlength="8" autocomplete="current-password"></label><div class="toolbar"><button type="submit" class="primary">Sign in</button><button type="button" id="account-create">Create account</button><button type="button" id="account-forgot">Forgot password</button></div></form>')+(recovery?'<form id="recovery-form"><label>New password<input id="recovery-password" type="password" minlength="8" autocomplete="new-password" required></label><button class="primary">Update password</button></form>':''));
 if(user){$('#account-out').onclick=async()=>{if(room?.seat===-1){room=null;lastVersion=-1;}else if(room)await command('leave');await client.auth.signOut();cloud=[];user=null;accountDialog();};$('#cloud-reload').onclick=async()=>{await decks();renderCloud();};$('#cloud-local').onclick=async()=>{try{let count=0;for(const d of api.saved().filter(d=>!d.included&&!cloud.some(c=>c.id===d.id))){await call('save-deck',{deck:d});count++;}await decks();renderCloud();message('Imported '+count+' browser decks.');}catch(e){message(e.message,true);}};renderCloud();}
 else{$('#account-google').onclick=signInWithGoogle;$('#account-form').onsubmit=async e=>{e.preventDefault();await auth('in');};$('#account-create').onclick=()=>auth('up');$('#account-forgot').onclick=()=>auth('recover');}
 if(recovery)$('#recovery-form').onsubmit=async e=>{e.preventDefault();const {error}=await client.auth.updateUser({password:$('#recovery-password').value});if(error)message(error.message,true);else{recovery=false;message('Password updated.');}};
 }
 function renderCloud(){const list=$('#cloud-decks');if(!list)return;list.innerHTML='<h3>Account decks</h3>'+cloud.map((d,i)=>'<div class="cloud-deck"><span>'+esc(d.name)+' · '+Object.values(d.cards).reduce((a,b)=>a+b,0)+' cards</span><button data-cloud-load="'+i+'">Edit</button><button data-cloud-copy="'+i+'">Duplicate</button><button data-cloud-delete="'+i+'">Delete</button></div>').join('');list.querySelectorAll('[data-cloud-load],[data-cloud-copy]').forEach(b=>b.onclick=()=>{const d=clone(cloud[+(b.dataset.cloudLoad??b.dataset.cloudCopy)]);if(b.dataset.cloudCopy!==undefined){d.id=crypto.randomUUID();d.name+=' (copy)';}api.loadDraft(d);$('#dialog').close();api.view('decks');});list.querySelectorAll('[data-cloud-delete]').forEach(b=>b.onclick=async()=>{const d=cloud[+b.dataset.cloudDelete];await call('delete-deck',{deckId:d.id});await decks();renderCloud();});}

 async function signInWithGoogle() {
   if (authBusy) return;
   authBusy = true;
   const button = $('#account-google');
   button.disabled = true;
   try {
     message('Connecting to Google…');
     const response = await fetch(config.url + '/auth/v1/settings', {
       headers: { apikey: config.key },
       cache: 'no-store'
     });
     if (!response.ok) throw new Error('Could not reach the sign-in service. Please try again.');
     const settings = await response.json();
     if (!settings.external?.google) throw new Error('Google sign-in is awaiting setup. Please try again once it is enabled.');
     const { error } = await client.auth.signInWithOAuth({
       provider: 'google',
       options: { redirectTo: location.origin + location.pathname }
     });
     if (error) throw error;
   } catch (error) {
     message(error.message, true);
   } finally {
     authBusy = false;
     button.disabled = false;
   }
 }
 async function auth(kind){if(authBusy)return;const form=$('#account-form');if(!form?.reportValidity())return;authBusy=true;const buttons=[...form.querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);try{message('Connecting…');const email=$('#account-email').value.trim(),password=$('#account-password').value;let result;if(kind==='recover')result=await client.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});else if(kind==='up'){if(password.length<8)throw Error('Use a password with at least eight characters.');result=await client.auth.signUp({email,password,options:{emailRedirectTo:location.origin+location.pathname}});}else result=await client.auth.signInWithPassword({email,password});if(result.error)throw result.error;$('#account-password')&&($('#account-password').value='');if(result.data?.session){user=result.data.user||result.data.session.user;try{await syncAccount();}catch{api.toast('Signed in. Account decks could not sync; browser decks are still here.');}const intent=pendingLobby;pendingLobby=null;if(intent)await lobby(intent);else accountDialog();}else message(kind==='recover'?'If the account exists, a recovery email is on its way.':'Check your email to confirm your account, then sign in.');}catch(e){const code=e.code||'';const mailLimit=['over_email_send_rate_limit','email_address_not_authorized'].includes(code)||/email rate limit|email address not authorized/i.test(e.message);message(mailLimit?'The site could not send the account email. This is an email service limit, even on a first attempt. Existing accounts can still sign in.':code==='email_not_confirmed'?'Confirm your email before signing in.':e.message,true);}finally{authBusy=false;buttons.forEach(b=>b.disabled=false);}}
 async function browseRooms(){
   show('<h2>Online rooms</h2><p id="online-message" role="status">Loading rooms…</p><div id="room-list"></div><div class="toolbar"><button id="room-refresh">Refresh list</button><button id="room-by-code">Enter room code</button></div>');
   const list=$('#room-list');
   $('#room-refresh').onclick=browseRooms;
   $('#room-by-code').onclick=()=>lobby('join',null,true);
   try {
     const {rooms=[]}=await call('rooms');
     if(!list.isConnected)return;
     message(rooms.length?'Choose a room to join or watch.':'No active rooms right now.');
     list.innerHTML=rooms.map((r,i)=>'<div class="room-list-row"><div><strong>'+esc(r.name||'Room')+'</strong><br><small>'+esc(r.code)+' · '+(r.status==='playing'?'Match in progress':r.joinable?'Open seat':'Waiting to start')+(r.locked?' · Password required':'')+'</small></div><div class="toolbar">'+(r.joinable?'<button class="primary" data-room-join="'+i+'">Join</button>':'')+'<button data-room-watch="'+i+'">Spectate</button></div></div>').join('');
     list.querySelectorAll('[data-room-join]').forEach(b=>b.onclick=()=>lobby('join',rooms[+b.dataset.roomJoin],true));
     list.querySelectorAll('[data-room-watch]').forEach(b=>b.onclick=()=>lobby('watch',rooms[+b.dataset.roomWatch],true));
   } catch(error){if(list.isConnected)message(error.message,true);}
 }
 async function stopWatching(){
   room=null;
   lastVersion=-1;
   section.classList.remove('online-fullscreen');
   if(document.fullscreenElement)await document.exitFullscreen();
   api.view('home');
   await browseRooms();
 }
 async function toggleFullscreen(){
   const enabled=section.classList.toggle('online-fullscreen');
   if(enabled){try{await document.documentElement.requestFullscreen();}catch{}}
   else if(document.fullscreenElement)await document.exitFullscreen();
   const button=$('#online-fullscreen');
   if(button)button.textContent=section.classList.contains('online-fullscreen')?'Exit fullscreen':'Fullscreen';
   api.updateInspector?.();
 }
 async function lobby(mode, selectedRoom=null, manual=false){if(!client)return api.toast('Account service is loading. Please try again shortly.');if(!user){pendingLobby=mode;accountDialog();return;}if(room){api.view('online');render();return;}if(mode==='join'&&!manual)return browseRooms();const available=options();show('<h2>'+(mode==='host'?'Host a match':mode==='watch'?'Spectate room '+esc(selectedRoom.code):'Join a match')+'</h2><p id="online-message" role="status">Both players need their own signed-in account.</p><form id="room-form">'+(mode==='join'&&!selectedRoom?'<label>Room code<input id="room-code" maxlength="6" required autocomplete="off"></label>':'')+((!selectedRoom||selectedRoom.locked)?'<label>Room password '+(mode==='host'?'(optional)':'')+'<input id="room-password" type="password" maxlength="72" autocomplete="off" '+(selectedRoom?.locked?'required':'')+'></label>':'')+(mode==='watch'?'':'<label>Your deck<select id="room-deck" required>'+deckOptions(available,defaultId())+'</select></label>')+'<button class="primary">'+(mode==='host'?'Create room':mode==='watch'?'Watch match':'Join room')+'</button></form>');$('#room-form').onsubmit=async e=>{e.preventDefault();const button=e.target.querySelector('button');button.disabled=true;try{lobbyDeck=$('#room-deck')?.value||'';const next=await call(mode==='host'?'create':mode,{password:$('#room-password')?.value||'',code:selectedRoom?.code||$('#room-code')?.value.trim().toUpperCase()});lastVersion=-1;accept(next);$('#dialog').close();api.view('online');render();}catch(e){message(e.message,true);}finally{button.disabled=false;}};}
 account.onclick=()=>client?accountDialog():api.toast('Account service is loading.');nav.onclick=()=>lobby('join');
 // Keep the four animated scenes and touch preview, replacing only the former placeholders.
 document.querySelectorAll('[data-menu-option="host"],[data-menu-option="join"]').forEach(b=>{b.querySelectorAll('.coming-soon,.menu-badge,.soon-badge').forEach(n=>n.remove());const subtitle=b.querySelector('small');if(subtitle)subtitle.textContent=b.dataset.menuOption==='host'?'Create a private room':'Enter your friend’s room code';b.setAttribute('aria-label',b.dataset.menuOption==='host'?'Host a Match':'Join a Match');b.addEventListener('click',e=>{e.preventDefault();e.stopImmediatePropagation();lobby(b.dataset.menuOption);},true);});
 const enter=$('#title-enter');enter?.addEventListener('click',e=>{const key=$('#home').dataset.artwork;if(['host','join'].includes(key)){e.stopImmediatePropagation();lobby(key);}},true);
 const sceneWatch=new MutationObserver(()=>{if(['host','join'].includes($('#home').dataset.artwork)){enter.disabled=false;enter.textContent=$('#home').dataset.artwork==='host'?'Host a match →':'Join a match →';}});sceneWatch.observe($('#home'),{attributes:true,attributeFilter:['data-artwork']});
 document.addEventListener('ws-deck-saved',async e=>{if(!user)return;try{await call('save-deck',{deck:e.detail});await decks();api.toast('Deck saved to your account and this browser.');}catch(e){api.toast('Browser save kept. Account save failed: '+e.message);}});
 function options(){const merged=new Map([...api.saved(),...cloud].map(d=>[d.id,d]));return [...merged.values()];}
 function deckOptions(ds,id){return ds.map(d=>'<option value="'+esc(d.id)+'" '+(id===d.id?'selected':'')+'>'+esc(d.name)+'</option>').join('');}
 function render(){closeCardActions();if(!mulliganPending(room))closeMulligan();if(!room)return;const el=$('#online-content');if(!room.state&&room.seat===-1){el.innerHTML='<div class="online-topbar"><button id="online-leave">Stop spectating</button><span id="online-connection"></span><button id="online-fullscreen">'+(section.classList.contains('online-fullscreen')?'Exit fullscreen':'Fullscreen')+'</button></div><div class="online-lobby panel"><h2>Room '+esc(room.code)+'</h2><p>Waiting for the match to start.</p></div>';$('#online-leave').onclick=stopWatching;$('#online-fullscreen').onclick=toggleFullscreen;renderStatus();return;}if(!room.state){const ds=options(),chosen=room.ready[room.seat]?room.ownDeck?.id:lobbyDeck||room.ownDeck?.id||defaultId();el.innerHTML='<div class="heading"><div><p class="eyebrow">ONLINE LOBBY</p><h1>Room '+esc(room.code)+'</h1><p id="online-connection"></p></div><button id="online-leave">Leave room</button></div><div class="online-lobby panel"><p>Your seat: Player '+(room.seat+1)+'</p><p>'+room.ready.map((x,i)=>esc(room.names[i])+' — '+(x?'Ready':'Choosing a deck')).join('<br>')+'</p><label>Your name<input id="online-name" maxlength="40" value="'+esc(room.names[room.seat])+'"></label><label>Your deck<select id="online-deck">'+deckOptions(ds,chosen)+'</select></label><button id="online-ready" class="primary">'+(room.ready[room.seat]?'Unready':'Ready to play')+'</button><p>Both ready players start automatically. Each player controls their own side.</p><p>Other card abilities remain manual; basic deck validation is not tournament certification.</p></div>';if(ds.some(d=>d.id===chosen))$('#online-deck').value=chosen;$('#online-deck').onchange=e=>{lobbyDeck=e.target.value;};$('#online-ready').onclick=()=>command('ready',{deck:ds.find(d=>d.id===$('#online-deck').value),name:$('#online-name').value,ready:!room.ready[room.seat]});$('#online-leave').onclick=()=>command('leave');renderStatus();return;}
 const s=room.state,watching=room.seat===-1,p=watching?0:room.seat,other=1-p;el.innerHTML='<div class="online-topbar">'+(watching?'<button id="online-leave">Stop spectating</button>':'<details><summary>☰ Game Controls</summary><div class="online-controls"><button id="online-leave">Leave / disconnect</button><button id="online-undo">Request undo</button><button id="online-concede">Concede match</button><button id="online-pause">Pause for card effects</button><button id="online-effect">Resolve manual effect…</button><button id="online-tools">Manual actions…</button><a href="automation-support.html" target="_blank" rel="noopener">Supported abilities & limitations ↗</a><p>Unsupported card text stays manual. Pause before its timing to resolve it.</p><details><summary>Action log</summary><div class="online-log">'+s.log.map(t=>'<p>'+esc(t)+'</p>').join('')+'</div></details></div></details>')+'<span id="online-connection"></span><button id="online-fullscreen">'+(section.classList.contains('online-fullscreen')?'Exit fullscreen':'Fullscreen')+'</button></div><div id="online-prompt" role="status"></div><div class="online-playmat">'+player(other,true)+'<div class="phase-banner online-phase"><div><small>TURN '+s.turn+' · '+(s.setup?'MATCH SETUP':!watching&&s.active===p?'YOUR TURN':esc(room.names[s.active])+'’S TURN')+'</small><strong>'+phases[s.phase]+' phase</strong><small>'+esc(s.step||'')+'</small></div><div id="online-waiting">'+(!watching&&s.waitingFor===p?'Waiting for you':'Waiting for '+esc(room.names[s.waitingFor]))+'</div>'+(watching?'':'<button id="online-next" class="primary" '+(s.active!==p||s.auto.attack||s.auto.choice||s.auto.reveal||s.setup||s.manualWindow||s.undoRequest?'disabled':'')+'>Next phase →</button>')+'</div>'+player(p,false)+'</div>'+(s.auto.reveal?'<div class="online-check" aria-live="polite"><h3>'+esc(s.auto.reveal.label)+'</h3>'+api.image(s.auto.reveal.card)+'<p>Player '+(s.auto.reveal.p+1)+' · '+esc(s.auto.reveal.kind)+' check</p></div>':'');
 function player(who,opponent){const z=s.players[who].zones,front=opponent?[...stage.slice(0,3)].reverse():stage.slice(0,3),back=opponent?[...stage.slice(3)].reverse():stage.slice(3);const card=(c,ref)=>c.hidden?'<span class="card-back">W</span>':'<button class="online-card '+esc(c.orientation)+'" data-online-ref="'+esc(JSON.stringify(ref))+'" data-hover-card="'+esc(c.id)+'">'+api.image(c.id)+'</button><button class="online-zoom" data-online-inspect="'+esc(c.id)+'" aria-label="Inspect '+esc(api.name(c.id))+'">⤢</button>';const stageZone=k=>'<div class="zone online-stage"><span>'+esc(api.zoneName(k))+'</span>'+z[k].map(c=>card(c,{p:who,z:k,uid:c.uid})+(s.stats[c.uid]?'<small>Soul '+s.stats[c.uid].soul+' · <strong class="live-power">Power '+s.stats[c.uid].power.toLocaleString()+'</strong></small>':'')).join('')+'<button data-online-pile="'+who+'|markers:'+k+'" class="online-markers">Markers '+z['markers:'+k].length+'</button></div>';const pile=k=>'<button class="zone online-zone" data-online-pile="'+who+'|'+k+'"><span>'+esc(api.zoneName(k)).toUpperCase()+'</span><b>'+z[k].length+'</b>'+(z[k].at(-1)&&!z[k].at(-1).hidden?api.image(z[k].at(-1).id):'')+'</button>';
 return '<section class="online-player '+(opponent?'opponent':'own')+'"><h3><span>'+esc(room.names[who])+(!watching&&who===p?' · YOU':'')+(s.active===who?' · ACTIVE TURN':'')+'</span><span>Level '+z.level.length+' · Clock '+z.clock.length+'</span></h3><div class="online-left">'+['deck','waiting','stock','clock','level','memory'].map(pile).join('')+'</div><div class="online-center"><div class="online-stage-row">'+(opponent?back:front).map(stageZone).join('')+'</div><div class="online-stage-row">'+(opponent?front:back).map(stageZone).join('')+'</div><div class="online-hand"><small>HAND · '+z.hand.length+'</small>'+z.hand.map(c=>'<div>'+card(c,{p:who,z:'hand',uid:c.uid})+'</div>').join('')+'<button data-online-pile="'+who+'|hand">Inspect hand</button></div></div><div class="online-right">'+['climax','resolution'].map(pile).join('')+'</div></section>';}
 if(watching)$('#online-leave').onclick=stopWatching;else{ $('#online-next').onclick=()=>act('advance');$('#online-leave').onclick=()=>command('leave');$('#online-undo').onclick=()=>command('undo-request');$('#online-concede').onclick=()=>{show('<h2>Concede this match?</h2><button id="confirm-concede">Concede</button>');$('#confirm-concede').onclick=()=>{$('#dialog').close();act('concede');};};$('#online-effect').onclick=manualWindow;$('#online-pause').onclick=()=>act('pause');$('#online-tools').onclick=()=>manualTools();}$('#online-fullscreen').onclick=toggleFullscreen;
 el.querySelectorAll('[data-online-pile]').forEach(b=>b.onclick=()=>{const [p,z]=b.dataset.onlinePile.split('|');openPile(+p,z);});el.querySelectorAll('[data-online-inspect]').forEach(b=>b.onclick=()=>api.inspect(b.dataset.onlineInspect));const targets=stageTargetOptions(s.auto.choice);el.querySelectorAll('[data-online-ref]').forEach(b=>{const ref=JSON.parse(b.dataset.onlineRef),target=targets.find(o=>o.ref.uid===ref.uid);b.closest('.online-stage')?.classList.toggle('eligible-ability-target',!!target);b.onclick=()=>target?act('respond',{choice:s.auto.choice.id,value:target.value}):cardMenu(ref,b);});renderPrompt();renderStatus();
 }
 function act(type,args={},onError){return command('act',{type,args},onError);}
 function renderPrompt(){if(!room?.state)return;const s=room.state,p=room.seat,el=$('#online-prompt');abilityPicker(!room.undo&&!s.manualWindow&&!section.hidden?s.auto.choice:null,(value,onError)=>act('respond',{choice:s.auto.choice.id,value},onError),room.id);if(s.auto.gameOver){el.innerHTML='<h2>Match ended</h2><p>'+esc(s.auto.gameOver.reason)+'</p>';return;}if(room.undo){el.innerHTML='<p>Player '+(room.undo.by+1)+' requests an undo. '+(room.undo.revealed?'Cards or random information have been revealed. Both players will still know what they saw.':'')+'</p>'+(room.undo.by!==p?'<button id="undo-yes">Agree</button><button id="undo-no">Decline</button>':'Waiting for your opponent’s agreement.');if($('#undo-yes')){$('#undo-yes').onclick=()=>command('undo-answer',{accept:true});$('#undo-no').onclick=()=>command('undo-answer',{accept:false});}return;}if(s.setup){
 const setup=s.setup;
 if(setup.stage==='roll'||setup.stage==='choose-first'){
  const rolls=setup.rolls.map((value,i)=>esc(room.names[i])+': '+(value??'—')).join(' · ');
  const choosing=setup.stage==='choose-first';
  el.innerHTML='<h3>Opening dice roll</h3><p>'+rolls+'</p>'+(choosing
   ? '<p>'+esc(room.names[setup.p])+' rolled higher and chooses the turn order.</p>'+(setup.p===p?'<button id="dice-first">Go first</button> <button id="dice-second">Go second</button>':'')
   : (setup.tie!==null?'<p>Both rolled '+setup.tie+'. Roll again.</p>':'')+(p>=0&&setup.rolls[p]===null?'<button id="roll-opening-die">Roll die</button>':'<p>Waiting for the remaining roll.</p>'));
  if($('#roll-opening-die'))$('#roll-opening-die').onclick=()=>act('roll-die');
  if($('#dice-first'))$('#dice-first').onclick=()=>act('choose-first',{first:true});
  if($('#dice-second'))$('#dice-second').onclick=()=>act('choose-first',{first:false});
  return;
 }
 el.innerHTML='<p>Opening mulligan · Waiting for '+esc(setup.p===p?'you':room.names[setup.p])+'</p>'+
  (mulliganPending(room)?'<button type="button" id="reopen-mulligan">Open your hand</button>':'');
 if($('#reopen-mulligan'))$('#reopen-mulligan').onclick=()=>{mulliganMinimized=false;renderMulligan();};
 renderMulligan();
 return;
}const c=s.auto.choice;if(s.manualWindow&&!(c&&['level','level-order','rule-order'].includes(c.kind))){el.innerHTML='<p>Manual effect · '+esc(s.manualWindow.reason)+' · '+esc(room.names[s.manualWindow.p])+' must resolve it.</p>'+(s.manualWindow.p===p?'<button id="manual-open">Open manual controls</button><button id="manual-done">Finish effect</button>':'');if($('#manual-open')){$('#manual-open').onclick=manualTools;$('#manual-done').onclick=()=>act('effect-done');}return;}if(c){el.innerHTML='<h3>'+esc(c.title)+'</h3>'+(c.abilityText?'<p class="ability-prompt-text">'+esc(c.abilityText)+'</p>':'')+(c.kind==='auto-manual'?'<button id="open-trigger-manual">Open manual controls</button>':'')+'<div class="online-choices">'+c.options.map((o,i)=>'<button data-answer="'+i+'" '+(o.disabled?'disabled':'')+'>'+(o.card?api.image(o.card):'')+esc(o.label)+'</button>').join('')+'</div>';if($('#open-trigger-manual'))$('#open-trigger-manual').onclick=manualTools;el.insertAdjacentHTML('beforeend','<p id="online-choice-status" role="status"></p>');el.querySelectorAll('[data-answer]').forEach(b=>b.onclick=async()=>{const status=$('#online-choice-status');status.textContent='Resolving…';b.disabled=true;const ok=await act('respond',{choice:c.id,value:c.options[+b.dataset.answer].value},message=>{status.textContent=message;status.classList.add('bad');});if(!ok&&b.isConnected)b.disabled=false;});}else el.innerHTML=s.auto.notice?'<p class="ability-prompt-text" role="status">'+esc(s.auto.notice)+'</p>':s.choiceOwner!==null?'<p>Waiting for '+esc(room.names[s.choiceOwner])+' to make a choice.</p>':'';}

 let cardActions=null,cardAnchor=null;
 function closeCardActions(){cardActions?.remove();cardActions=null;cardAnchor=null;}
 document.addEventListener('click',event=>{
  if(cardActions&&!cardActions.contains(event.target)&&!cardAnchor?.contains(event.target))closeCardActions();
 });
 document.addEventListener('keydown',event=>{
  if(event.key==='Escape'&&cardActions){event.preventDefault();const anchor=cardAnchor;closeCardActions();anchor?.focus();}
 });
 function showCardActions(anchor,title,actions,more){
  closeCardActions();
  cardAnchor=anchor;
  const menu=cardActions=document.createElement('div');
  menu.className='online-card-actions';
  menu.setAttribute('role','group');
  menu.setAttribute('aria-label',title);
  const buttons=(list,offset=0)=>list.map(([label],i)=>'<button data-card-action="'+(offset+i)+'">'+esc(label)+'</button>').join('');
  menu.innerHTML='<b>'+esc(title)+'</b>'+buttons(actions)+(more.length?'<details><summary>More destinations and effects</summary>'+buttons(more,actions.length)+'</details>':'');
  const dialog=$('#dialog');
  (dialog.open?dialog:section).append(menu);
  const rect=anchor.getBoundingClientRect();
  menu.style.left=Math.max(8,Math.min(rect.left,window.innerWidth-menu.offsetWidth-8))+'px';
  const positionMenu=()=>{menu.style.top=Math.max(8,Math.min(rect.bottom+5,window.innerHeight-menu.offsetHeight-8))+'px';};
  positionMenu();
  menu.querySelector('details')?.addEventListener('toggle',positionMenu);
  const handlers=[...actions,...more];
  menu.querySelectorAll('[data-card-action]').forEach(button=>button.onclick=()=>{
   closeCardActions();
   handlers[+button.dataset.cardAction][1]();
  });
  menu.querySelector('button')?.focus({preventScroll:true});
 }
 function toggleCardSelection(ref){
  const index=selections.findIndex(r=>r.uid===ref.uid);
  if(index>=0)selections.splice(index,1);else selections.push(ref);
  renderPrompt();
  section.querySelectorAll('[data-online-ref]').forEach(e=>e.classList.toggle('selected',selections.some(r=>r.uid===JSON.parse(e.dataset.onlineRef).uid)));
  document.querySelectorAll('[data-pile-card]').forEach(e=>e.classList.toggle('selected',selections.some(r=>r.uid===e.dataset.pileCard)));
  if($('#online-selected-tools'))$('#online-selected-tools').textContent='Manual actions ('+selections.length+')';
 }
 function cardMenu(ref,anchor){
  const s=room.state,p=room.seat;
  const c=peek?.p===ref.p&&peek.z===ref.z?peek.cards.find(x=>x.uid===ref.uid):s.players[ref.p].zones[ref.z].find(x=>x.uid===ref.uid);
  if(!c||c.hidden)return;
  const info=api.card(c.id),own=ref.p===p,isStage=stage.includes(ref.z);
  const actions=[['Inspect card',()=>api.inspect(c.id)]],more=[];
  if(s.setup){
   if(own&&ref.z==='hand'&&s.setup.p===p&&(!s.setup.stage||s.setup.stage==='mulligan')){
    actions.push([selections.some(r=>r.uid===ref.uid)?'Keep this card':'Select for mulligan',()=>toggleCardSelection(ref)]);
   }
  }else if(!s.auto.gameOver){
   const choice=s.auto.choice;
   if(choice)for(const option of choice.options){
    if(option.ref?.uid===ref.uid||option.value===ref.uid)actions.push([option.label,()=>act('respond',{choice:choice.id,value:option.value})]);
   }
   if(!own)return showCardActions(anchor,api.name(c.id)+' · '+api.zoneName(ref.z),actions,more);
   const current=s.active===p&&!s.auto.attack&&!s.auto.choice&&!s.auto.reveal&&!s.auto.paused&&!s.manualWindow&&!s.undoRequest;
   const abilities=activatedAbilities(info);
   if(info)actions.push(['Activate ability…',()=>openAbilities(ref,info,abilities,current)]);
   const manualAllowed=!s.undoRequest&&!s.auto.reveal&&(s.manualWindow?.p===p||s.choiceOwner===p&&['manual-counter','encore-manual','unknown-icon','auto-manual'].includes(s.auto.choice?.kind)||!s.manualWindow&&!s.auto.attack&&!s.auto.choice&&!s.auto.paused&&s.choiceOwner==null);
   if(ref.z==='hand'&&current){
    if(s.phase===2&&s.clockedTurn!==s.turn)actions.push(['Clock this card and draw two',()=>act('clock',{ref})]);
    if(info&&(info.type==='Climax'?s.phase===4:s.phase===3)){
     actions.push(['Play '+info.type.toLowerCase(),()=>playOnlineCard(ref,info)]);
    }
   }
   if(isStage){
    if(current&&s.phase===5&&s.step==='Attack declaration'&&ref.z.startsWith('center')&&c.orientation==='stand'&&!(s.turn===1&&s.attacksThisTurn>=1)){
     for(const type of (s.players[1-p].zones[facingPosition(ref.z)].length?(abilityLines(info).some(noSideAttack)?['frontal']:['frontal','side']):['direct'])){
      actions.push([type[0].toUpperCase()+type.slice(1)+' attack',()=>act('attack',{ref,attackType:type})]);
     }
    }
    if(current&&s.phase===3)actions.push(['Change stage position',()=>chooseStage(to=>act('reposition',{ref,to}))]);
    if(s.stats[c.uid])actions.push(['Soul / power breakdown',()=>show(modifierBreakdown(s.stats[c.uid],s.turn))]);
   }
   if(manualAllowed){
    const run=(action,options={})=>runCardEffect(ref,action,options);
    if(isStage&&info?.type==='Character')actions.push(...statAdjustments.map(option=>[
     option.label,()=>run('manual-modifier',{stat:option.stat,amount:option.amount,duration:option.duration,label:option.label+' ('+option.stat+')'})
    ]));
    const movement=cardMoveOptions.filter(([to])=>to!==ref.z||['deck','stock','clock'].includes(to));
    const move=([to,position,label])=>[label,()=>run('manual-move',{to,position})];
    actions.push(...movement.map(move));
    actions.push(['Place on stage…',()=>chooseStage(to=>run('manual-move',{to,position:'top'}),
     stage.filter(to=>to!==ref.z&&!s.players[p].zones[to].length))]);
    for(const to of stage){
     more.push(move(['markers:'+to,'top','Place as marker under '+api.zoneName(to)]));
    }
    if(isStage)for(const orientation of ['stand','rest','reverse']){
     if(c.orientation!==orientation)actions.push([orientation[0].toUpperCase()+orientation.slice(1)+' character',()=>run('manual-orient',{orientation})]);
    }
    actions.push([c.revealed?'Stop revealing card':'Reveal card',()=>run('manual-reveal',{reveal:!c.revealed})]);
    more.push(['Flip face up / down',()=>run('manual-flip')]);
    more.push(['Select / deselect for multiple cards',()=>toggleCardSelection(ref)]);
    more.push(['Select and open manual controls',()=>{selections=[ref];manualTools();}]);
   }
  }
  showCardActions(anchor,api.name(c.id)+' · '+api.zoneName(ref.z),actions,more);
 }
 function playOnlineCard(ref,card){
  const s=room.state;
  const error=playFromHandError(card,s.players[ref.p].zones,s.phase,api.card);
  if(error)return api.toast(error);
  const pay=to=>{
   const cost=card.type==='Climax'?0:Number(card.cost)||0;
   if(!cost)return act('play',{ref,to});
   show('<h2>Pay '+cost+' Stock?</h2><p>Play '+esc(api.name(card.id))+' and move '+cost+' cards from the top of your Stock to your Waiting Room.</p><button class="primary" id="online-pay-play">Pay '+cost+' Stock and play</button>');
   $('#online-pay-play').onclick=()=>{$('#dialog').close();act('play',{ref,to});};
  };
  return card.type==='Character'?chooseStage(pay):pay();
 }
 function openAbilities(ref,card,abilities,current){
  if(!abilities.length){
   show('<h2>Activate ability</h2><p>This card has no activated (ACT) abilities. AUTO abilities trigger at their stated timing, and CONT abilities apply while their conditions are met.</p><button id="online-read-ability-card">Read card</button>');
   $('#online-read-ability-card').onclick=()=>api.inspect(card.id);
   return;
  }
  const s=room.state,choice=s.auto.choice;
  const backup=choice?.kind==='counter'&&choice.options.find(o=>o.value===ref.uid&&o.backup);
  const canActivate=current&&s.phase===3&&stage.includes(ref.z);
  show('<h2>Activate ability</h2><p>Choose an ACT ability. Automatic actions pay the printed cost and ask for targets when needed.</p><p id="online-ability-status" role="status"></p>'+abilities.map(({text,action},i)=>{
   const auto=action||backup&&parseAbility(text)?.kind==='backup';
   const reason=action?(s.activation?.[ref.uid]?.[i]||(!canActivate?'Use during your Main phase after pending effects finish.':'')):'';
   const unavailable=!!reason;
   return '<p>'+esc(text)+'</p><button data-online-ability="'+i+'" '+(unavailable?'disabled':'')+'>'+(unavailable?'Unavailable':auto?'Activate':'Resolve manually')+'</button>'+(reason?'<p class="muted">'+esc(reason)+'</p>':'');
  }).join(''));
  document.querySelectorAll('[data-online-ability]').forEach(button=>button.onclick=async()=>{
   const selected=abilities[+button.dataset.onlineAbility];
   const status=$('#online-ability-status');
   const report=message=>{status.textContent=message;status.classList.add('bad');};
   status.textContent='Checking ability…';
   status.classList.remove('bad');
   button.disabled=true;
   let accepted;
   if(selected.action)accepted=await act('activate',{ref,index:selected.index},report);
   else if(backup&&parseAbility(selected.text)?.kind==='backup')accepted=await act('respond',{choice:choice.id,value:backup.value},report);
   else{
    const reason=(card.code+' · '+selected.text).slice(0,400);
    accepted=await act('effect-request',{player:room.seat,reason},report);
   }
   if(accepted&&status.isConnected&&$('#dialog').open)$('#dialog').close();
   else if(button.isConnected)button.disabled=false;
  });
 }
 function chooseStage(fn,positions=stage){show('<h2>Choose a stage position</h2>'+(positions.length?positions.map((z,i)=>'<button data-stage-choice="'+i+'">'+esc(api.zoneName(z))+'</button>').join(''):'<p>There are no open stage positions. Move a character off the stage first.</p>'));document.querySelectorAll('[data-stage-choice]').forEach(b=>b.onclick=()=>{$('#dialog').close();fn(positions[+b.dataset.stageChoice]);});}
 async function openPile(p,z,mode){const own=p===room.seat,privateZone=['deck','stock'].includes(z);let cards=room.state.players[p].zones[z];peek=null;if(own&&z==='deck'&&mode!=='search')return openOwnDeck(p,cards.length);if(own&&privateZone&&room.state.manualWindow?.p!==room.seat){show('<h2>'+esc(api.zoneName(z))+'</h2><p>'+cards.length+' cards. A private search requires a manual effect window and is visible to both players.</p><button id="begin-private-search">Begin manual search</button>');$('#begin-private-search').onclick=async()=>{$('#dialog').close();await act('effect-request',{player:room.seat,reason:'Privately search / inspect own '+api.zoneName(z)+' for a card effect'});if(room.state.manualWindow?.p===room.seat)openPile(p,z,mode);};return;}if(own&&privateZone){try{cards=(await call('peek',{room:room.id,player:p,zone:z})).cards;peek={p,z,cards};}catch(e){return api.toast(e.message);}}const masked=cards.every(c=>c.hidden);show('<h2>'+esc(room.names[p])+' · '+esc(api.zoneName(z))+'</h2><p>'+cards.length+' cards'+(z==='deck'?' · search view is sorted, not deck order':' · bottom to top')+'</p><label>Search pile<input id="online-pile-search"></label><div class="toolbar">'+(own?'<button id="online-select-all">Select all visible</button><button id="online-selected-tools">Manual actions ('+selections.length+')</button>':'')+'</div><div class="pile-grid" id="online-pile-grid"></div>');$('#dialog').dataset.kind=z==='hand'?'hand':'other';function fill(){const q=$('#online-pile-search').value.toLowerCase();$('#online-pile-grid').innerHTML=cards.filter(c=>!q||!c.hidden&&api.name(c.id).toLowerCase().includes(q)).map(c=>'<div class="pile-card"><button data-pile-card="'+esc(c.uid)+'">'+(c.hidden?'<span class="card-back">W</span>':api.image(c.id))+'</button>'+(!c.hidden?'<button data-pile-inspect="'+esc(c.id)+'">Inspect</button>':'')+'</div>').join('');document.querySelectorAll('[data-pile-card]').forEach(b=>b.onclick=()=>{const c=cards.find(c=>c.uid===b.dataset.pileCard);if(c.hidden)return;cardMenu({p,z,uid:c.uid},b);});document.querySelectorAll('[data-pile-inspect]').forEach(b=>b.onclick=()=>api.inspect(b.dataset.pileInspect));}fill();$('#online-pile-search').oninput=fill;if(own){$('#online-selected-tools').onclick=manualTools;$('#online-select-all').onclick=()=>{selections=cards.filter(c=>!c.hidden).map(c=>({p,z,uid:c.uid}));$('#online-selected-tools').textContent='Manual actions ('+selections.length+')';};}}
 async function ensureDeckEffect(p,reason){
  if(room.state.manualWindow?.p===p)return true;
  if(room.state.manualWindow){api.toast('Wait for the other player to finish their effect.');return false;}
  return !!await act('effect-request',{player:p,reason})&&room.state.manualWindow?.p===p;
 }
 function openOwnDeck(p,count){
  show('<h2>Your deck</h2><p>'+count+' cards. Looking at cards is private. Revealing a card makes it visible to your opponent.</p>'+(count?'<form id="online-look-count"><label>Number of top cards <input type="number" name="count" min="1" max="'+Math.min(50,count)+'" value="1" required></label> <button type="submit">Look at top cards</button></form><button id="online-deck-search">Search deck without seeing its order</button>':''));
  const form=$('#online-look-count');
  if(!form)return;
  form.onsubmit=async event=>{
   event.preventDefault();
   const topCount=Number(form.elements.count.value);
   if(!Number.isInteger(topCount)||topCount<1||topCount>Math.min(50,count))return api.toast('Enter a valid number of cards to look at.');
   const button=form.querySelector('button');
   button.disabled=true;
   try{
    const roomId=room.id;
    if(!await ensureDeckEffect(p,'Look privately at the top '+topCount+' card(s) of the deck'))return;
    if(room?.id!==roomId||!form.isConnected||!$('#dialog').open)return;
    const version=room.version;
    const {cards}=await call('peek',{room:roomId,player:p,zone:'deck',topCount});
    if(room?.id!==roomId||room.version!==version||!form.isConnected||!$('#dialog').open)return;
    peek={p,z:'deck',cards,top:true};
    renderOnlineLook();
   }catch(error){api.toast(error.message);}
   finally{button.disabled=false;}
  };
  $('#online-deck-search').onclick=()=>openPile(p,'deck','search');
 }
 function renderOnlineLook(){
  const {p,cards}=peek;
  show('<h2>Looked-at deck cards</h2><p>Original order, top card first. Click a card for its actions.</p><div class="pile-grid" id="online-looked-cards">'+cards.map(c=>'<div class="pile-card"><button class="art-button" data-look-card="'+esc(c.uid)+'">'+api.image(c.id)+'</button><button type="button" data-online-look-reveal="'+esc(c.uid)+'">'+(c.revealed?'Hide':'Reveal')+'</button></div>').join('')+'</div><div class="toolbar"><button id="finish-top-look">Finish effect</button><button id="back-to-online-deck">Back to deck</button></div>');
  document.querySelectorAll('[data-look-card]').forEach(button=>button.onclick=()=>cardMenu({p,z:'deck',uid:button.dataset.lookCard},button));
  document.querySelectorAll('[data-online-look-reveal]').forEach(button=>button.onclick=()=>{
   const card=cards.find(c=>c.uid===button.dataset.onlineLookReveal);
   return runCardEffect({p,z:'deck',uid:card.uid},'manual-reveal',{reveal:!card.revealed});
  });
  $('#finish-top-look').onclick=async()=>{if(await act('effect-done')){$('#dialog').close();peek=null;}};
  $('#back-to-online-deck').onclick=()=>openPile(p,'deck');
 }
 async function runCardEffect(ref,action,options){
  const looked=peek?.top&&peek.p===ref.p&&peek.z===ref.z?peek:null;
  const ok=await act('card-effect',{ref,action,...options});
  if(!ok||!looked||peek!==looked||!$('#online-looked-cards')||!$('#dialog').open)return;
  const card=looked.cards.find(c=>c.uid===ref.uid);
  if(action==='manual-move')looked.cards=looked.cards.filter(c=>c.uid!==ref.uid);
  if(action==='manual-reveal'&&card)card.revealed=options.reveal;
  if(action==='manual-flip'&&card){card.faceDown=!card.faceDown;card.revealed=false;}
  renderOnlineLook();
 }
 function manualWindow(){show('<h2>Resolve a manual card effect</h2><p>Describe the printed effect. The instructed player receives the controls, even when they are your opponent. Unsupported conditions and costs must be checked by both players.</p><label>Player instructed to act<select id="effect-player"><option value="'+room.seat+'">You</option><option value="'+(1-room.seat)+'">Opponent</option></select></label><label>Card / effect description<input id="effect-reason" maxlength="400"></label><button id="effect-start">Begin manual effect</button>');$('#effect-start').onclick=()=>{const args={player:+$('#effect-player').value,reason:$('#effect-reason').value};$('#dialog').close();act('effect-request',args);};}
 function manualTools(){const s=room.state,p=room.seat,allowed=s.manualWindow?.p===p||['manual-counter','encore-manual','unknown-icon','auto-manual'].includes(s.auto.choice?.kind)&&s.choiceOwner===p;if(!allowed)return manualWindow();show('<h2>Manual effect controls</h2><p>'+selections.length+' cards selected, in selection order. Only your own cards may be changed. To instruct the opponent, finish this window and request an effect for them.</p><label>Destination<select id="manual-destination">'+zones.map(z=>'<option>'+esc(z)+'</option>').join('')+'</select></label><label>Placement<select id="manual-position"><option value="top">Top / last</option><option value="bottom">Bottom / first</option></select></label><button id="manual-move">Move selected</button><div class="toolbar"><button data-orient="stand">Stand</button><button data-orient="rest">Rest</button><button data-orient="reverse">Reverse</button><button id="manual-reveal">Reveal selected</button><button id="manual-hide">Hide selected</button><button id="manual-flip">Flip face up / down</button><button id="manual-shuffle">Shuffle your deck</button><button id="manual-cost">Begin / finish paying cost</button></div><label>Amount<input id="manual-amount" type="number" min="1" max="50" value="1"></label><button id="manual-draw">Draw cards</button><button id="manual-damage">Take separate damage</button><label>Modifier<select id="modifier-stat"><option>soul</option><option>power</option><option>level</option></select></label><label>Value<input id="modifier-value" type="number" value="1"></label><label>Effect label<input id="modifier-label" maxlength="200"></label><label>Duration<select id="modifier-duration"><option value="turn">Until end of turn</option><option value="persistent">Until manually removed</option></select></label><button id="manual-modifier">Apply to first selected character</button><div>'+s.auto.effects.filter(e=>e.p===p).map(e=>'<p>'+esc(e.label)+' <button data-remove-modifier="'+s.auto.effects.indexOf(e)+'">Remove</button></p>').join('')+'</div><label>Correct phase<select id="manual-phase">'+phases.map((name,i)=>'<option value="'+i+'">'+name+'</option>').join('')+'</select></label><button id="manual-set-phase">Apply phase correction</button><p>To select more cards, close this dialog and inspect a pile. The effect window stays open.</p>');const run=(t,args)=>{$('#dialog').close();act(t,args);};$('#manual-set-phase').onclick=()=>run('manual-phase',{phase:+$('#manual-phase').value});$('#manual-move').onclick=()=>run('manual-move',{refs:selections,to:$('#manual-destination').value,position:$('#manual-position').value});document.querySelectorAll('[data-orient]').forEach(b=>b.onclick=()=>run('manual-orient',{refs:selections,orientation:b.dataset.orient}));$('#manual-reveal').onclick=()=>run('manual-reveal',{refs:selections,reveal:true});$('#manual-hide').onclick=()=>run('manual-reveal',{refs:selections,reveal:false});$('#manual-flip').onclick=()=>run('manual-flip',{refs:selections});$('#manual-shuffle').onclick=()=>run('manual-shuffle');$('#manual-cost').onclick=()=>run('manual-cost',{paying:!s.cost});$('#manual-draw').onclick=()=>run('manual-draw',{amount:+$('#manual-amount').value});$('#manual-damage').onclick=()=>run('manual-damage',{amount:+$('#manual-amount').value});$('#manual-modifier').onclick=()=>run('manual-modifier',{ref:selections[0],stat:$('#modifier-stat').value,amount:+$('#modifier-value').value,label:$('#modifier-label').value,duration:$('#modifier-duration').value});document.querySelectorAll('[data-remove-modifier]').forEach(b=>b.onclick=()=>run('manual-remove-modifier',{index:+b.dataset.removeModifier}));}
 try{const {createClient}=await loadAuth();client=createClient(config.url,config.key,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});client.auth.onAuthStateChange((event,session)=>{user=session?.user||null;account.textContent=user?'My account':'Account';titleAccount.textContent=user?'My account':'Account';if(event==='PASSWORD_RECOVERY'){recovery=true;setTimeout(accountDialog,0);}if(event==='SIGNED_OUT'){closeMulligan();room=null;cloud=[];renderRail();if(document.body.dataset.view==='online')api.view('home');}});const {data:{session}}=await client.auth.getSession();user=session?.user||null;if(user){try{await syncAccount();}catch{api.toast('Account decks could not sync. Your browser decks are still available.');}const rid=localStorage.getItem('ws-online-room');if(rid){try{const old=await call('state',{room:rid});room=old;lastVersion=-1;await command('reconnect');}catch{localStorage.removeItem('ws-online-room');}}}timer=setInterval(()=>{if(room&&document.visibilityState==='visible')poll();},1200);window.addEventListener('online',poll);document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')poll();});document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&!document.documentElement.classList.contains('mobile-mode')){section.classList.remove('online-fullscreen');const button=$('#online-fullscreen');if(button)button.textContent='Fullscreen';api.updateInspector?.();}});}catch(e){api.toast('Account service unavailable. Practice and local decks still work.');account.onclick=()=>api.toast(e.message);}
}
