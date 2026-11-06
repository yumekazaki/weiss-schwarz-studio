import {createMatch,draw,move,shuffle,validate,stage,zones,playFromHandError} from './engine.mjs';
import {createResolver,stageKeys} from './automation.mjs';
const copy=x=>structuredClone(x);
const need=(ok,msg)=>{if(!ok)throw Error(msg);};
const knowledge=s=>JSON.stringify([s.players.map(p=>['deck','hand','stock'].map(z=>p.zones[z].map(c=>[c.uid,c.revealed]))),s.auto?.choice?.looked,s.auto?.choice?.kind==='ability-search'?s.auto.choice.options.map(o=>o.value):null]);
function randomBelow(range){const limit=Math.floor(4294967296/range)*range;let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=limit);return n%range;}
export function secureShuffle(a){for(let i=a.length-1;i>0;i--){const j=randomBelow(i+1);[a[i],a[j]]=[a[j],a[i]];}return a;}
export function choiceOwner(s){const c=s.auto?.choice;if(!c)return null;if(Number.isInteger(c.p))return c.p;if(Number.isInteger(c.task?.p))return c.task.p;
 if(['icon-order','unknown-icon'].includes(c.kind))return s.auto.attack?.p;
 if(c.kind==='choice-destination')return c.ref?.p;
 if(c.kind==='encore-select')return c.options[0]?.ref?.p;
 if(c.kind==='encore-manual')return s.onlineManualOwner;
 throw Error('Unmapped decision owner: '+c.kind);
}
export function initialize(decks,catalog){for(const d of decks){const v=validate(d.cards,catalog,d.format,d.language);need(!v.errors.length,v.errors.join('; '));}
 const s=createMatch(decks.map(d=>d.cards));
 for(const player of s.players)secureShuffle(player.zones.deck);
 s.deckNames=decks.map(d=>d.name);s.setup={stage:'roll',rolls:[null,null],tie:null,p:0};s.onlineEpoch=0;s.events=[];s.auto={queue:[],choice:null,serial:0,effects:[],shots:[],results:[],enabled:true,optionalTop:'ask',reviews:[],reveal:null};return s;
}
export function ownedRef(s,p,r){need(r&&r.p===p&&zones.includes(r.z)&&typeof r.uid==='string','You may act only on your own cards.');const c=s.players[p].zones[r.z].find(c=>c.uid===r.uid);need(c,'That card is no longer in the selected zone.');return c;}
function resolverFor(catalog){return createResolver(catalog);}
function event(s,p,type,args,previous){const locations=t=>new Map(t.players.flatMap((player,p)=>Object.entries(player.zones).flatMap(([z,cards])=>cards.map(c=>[c.uid,{p,z}]))));const before=previous?locations(previous):new Map(),changes=[];for(const [uid,to] of locations(s)){const from=before.get(uid);if(from&&(from.p!==to.p||from.z!==to.z))changes.push({uid,from,to});}s.events??=[];s.events.unshift({id:crypto.randomUUID(),actor:p,type,turn:s.turn,phase:s.phase,refs:copy(args.refs||args.ref&&[args.ref]||[]),changes,choicePlayer:choiceOwner(s)});s.events=s.events.slice(0,100);s.log.unshift('T'+s.turn+' · Player '+(p+1)+' · '+type);s.log=s.log.slice(0,150);}
export function tick(s,catalog,now=Date.now()){const r=resolverFor(catalog),a=r.auto(s),before=knowledge(s);if(s.setup||s.manualWindow||s.undoRequest||a.paused)return false;if(a.reveal){s.revealUntil??=now+900;if(now<s.revealUntil)return false;r.finishReveal(s,a.reveal.id);delete s.revealUntil;}else if(a.queue.length&&!a.choice)r.run(s);else return false;if(a.reveal)s.revealUntil=now+900;if(knowledge(s)!==before)s.onlineEpoch=(s.onlineEpoch||0)+1;return true;}
export function reduce(original,p,type,args,catalog){need(p===0||p===1,'Invalid seat.');const s=copy(original),r=resolverFor(catalog),a=r.auto(s),own=s.players[p].zones;args=args||{};
 const checkOwn=ref=>ownedRef(s,p,ref),refs=()=>{need(Array.isArray(args.refs)&&args.refs.length>0&&args.refs.length<=50,'Select cards.');need(new Set(args.refs.map(x=>x.uid)).size===args.refs.length,'Duplicate selected card.');args.refs.forEach(checkOwn);return args.refs;};
 const num=(n,max=50)=>{need(Number.isInteger(n)&&n>=1&&n<=max,'Invalid amount.');return n;};
 if(type==='concede'){a.gameOver={players:[p],reason:'Player '+(p+1)+' conceded.'};a.choice=null;a.queue=[];a.reveal=null;event(s,p,type,args,original);return s;}
 need(!a.gameOver,'The match has ended.');
 if(s.setup){
  const setup=s.setup;
  if(setup.stage==='roll'){
   need(type==='roll-die'&&setup.rolls[p]===null,'Wait for the other die roll.');
   setup.rolls[p]=1+randomBelow(6);
   if(setup.rolls[1-p]===null)setup.p=1-p;
   else if(setup.rolls[0]===setup.rolls[1]){
    setup.tie=setup.rolls[0];setup.rolls=[null,null];setup.p=0;
   }else{
    setup.stage='choose-first';setup.p=setup.rolls[0]>setup.rolls[1]?0:1;
   }
  }else if(setup.stage==='choose-first'){
   need(type==='choose-first'&&p===setup.p&&typeof args.first==='boolean','The higher roller chooses who goes first.');
   s.first=s.active=args.first?p:1-p;
   for(let seat=0;seat<2;seat++)draw(s,seat,5);
   s.setup={...setup,stage:'mulligan',done:[false,false],p:s.active};
  }else{
   need(type==='mulligan'&&p===setup.p,'Waiting for Player '+(setup.p+1)+' to mulligan.');
   const rr=args.refs?.length?refs():[];
   need(rr.every(x=>x.z==='hand'),'Mulligan uses hand cards.');
   move(s,rr,p,'waiting');
   draw(s,p,rr.length);
   setup.done[p]=true;
   if(!setup.done[1-p])setup.p=1-p;
   else{delete s.setup;r.advance(s);}
  }
  s.onlineEpoch++;
  event(s,p,type,args,original);
  return s;
 }
 need(!s.undoRequest,'An undo request is awaiting agreement.');
 if(type==='pause'){need(!s.manualWindow,'A manual effect is already open.');s.manualWindow={p,by:p,reason:'Paused for card effects / manual correction',previousPaused:!!a.paused};a.paused=true;event(s,p,type,args,original);return s;}
 const decision=choiceOwner(s),manualChoice=['manual-counter','encore-manual','unknown-icon','auto-manual'].includes(a.choice?.kind),windowOwner=s.manualWindow?.p;
 if(type==='card-effect'){
  need(['manual-move','manual-orient','manual-reveal','manual-flip'].includes(args.action),'Invalid card action.');
  checkOwn(args.ref);
  if(s.manualWindow || a.choice)return reduce(original,p,args.action,{...args,refs:[args.ref]},catalog);
  need(!a.reveal&&!a.attack&&!a.queue.length&&!a.paused,'Finish the current resolution or open a manual effect window first.');
  const opened=reduce(original,p,'effect-request',{player:p,reason:'Manual card action'},catalog);
  const changed=reduce(opened,p,args.action,{...args,refs:[args.ref]},catalog);
  return reduce(changed,p,'effect-done',{},catalog);
 }
 if(type==='effect-request'){need(!s.manualWindow&&!a.reveal,'Finish the existing effect/check first.');need(decision===null||decision===p,'Waiting for the other player.');need(typeof args.reason==='string'&&args.reason.trim().length>=3&&args.reason.length<=400,'Describe the printed effect and who must act.');need(args.player===0||args.player===1,'Choose the affected player.');s.manualWindow={p:args.player,by:p,reason:args.reason,previousPaused:!!a.paused};a.paused=true;event(s,p,type,{...args,refs:[]},original);return s;}
 if(type==='effect-done'){need(windowOwner===p,'Only the player resolving this effect can finish it.');need(!s.cost,'Finish paying the cost first.');a.paused=s.manualWindow.previousPaused;delete s.manualWindow;r.afterMutation(s);event(s,p,type,args,original);return s;}
 const manual=type.startsWith('manual-');
 if(manual&&a.choice&&!manualChoice)throw Error('Finish the pending required decision before making manual changes.');
 if(s.manualWindow)need(manual&&windowOwner===p||type==='respond'&&decision===p,'Waiting for the instructed player to resolve the manual effect.');
 else if(manual)need(manualChoice&&decision===p,'Open a manual effect window first. Both players can see who is resolving it.');
 else if(type==='respond'){need(decision===p,'This decision belongs to Player '+(decision+1)+'.');}
 else need(decision===null&&!a.reveal&&!a.attack&&!a.queue.length&&!a.paused,'A resolution is pending.');
 if(!manual&&type!=='respond')need(s.active===p,'It is the other player’s turn.');
 const before=copy(s);
 if(type==='respond'){const c=a.choice;need(args.choice===c.id,'That decision has already resolved.');if(c.kind==='encore-offer'&&args.value==='manual')s.onlineManualOwner=p;r.respond(s,args.choice,String(args.value));}
 else if(type==='advance')r.advance(s);
 else if(type==='activate'){checkOwn(args.ref);need(Number.isInteger(args.index)&&args.index>=0,'Choose an activated ability.');r.activate(s,args.ref,args.index);}
 else if(type==='attack'){checkOwn(args.ref);need(['frontal','side','direct'].includes(args.attackType),'Invalid attack type.');r.beginAttack(s,args.ref,args.attackType);}
 else if(type==='clock'){need(s.phase===2&&s.clockedTurn!==s.turn,'Clock only once during clock phase.');const c=checkOwn(args.ref);need(args.ref.z==='hand','Choose a hand card.');move(s,[args.ref],p,'clock');s.clockedTurn=s.turn;r.drawCards(s,p,2);s.onlineEpoch++;}
 else if(type==='play'){need([3,4].includes(s.phase),'Cards are played during main or climax phase.');const c=checkOwn(args.ref),d=catalog.get(c.id);need(args.ref.z==='hand','Play a card from hand.');
 const error=playFromHandError(d,own,s.phase,id=>catalog.get(id));
 need(!error,error);
 const cost=d.type==='Climax'?0:Number(d.cost)||0;
 for(let i=0;i<cost;i++)move(s,[{p,z:'stock',uid:own.stock.at(-1).uid}],p,'waiting');
 c.faceDown=false;
 if(d.type==='Character'){need(stageKeys.includes(args.to),'Select a stage position.');if(own[args.to].length)move(s,own[args.to].map(c=>({p,z:args.to,uid:c.uid})),p,'waiting');own.waiting.push(...own['markers:'+args.to].splice(0));move(s,[args.ref],p,args.to);}
 else if(d.type==='Climax')move(s,[args.ref],p,'climax');else{move(s,[args.ref],p,'resolution');s.manualWindow={p,by:p,reason:'Resolve event '+d.code,previousPaused:false};a.paused=true;}
 r.afterMutation(s,before);}
 else if(type==='reposition'){need(s.phase===3&&stageKeys.includes(args.to),'Reposition in main phase.');checkOwn(args.ref);need(stage(args.ref.z),'Choose a stage character.');[own[args.ref.z],own[args.to]]=[own[args.to],own[args.ref.z]];[own['markers:'+args.ref.z],own['markers:'+args.to]]=[own['markers:'+args.to],own['markers:'+args.ref.z]];r.afterMutation(s,before);}
 else if(type==='manual-move'){const rr=refs();need(zones.includes(args.to),'Invalid destination.');need(!stage(args.to)||rr.length===1&&(!own[args.to].length||rr[0].z===args.to),'Use an empty stage position.');move(s,rr,p,args.to,args.position==='bottom'?'bottom':'top');if(args.reveal)for(const c of own[args.to].filter(c=>rr.some(x=>x.uid===c.uid)))c.revealed=true;s.onlineEpoch++;}
 else if(type==='manual-orient'){const rr=refs();need(['stand','rest','reverse'].includes(args.orientation),'Invalid orientation.');for(const ref of rr){need(stage(ref.z),'Only stage cards have battle orientation.');checkOwn(ref).orientation=args.orientation;}}
 else if(type==='manual-reveal'){for(const ref of refs()){const c=checkOwn(ref);c.revealed=!!args.reveal;}s.onlineEpoch++;}
 else if(type==='manual-flip'){for(const ref of refs()){const c=checkOwn(ref);c.faceDown=!c.faceDown;c.revealed=false;}s.onlineEpoch++;}
 else if(type==='manual-draw'){r.drawCards(s,p,num(args.amount));s.onlineEpoch++;}
 else if(type==='manual-shuffle'){secureShuffle(own.deck);s.onlineEpoch++;}
 else if(type==='manual-cost'){need(!s.cost||s.costOwner===p,'This cost belongs to the other player.');s.cost=!!args.paying;s.costOwner=s.cost?p:null;}
 else if(type==='manual-damage'){need(!a.damage&&!a.reveal,'Finish current damage first.');r.damage(s,p,num(args.amount));}
 else if(type==='manual-modifier'){checkOwn(args.ref);need(stage(args.ref.z),'Choose a character.');need(['soul','power','level'].includes(args.stat)&&Number.isInteger(args.amount)&&Math.abs(args.amount)<=100000,'Invalid modifier.');need(typeof args.label==='string'&&args.label.length<=200,'Label the effect.');r.manualEffect(s,args.ref,{[args.stat]:args.amount},args.label,args.duration==='persistent'?'persistent':'turn');}
 else if(type==='manual-remove-modifier'){need(Number.isInteger(args.index)&&a.effects[args.index]?.p===p,'Only remove your own modifier.');a.effects.splice(args.index,1);}
 else if(type==='manual-phase'){need(p===s.active&&!a.choice&&!a.attack&&!a.reveal&&!a.queue.length,'Phase correction requires a clear resolution and the active player.');need(Number.isInteger(args.phase)&&args.phase>=0&&args.phase<=6,'Invalid phase.');s.phase=args.phase;}
 else throw Error('Unsupported command.');
 if(type==='manual-move'||type==='manual-orient')r.afterMutation(s,before);
 if(manual&&!s.cost)r.ruleInterrupts(s);
 if(a.reveal)s.revealUntil=Date.now()+900;
 if(s.clockedTurn&&s.clockedTurn!==s.turn)delete s.clockedTurn;
 const count=t=>t.players.flatMap(p=>Object.values(p.zones).flat()).map(c=>c.uid).sort().join('|');need(count(s)===count(original),'Card conservation failed.');
 if(knowledge(s)!==knowledge(original))s.onlineEpoch=Math.max(s.onlineEpoch||0,original.onlineEpoch||0)+1;
 event(s,p,type,args,original);return s;
}
export function project(s,seat,catalog){const out=copy(s),r=resolverFor(catalog);out.stats={};for(let p=0;p<2;p++)for(const z of stageKeys){const c=s.players[p].zones[z][0];if(c&&(!c.faceDown||p===seat||c.revealed))out.stats[c.uid]=r.stats(s,{p,z,uid:c.uid});}
 for(let p=0;p<2;p++)for(const [z,arr] of Object.entries(out.players[p].zones)){const hideAll=z==='deck'||z==='stock'||z==='hand'&&p!==seat;out.players[p].zones[z]=arr.map((c,i)=>!c.revealed&&(hideAll||c.faceDown&&p!==seat)?{uid:'hidden:'+p+':'+z+':'+i,hidden:true,faceDown:true}:c);}
 const owner=choiceOwner(s),a=out.auto;out.waitingFor=s.setup?.p??owner??s.manualWindow?.p??s.active;
 // Queue/tasks contain deck order, private choice options and card identities. Never send them.
 out.auto={enabled:true,notice:a.notice?.p===seat?a.notice.message:null,paused:a.paused,choice:owner===seat?a.choice:null,reveal:a.reveal,gameOver:a.gameOver,effects:a.effects,reviews:a.reviews?.filter(x=>!['hand','deck','stock'].includes(x.z)),results:a.results?.map(d=>({p:d.p,n:d.n,canceled:d.canceled,label:d.label})),attack:a.attack?{p:a.attack.p,type:a.attack.type,ref:a.attack.ref,defender:a.attack.defender}:null};
 out.choiceOwner=owner;out.events=out.events?.map(e=>({...e,refs:e.refs.filter(r=>!['deck','hand','stock'].includes(r.z)||r.p===seat),changes:(e.changes||[]).filter(c=>c.from.p===seat&&c.to.p===seat||![c.from.z,c.to.z].some(z=>['deck','hand','stock'].includes(z)))}));delete out.onlineManualOwner;delete out.first;delete out.revealUntil;
 return out;
}

export function projectSpectator(state, catalog) {
  const projected = project(state, -1, catalog);
  const players = projected.players.map(({zones}) => ({
    zones: Object.fromEntries(Object.entries(zones).map(([zone, cards]) => [
      zone, cards.map(({uid, hidden, faceDown, id, orientation, revealed}) => ({
        uid, hidden, faceDown, id, orientation, revealed
      }))
    ]))
  }));
  const stats = {};
  for (const player of players) {
    for (const zone of stageKeys) {
      for (const card of player.zones[zone]) {
        const values = projected.stats[card.uid];
        if (!card.hidden && values) stats[card.uid] = {soul:values.soul, power:values.power};
      }
    }
  }
  return {
    players, stats, active:state.active, turn:state.turn, phase:state.phase,
    step:state.step, waitingFor:projected.waitingFor, choiceOwner:projected.choiceOwner,
    setup:state.setup ? {p:state.setup.p,stage:state.setup.stage,rolls:state.setup.rolls,tie:state.setup.tie} : null, log:[],
    auto:{reveal:projected.auto.reveal, gameOver:projected.auto.gameOver}
  };
}
