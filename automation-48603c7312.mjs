// English comprehensive rules v2.10: 4.10, 4.12, 6–9. State and choices are JSON-serializable.
import {shuffle,stage} from './engine-1dc5cc47e4.mjs';
export const stageKeys=['center-left','center-middle','center-right','back-left','back-right'];
export const facing=z=>({'center-left':'center-right','center-middle':'center-middle','center-right':'center-left'}[z]);
const clean=t=>String(t||'').replace(/&nbsp;/g,' ').replace(/[’]/g,"'").replace(/\s+/g,' ').trim();
const getCardName=card=>clean(card?.name);
export function abilityLines(c){return (c?.ability||[]).join('\n').split(/(?=【(?:CONT|AUTO|ACT|永|自|起)】)/).map(clean).filter(t=>t&&t!=='-'&&!/^\(:/.test(t));}
function modifiers(text){
 const normalized=text.normalize('NFKC').replace(/−/g,'-');
 const en=normalized.match(/^([+-]\d+) (power|soul)(?: and ([+-]\d+) (power|soul))?$/i);
 if(en&&(!en[4]||en[2].toLowerCase()!==en[4].toLowerCase())){
  return {[en[2].toLowerCase()]:Number(en[1]),...(en[4]?{[en[4].toLowerCase()]:Number(en[3])}:{})};
 }
 const jp=normalized.match(/^(パワー|ソウル)を([+-]\d+)(?:し、(パワー|ソウル)を([+-]\d+))?$/);
 if(jp&&(!jp[3]||jp[1]!==jp[3]))return {[jp[1]==='パワー'?'power':'soul']:Number(jp[2]),...(jp[3]?{[jp[3]==='パワー'?'power':'soul']:Number(jp[4])}:{})};
 return null;
}
function modifierRule(match,kind,extra={},group=1){
 const modifier=match&&modifiers(match[group]);
 return modifier?{kind,...extra,...modifier}:null;
}
export function parseAbility(text){
 const t=clean(text).split(/\s*\(: When this card triggers|\s+（\[\[[^\]]+\]\]：このカードがトリガーした時/)[0].trim();let m;
 if((m=t.match(/^【CONT】 All of (your opponent's|your) (other )?characters get (.+)\.$/i)))return modifierRule(m,'global',{opponent:m[1].toLowerCase()!=='your',other:!!m[2]},3);
 if((m=t.match(/^【永】 あなたの(他の)?キャラすべてに、(.+)。$/)))return modifierRule(m,'global',{other:!!m[1]},2);
 if((m=t.match(/^【CONT】 (During your (opponent's )?turn, )?this card gets (.+)\.$/i)))return modifierRule(m,'self',{condition:m[1]?(m[2]?'opponent':'own'):'always'},3);
 if((m=t.match(/^【CONT】 If this card is in the middle position of your center stage, this card gets (.+)\.$/i)))return modifierRule(m,'self',{condition:'middle'});
 if((m=t.match(/^【CONT】 Assist All of your characters in front of this card get (.+)\.$/i)))return modifierRule(m,'assist');
 if((m=t.match(/^【永】 応援 このカードの前のあなたのキャラすべてに、(.+)。$/)))return modifierRule(m,'assist');
 if((m=t.match(/^【AUTO】 When this card attacks, this card gets (.+) until end of turn\.$/i)))return modifierRule(m,'attack-self');
 if((m=t.match(/^【自】 このカードがアタックした時、そのターン中、このカードの(.+)。$/)))return modifierRule(m,'attack-self');
 const entry=t.match(/^【AUTO】 When this card is placed (?:on|in) (your climax area|the stage|stage) from (?:your )?hand, (.+)\.$/i);
 if(entry){
  const [,location,body]=entry,zone=location.toLowerCase()==='your climax area'?'climax':'stage';
  if((m=body.match(/^this card gets (.+) until end of turn$/i)))return modifierRule(m,'entry-self',{zone});
  if((m=body.match(/^(draw (?:a|1) card, )?choose (up to )?(1|one|2|two) of your (other )?(?:《([^》]+)》 )?characters, and (?:that character gets|those characters get) (.+) until end of turn$/i)))
   return modifierRule(m,'entry-target',{zone,draw:!!m[1],optional:!!m[2],count:/^(2|two)$/i.test(m[3])?2:1,other:!!m[4],trait:m[5]},6);
  if((m=body.match(/^choose (?:1|one) character in your opponent's center stage, and that character gets (.+) until end of turn$/i)))
   return modifierRule(m,'entry-target',{zone,opponent:true,center:true});
  if((m=body.match(/^put the top card of your deck into your stock, and all of your characters get (.+) until end of turn$/i)))
   return modifierRule(m,'entry-global',{zone,stockTop:true});
  if((m=body.match(/^choose up to (?:1|one) (red|blue|green|yellow) card in your waiting room, put it into your stock, and all of your characters get (.+) until end of turn$/i)))
   return modifierRule(m,'entry-global',{zone,stockColor:m[1].toUpperCase()},2);
  if((m=body.match(/^choose up to (?:1|one) level (\d+) or lower character in your waiting room, put it into your stock, and all of your characters get (.+) until end of turn$/i)))
   return modifierRule(m,'entry-global',{zone,stockLevel:+m[1]},2);
  if((m=body.match(/^all of your characters get (.+) until end of turn$/i)))return modifierRule(m,'entry-global',{zone});
 }
 const jpEntry=t.match(/^【自】 このカードが手札から(クライマックス置場|CX置場|舞台)に置かれた時、(.+)。$/);
 if(jpEntry){
  const zone=jpEntry[1]==='舞台'?'stage':'climax',body=jpEntry[2];
  if((m=body.match(/^そのターン中、このカードの(.+)$/)))return modifierRule(m,'entry-self',{zone});
  if((m=body.match(/^あなたは(1枚引き、)?(他の)?自分の(?:《([^》]+)》の)?キャラを1枚選び、そのターン中、(.+)$/)))
   return modifierRule(m,'entry-target',{zone,draw:!!m[1],other:!!m[2],trait:m[3]},4);
  if((m=body.match(/^あなたは自分の山札の上から1枚を、ストック置場に置き、自分のキャラすべてに、そのターン中、(.+)$/)))return modifierRule(m,'entry-global',{zone,stockTop:true});
  if((m=body.match(/^あなたは自分の控え室の(赤|青|緑|黄)のカードを1枚まで選び、ストック置場に置き、自分のキャラすべてに、そのターン中、(.+)$/)))
   return modifierRule(m,'entry-global',{zone,stockColor:({赤:'RED',青:'BLUE',緑:'GREEN',黄:'YELLOW'})[m[1]]},2);
 }
 if((m=t.match(/^【ACT】\s*【COUNTER】\s*Backup (\d+), Level (\d+) \[\((\d+)\) Put this card from your hand into your waiting room\] \(Choose (?:1|one) of your characters that is being frontal attacked, and that character gets \+\d+ power until end of turn\.?\)$/)))return {kind:'backup',power:+m[1],level:+m[2],cost:+m[3]};
 return null;
}
export function triggerIcons(c){return (c?.trigger||[]).map(x=>({BOUNCE:'RETURN',STOCK:'POOL',SALVAGE:'COMEBACK'}[x]||x));}
function automaticTiming(text){
 const backup=text.match(/^【AUTO】 When you use this card's (?:["']?Backup["']?),\s*(.+)$/i)
  ||text.match(/^【自】 あなたがこのカードの『助太刀』を使った時、(.+)$/);
 if(backup)return {kind:'backup',body:backup[1]};
 const battleOpponent=text.match(/^【AUTO】\s*(?:\[[^\]]+\]\s*)?When this card's battle opponent becomes (?:【REVERSE】|reversed),\s*(.+)$/i);
 if(battleOpponent)return {kind:'opponent-reverse',body:battleOpponent[1]};
 const en=text.match(/^【AUTO】\s*(?:\[[^\]]+\]\s*)?(When this card (?:attacks|becomes (?:【REVERSE】|reversed)|is (?:placed (?:on|in) (?:your climax area|the stage|stage) from (?:your )?hand|put into (?:your|the) waiting room from (?:the )?stage))),\s*(.+)$/i);
 if(en){
  const timing=en[1].toLowerCase();
  const kind=timing.includes('attacks')?'attack':timing.includes('becomes')?'reverse':timing.includes('waiting room')?'waiting':timing.includes('climax area')?'climax':'stage';
  return {kind,body:en[2]};
 }
 const jp=text.match(/^【自】\s*(?:［[^］]+］\s*)?このカードが(手札から(?:クライマックス置場|CX置場|舞台)に置かれた|アタックした|リバースした|舞台から控え室に置かれた)時、(.+)$/);
 if(jp){
  const timing=jp[1];
  return {kind:timing.includes('手札')?(timing.includes('舞台')?'stage':'climax'):timing.includes('アタック')?'attack':timing.includes('リバース')?'reverse':'waiting',body:jp[2]};
 }
 return null;
}
function simpleTriggeredEffect(body){
 body=body.replace(/\.["”]\s*$/,'.');
 let m;
 if((m=body.match(/^(You may put|Put) (?:up to (?:1|one) card from the top|the top card) of your clock into your (waiting room|stock)(?:, and this card gets (.+) until end of turn)?\.$/i))){
  const boost=m[3]?modifiers(m[3]):null;
  if(!m[3]||boost)return {type:'ability-clock-move',to:m[2].toLowerCase()==='stock'?'stock':'waiting',optional:/^you may/i.test(m[1])||!boost&&/^Put up to/i.test(body),upTo:!!boost&&/^Put up to/i.test(body),boost};
 }
 if((m=body.match(/^(You may choose|Choose) (up to )?(?:1|one) (character|climax) in your waiting room, and return it to your hand\.$/i)))
  return {type:'ability-salvage',cardType:m[3].toLowerCase()==='climax'?'Climax':'Character',upTo:!!m[2],optional:/^you may/i.test(m[1])};
 if((m=body.match(/^(You may choose|Choose) (?:1|one) card in your hand, and put it into your stock\.$/i)))
  return {type:'ability-hand-move',to:'stock',count:1,optional:/^you may/i.test(m[1])};
 if((m=body.match(/^Draw (up to )?(\d+|a) cards?, choose (\d+|one) cards? in your hand, and put (?:it|them) into your waiting room\.$/i)))
  return {type:'ability-draw-then-move',count:m[2].toLowerCase()==='a'?1:+m[2],upTo:!!m[1],discard:m[3].toLowerCase()==='one'?1:+m[3]};
 if((m=body.match(/^Look at the top card of your deck, and put it (?:on the top of your deck or into your waiting room|on the top or at the bottom of your deck)\.$/i)))
  return {type:'ability-look-place',to:/waiting room/i.test(body)?'waiting':'deck'};
 if((m=body.match(/^Look at (up to )?(\d+) cards? from the top of your deck, and put them on the top of your deck in any order\.$/i)))
  return {type:'ability-look-order',count:+m[2],upTo:!!m[1]};
 if((m=body.match(/^(You may draw|Draw) (up to )?(a|\d+) cards?\.$/i)))
  return {type:'ability-draw',count:m[3].toLowerCase()==='a'?1:+m[3],optional:!!m[2]||/^you may/i.test(m[1]),upTo:!!m[2]};
 if((m=body.match(/^(You may put|Put) the top (?:(\d+) cards?|card) of your deck into your waiting room\.$/i)))
  return {type:'ability-mill',count:+(m[2]||1),optional:/^you may/i.test(m[1])};
 if((m=body.match(/^あなたは(\d+)枚(引く|引いてよい)。$/)))return {type:'ability-draw',count:+m[1],optional:m[2]==='引いてよい'};
 if((m=body.match(/^あなたは自分の山札の上から(\d+)枚を、控え室に置く。$/)))return {type:'ability-mill',count:+m[1]};
 if((m=body.match(/^Look at (up to )?(\d+) cards? from the top of your deck, choose up to (?:1|one) card from among them, put it into your hand, (?:and )?put the rest into your waiting room(?:, and this card gets (.+) until end of turn)?\.$/i))){
  const boost=m[3]?modifiers(m[3]):null;
  if(!m[3]||boost)return {type:'ability-look',count:+m[2],upTo:!!m[1],boost};
 }
 if((m=body.match(/^Search your deck for up to (?:1|one) (?:《([^》]+)》 )?character, reveal it to your opponent, put it into your hand, and shuffle your deck\.$/i)))
  return {type:'ability-search',trait:m[1]};
 if((m=body.match(/^Search your deck for up to (?:1|one) card named "([^"]+)", reveal it to your opponent, put it into your hand, and shuffle your deck\.$/i)))
  return {type:'ability-search',name:m[1]};
 if((m=body.match(/^Search your deck for up to (?:1|one) level (\d+) or lower character, reveal it to your opponent, put it into your hand, and shuffle your deck\.$/i)))
  return {type:'ability-search',maxLevel:+m[1]};
 if((m=body.match(/^Look at (up to )?(\d+|four) cards? from the top of your deck, choose up to (?:1|one) 《([^》]+)》 or 《([^》]+)》 character from among them, reveal it to your opponent, put it into your hand, and put the rest into your waiting room\.$/i)))
  return {type:'ability-look',count:m[2].toLowerCase()==='four'?4:+m[2],upTo:!!m[1],traits:[m[3],m[4]],reveal:true};
 return null;
}
export function activatedAbilities(card){
 return (card?.ability||[]).join('\n').split(/(?=【(?:CONT|AUTO|ACT|永|自|起)】|\[ACT\])/)
  .map(clean).filter(text=>/^(?:【ACT】|【起】|\[ACT\])/.test(text))
  .map((text,index)=>({index,text,action:parseActivatedAbility(text)}));
}
function parseActivatedAbility(text){
 const parts=text.replace(/^\[ACT\]/,'【ACT】').match(/^【ACT】 (?:(Resonate|Brainstorm) )?\[([^\]]+)\] (.+)$/);
 if(!parts)return null;
 const [,keyword,cost,printedBody]=parts;
 const once=/^This ability activates up to 1 time per turn\. /i;
 const body=printedBody.replace(once,'');
 const stockRest=cost.match(/^(?:\((\d+)\)(?: (【REST】 this card))?|(【REST】 this card))$/);
 const resonate=cost.match(/^\((\d+)\) Reveal a card named "([^"]+)" in your hand & 【REST】 this card$/);
 const sacrifice=cost==='Put this card into your waiting room';
 if(!stockRest&&!sacrifice&&!resonate)return null;
 const payment={stock:Number(stockRest?.[1]||resonate?.[1]||0),rest:!!(stockRest?.[2]||stockRest?.[3]||resonate),sacrifice,once:once.test(printedBody),revealName:resonate?.[2]};
 if(keyword==='Brainstorm'){
  const brainstorm=body.match(/^Flip over (\d+) cards from the top of your deck, and put them into your waiting room\. For each climax revealed among those cards, (draw up to (?:1|one) card|choose up to (?:1|one) character in your waiting room, and return it to your hand)\.$/i);
  if(brainstorm)return {...payment,kind:'simple',task:{type:'brainstorm-flip',count:+brainstorm[1],reward:/^draw/i.test(brainstorm[2])?'draw':'salvage',flipped:[]}};
  return null;
 }
 const buff=body.match(/^Choose (?:1|one) of your (other )?characters, and that character gets (.+) until end of turn\.$/);
 const modifier=buff&&modifiers(buff[2]);
 if(modifier)return {...payment,kind:'buff',modifier,other:!!buff[1]};
 if(body==='Put the top card of your clock into your waiting room.')return {...payment,kind:'heal'};
 if(/^Draw (?:1|a) card, choose (?:1|one) card in your hand, and put it into your waiting room\.$/.test(body))return {...payment,kind:'draw-discard'};
 if(/^Draw (?:1|a) card\.$/.test(body))return {...payment,kind:'draw'};
 if(/^Choose (?:1|one) of your opponent's characters, and return it to their hand\.$/.test(body))return {...payment,kind:'bounce'};
 if(/^Choose (?:1|one) of your characters, and 【STAND】 it\.$/.test(body))return {...payment,kind:'stand'};
 const simple=simpleTriggeredEffect(body);
 if(simple&&!simple.optional)return {...payment,kind:'simple',task:simple};
 return null;
}
export function createResolver(card){
 const get=id=>typeof card==='function'?card(id):card.get(id),z=(s,p)=>s.players[p].zones;
 function auto(s){const a=s.auto??={queue:[],choice:null,serial:0,effects:[],shots:[],results:[],enabled:true};a.reviews??=[];a.reveal??=null;a.optionalTop??='take';return a;}
 const log=(s,t)=>{s.log.unshift('T'+s.turn+' · '+t);s.log=s.log.slice(0,150);};
 const allStage=(s,p)=>stageKeys.flatMap(k=>z(s,p)[k].map(c=>({p,z:k,uid:c.uid})));
 const inst=(s,r)=>r&&z(s,r.p)[r.z]?.find(c=>c.uid===r.uid);
 function take(s,r,to,p=r.p){const src=z(s,r.p)[r.z],i=src.findIndex(c=>c.uid===r.uid);if(i<0)return null;const [c]=src.splice(i,1);if(stage(r.z)&&!stage(to)){if(auto(s).activatedUses)delete auto(s).activatedUses[c.uid];if(to==='waiting')queueTriggered(s,r,c,'waiting');c.orientation='stand';z(s,r.p).waiting.push(...z(s,r.p)['markers:'+r.z].splice(0));auto(s).effects=auto(s).effects.filter(e=>e.uid!==c.uid);}c.revealed=false;c.faceDown=to==='stock';z(s,p)[to].push(c);return c;}
 function effect(s,r,vals,label,duration='turn'){const c=inst(s,r);if(!c)throw Error('Choose a character still on stage.');if(['soul','power','level'].some(k=>vals[k]!==undefined&&!Number.isFinite(vals[k])))throw Error('Modifiers must be finite numbers.');auto(s).effects.push({uid:c.uid,p:r.p,...vals,label,turn:s.turn,expires:duration});}
 function stats(s,r){const c=inst(s,r),info=get(c?.id),out={soul:Number(info?.soul)||0,power:Number(info?.power)||0,level:Number(info?.level)||0,breakdown:[],unsupported:[]};if(!c)return {...out,soul:0,power:0};out.breakdown.push({label:'Printed',soul:out.soul,power:out.power});
  for(const source of [r.p,1-r.p].flatMap(p=>[...allStage(s,p),...z(s,p).climax.map(c=>({p,z:'climax',uid:c.uid}))])){
   const obj=inst(s,source),data=get(obj.id),sameSide=source.p===r.p;
   if(obj.faceDown)continue;
   for(const text of abilityLines(data)){
    const a=parseAbility(text);
    if(!a){if(sameSide)out.unsupported.push({code:data?.code,text});continue;}
    let applies=false;
    if(a.kind==='global')applies=(a.opponent?!sameSide:sameSide)&&(!a.other||source.uid!==c.uid);
    if(a.kind==='self'&&source.uid===c.uid)applies=a.condition==='always'||a.condition==='own'&&s.active===r.p||a.condition==='opponent'&&s.active!==r.p||a.condition==='middle'&&r.z==='center-middle';
    if(a.kind==='assist'&&sameSide&&source.z.startsWith('back-'))applies=source.z==='back-left'?['center-left','center-middle'].includes(r.z):['center-middle','center-right'].includes(r.z);
    if(applies){out.soul+=a.soul||0;out.power+=a.power||0;out.breakdown.push({label:data.code+' · '+text,soul:a.soul||0,power:a.power||0});}
   }
  }
  for(const e of auto(s).effects.filter(e=>e.uid===c.uid&&(e.expires==='persistent'||e.turn===s.turn))){out.soul+=e.soul||0;out.power+=e.power||0;out.level+=e.level||0;out.breakdown.push(e);}return out;
 }
 function choice(s,kind,title,options,extra={}){auto(s).choice={id:++auto(s).serial,kind,title,options,...extra};}
 function prepend(s,...tasks){auto(s).queue.unshift(...tasks.filter(Boolean));}
 function queueTriggered(s,source,instance,timing){
  if(!instance||instance.faceDown)return;
  const a=auto(s),key=instance.uid+':'+timing;
  a.triggerMarks??={};
  a.triggerMarks[key]=(a.triggerMarks[key]||0)+1;
  const card=get(instance.id),label=card?.code||card?.name||'Card ability';
  for(const text of abilityLines(card)){
   const trigger=automaticTiming(text);
   if(trigger?.kind!==timing)continue;
   const parsed=parseAbility(text);
   let tasks=[];
   if(parsed?.kind.startsWith('entry-')){
    if(parsed.draw)tasks.push({type:'draw',p:source.p});
    if(parsed.stockTop)tasks.push({type:'optional-move',p:source.p,to:'stock'});
    tasks.push({type:parsed.kind,p:source.p,source,label,...parsed});
   }else if(parsed?.kind==='attack-self')tasks=[{type:'entry-self',p:source.p,source,label,...parsed}];
   else{
    const paid=automaticPayment(text);
    const paidBody=trigger.body.match(/^You may pay the cost\. If you do, (.+)$/i)
     ||trigger.body.match(/^あなたはコストを払ってよい。そうしたら、(.+)$/);
    const simple=paid&&paidBody?simpleTriggeredEffect(paidBody[1]):/^【(?:AUTO|自)】\s*(?:\[|［)/.test(text)?null:simpleTriggeredEffect(trigger.body);
    if(simple)tasks=[{...simple,p:source.p,source,label}];
    if(simple?.type==='ability-draw'&&simple.count===1&&simple.upTo&&!paid)tasks[0].upTo=false;
    if(simple&&paid&&paidBody){
     if(!canPayAutomatic(s,source.p,paid))continue;
     tasks=[{type:'ability-pay',...paid,p:source.p,then:tasks[0],optional:true}];
    }
   }
   const optional=tasks[0]?.optional||!tasks.length&&/^(?:you may|あなたは.*(?:してよい|払ってよい))/i.test(trigger.body);
   (a.triggered??=[]).push({type:'ability-offer',p:source.p,label,text,optional,tasks});
  }
 }
 function automaticPayment(text){
  const stock=text.match(/^【AUTO】\s*\[\((\d+)\)\]/i)||text.match(/^【自】\s*［\((\d+)\)］/);
  if(stock)return {stock:+stock[1]};
  const clock=text.match(/^【AUTO】\s*\[\((\d+)\) Put the top card of your deck into your clock\]/i);
  if(clock)return {stock:+clock[1],clockTop:true};
  const discard=text.match(/^【AUTO】\s*\[(?:\((\d+)\) )?Put (?:1|one) (card|climax|character) from your hand into your waiting room\]/i);
  if(discard)return {stock:+(discard[1]||0),discard:discard[2].toLowerCase()};
  return null;
 }
 function paymentCards(s,p,t){
  return z(s,p).hand.filter(c=>t.discard==='card'||get(c.id)?.type?.toLowerCase()===t.discard);
 }
 function canPayAutomatic(s,p,t){
  const q=z(s,p);
  return q.stock.length>=t.stock&&(!t.discard||paymentCards(s,p,t).length>0)&&(!t.clockTop||q.deck.length>0);
 }
 function flushTriggered(s){
  const a=auto(s);
  if(!a.triggered?.length)return false;
  const p=a.triggered.some(t=>t.p===s.active)?s.active:1-s.active;
  const tasks=a.triggered.filter(t=>t.p===p);
  if(tasks.length>1){
   choice(s,'trigger-order','Choose which triggered ability to resolve first',tasks.map((t,i)=>({value:String(i),label:t.label+' · '+t.text})),{p});
  }else{
   a.triggered.splice(a.triggered.indexOf(tasks[0]),1);
   prepend(s,tasks[0],{type:'trigger-continue'});
  }
  return true;
 }
 function check(s,title){return {type:'check',title};}
 function endGame(s,players,reason){auto(s).gameOver={players,reason};auto(s).choice=null;auto(s).reveal=null;auto(s).queue=[];log(s,'Game ended: '+reason+' · Player '+players.map(p=>p+1).join(' & ')+' loses.');}
 // Interrupt rule actions have priority over every task, except while paying a cost.
 function interrupts(s){if(s.cost)return false;for(const p of [s.active,1-s.active]){const q=z(s,p),lev=q.clock.length>=7,ref=!q.deck.length&&(q.waiting.length>0||auto(s).damage?.p===p&&!auto(s).damage.canceled);
   if(lev&&ref){choice(s,'rule-order','Player '+(p+1)+' · simultaneous level-up and refresh',[{value:'level',label:'Level up first'},{value:'refresh',label:'Refresh first'}],{p});return true;}
   if(lev){levelChoice(s,p);return true;}if(ref){refreshNow(s,p);return true;}
   if(!q.deck.length&&!q.waiting.length&&auto(s).damage?.p===p&&!auto(s).damage.canceled){endGame(s,[p],'No deck or waiting-room cards during uncanceled damage (9.2.2.1)');return true;}}
  return false;
 }
 function levelChoice(s,p){choice(s,'level','Player '+(p+1)+' · choose a level card from the bottom seven clock cards',z(s,p).clock.slice(0,7).map(c=>({value:c.uid,label:get(c.id)?.name||c.id,card:c.id})),{p});}
 function refreshNow(s,p){const q=z(s,p);if(q.deck.length)throw Error('Refresh no longer applies.');if(!q.waiting.length){if(auto(s).damage?.p===p&&!auto(s).damage.canceled)endGame(s,[p],'No deck or waiting-room cards during uncanceled damage (9.2.2.1)');return;}q.deck=shuffle(q.waiting.splice(0));const c=q.deck.pop();c.faceDown=false;c.revealed=false;q.clock.push(c);log(s,'Player '+(p+1)+' refreshed; '+get(c.id)?.code+' went directly to clock (not damage).');}
 function resolveLevel(s,p,uid){const q=z(s,p),seven=q.clock.slice(0,7),c=seven.find(c=>c.uid===uid);if(!c)throw Error('Choose from the bottom seven.');q.clock.splice(0,7);q.level.push(c);q.waiting.push(...seven.filter(x=>x.uid!==uid));log(s,'Player '+(p+1)+' leveled to '+q.level.length+'. Other six clock cards → waiting in their existing order; extra clock remains.');}

 function loseCheck(s){const losers=[0,1].filter(p=>z(s,p).level.length>=4||!z(s,p).deck.length&&!z(s,p).waiting.length);if(losers.length){endGame(s,losers,'Level 4 or empty deck and waiting room at check timing');return true;}return false;}
 function optionsStage(s,p){return allStage(s,p).map(r=>({value:r.uid,label:get(inst(s,r).id)?.name||r.z,ref:r,card:inst(s,r).id}));}
 function modifierTargets(s,p){return optionsStage(s,p).filter(o=>!inst(s,o.ref).faceDown&&get(o.card)?.type==='Character');}
 function chooseEntryTargets(s,t,picked=[]){
  const targets=modifierTargets(s,t.opponent?1-t.p:t.p).filter(o=>
   (!t.center||o.ref.z.startsWith('center-'))&&(!t.other||o.value!==t.source?.uid)&&
   (!t.trait||(get(o.card)?.attributes||[]).some(trait=>trait.replace(/^《|》$/g,'')===t.trait))&&
   !picked.some(r=>r.uid===o.value));
  if(targets.length&&picked.length<(t.count??1)){
   choice(s,'target-effect','Choose a character for '+t.label+(t.power||t.soul?' · '+[t.power&&((t.power>0?'+':'')+t.power+' power'),t.soul&&((t.soul>0?'+':'')+t.soul+' soul')].filter(Boolean).join(' / '):''),
    [...targets,...(t.optional?[{value:'pass',label:'Done choosing'}]:[])],{p:t.p,task:t,picked});
  }else for(const ref of picked)effect(s,ref,{power:t.power,soul:t.soul},t.label);
 }
 function supportedBackup(c){return abilityLines(c).map(parseAbility).find(x=>x?.kind==='backup');}
 function counters(s){const a=auto(s).attack;if(!a||a.type!=='frontal')return [];const p=1-a.p,q=z(s,p),level=q.level.length;return q.hand.flatMap(c=>{const data=get(c.id),b=supportedBackup(data),text=abilityLines(data).join(' ');if(b&&inst(s,a.defender)&&level>=b.level&&q.stock.length>=b.cost)return [{value:c.uid,label:data.name+' · Backup +'+b.power+' · pay '+b.cost,card:c.id,backup:b}];
   if(data?.type==='Event'&&/【COUNTER】/.test(text)&&Number(data.level)<=level&&Number(data.cost)<=q.stock.length&&(Number(data.level)===0||[...q.level,...q.clock].some(c=>get(c.id)?.color===data.color)))return [{value:c.uid,label:data.name+' · counter event (effect and additional conditions manual)',card:c.id,manual:true}];return [];});}
 function checkpoint(s,title,p){const texts=[...allStage(s,p),...z(s,p).climax.map(c=>({p,z:'climax',uid:c.uid})),...z(s,p).clock.slice(-1).map(c=>({p,z:'clock',uid:c.uid}))].flatMap(r=>abilityLines(get(inst(s,r).id)).filter(t=>!parseAbility(t)).map(text=>({p,code:get(inst(s,r).id)?.code,text})));for(const t of texts){const a=auto(s);if(!a.reviews.some(x=>x.code===t.code&&x.text===t.text))a.reviews.push(t);}auto(s).reviews=auto(s).reviews.slice(-50);}
 function flash(s,p,c,kind,label){auto(s).reveal={id:++auto(s).serial,p,card:c.id,uid:c.uid,kind,label};}
 function reverseCharacter(s,ref){
  const card=inst(s,ref);
  if(!card||card.orientation==='reverse')return;
  card.orientation='reverse';
  queueTriggered(s,ref,card,'reverse');
  const attack=auto(s).attack;
  const other=attack?.ref.uid===ref.uid?attack.defender:attack?.defender?.uid===ref.uid?attack.ref:null;
  if(other)queueTriggered(s,other,inst(s,other),'opponent-reverse');
 }
 function compareBattle(s){const a=auto(s),atk=inst(s,a.attack.ref),def=inst(s,a.attack.defender);if(atk&&def){const ap=stats(s,a.attack.ref).power,dp=stats(s,a.attack.defender).power;if(ap<=dp)reverseCharacter(s,a.attack.ref);if(dp<=ap)reverseCharacter(s,a.attack.defender);log(s,'Battle '+ap+' versus '+dp+'; lower power reversed (both on tie). Recorded modifiers included; unsupported effects remain manual.');}else log(s,'Battle skipped: an original participant is absent.');prepend(s,{type:'attack-end'});}
 function nextTurn(s){const a=auto(s);s.turn++;s.active=1-s.active;s.phase=0;s.attacksThisTurn=0;s.attackType=null;prepend(s,check(s,'Beginning of stand phase'),{type:'stand'});}
 function migrateChoice(s){const a=auto(s),c=a.choice;if(!c)return;if(c.kind==='checkpoint'){checkpoint(s,c.title,c.p);a.choice=null;}else if(c.kind==='damage-view'){a.choice=null;const d=a.damage,last=d&&z(s,d.p).resolution.find(x=>x.uid===d.uids.at(-1));if(!['damage-finish','damage-reveal'].includes(a.queue[0]?.type))prepend(s,{type:d?.canceled||!d?.remaining?'damage-finish':'damage-reveal'});if(last)flash(s,d.p,last,'damage',c.title);}else if(c.kind==='battle'){a.choice=null;prepend(s,{type:'battle'});}else if(c.kind==='turn-ready'){a.choice=null;nextTurn(s);}else if(c.kind==='level-order'){a.choice=null;z(s,c.p).waiting.push(...c.ordered,...c.cards);}else if(c.kind==='counter'&&!counters(s).length){a.choice=null;prepend(s,check(s,'After counter step'),{type:'damage-start'});}}

 function startDamageTask(s,p,n,source,label){if(n<=0){log(s,'No damage: soul is zero or less.');return;}auto(s).damage={p,n,remaining:n,uids:[],canceled:false,source,label};prepend(s,{type:'damage-reveal'});}
 function run(s){const a=auto(s);if(a.gameOver||a.paused)return;migrateChoice(s);if(a.choice){if(['level','level-order','rule-order'].includes(a.choice.kind))return;const pending=a.choice;a.choice=null;if(interrupts(s)){if(!a.gameOver)prepend(s,{type:'resume-choice',choice:pending});if(a.choice||a.gameOver)return;}else{a.choice=pending;return;}}let guard=0;while(!a.choice&&!a.gameOver&&guard++<200){if(interrupts(s)) {if(a.choice||a.gameOver)return;continue;}if(a.reveal)return;const t=a.queue.shift();if(!t){if(flushTriggered(s))continue;if(s.phase===5&&!a.attack)s.step='Attack declaration';if(!s.cost)loseCheck(s);return;}switch(t.type){
  case 'resume-choice':if(t.choice.kind==='counter')prepend(s,{type:'counter'});else a.choice=t.choice;break;
  case 'check':if(!loseCheck(s)){prepend(s,{type:'checkpoint',title:t.title,p:s.active},{type:'checkpoint',title:t.title,p:1-s.active});flushTriggered(s);}break;
  case 'trigger-continue':flushTriggered(s);break;
  case 'checkpoint':checkpoint(s,t.title,t.p);break;
  case 'ability-offer':{
   delete a.notice;
   const supported=t.tasks.length>0;
   choice(s,supported?'ability-offer':'auto-manual',t.label+(supported?' · Triggered ability':' · Check this ability manually'),
    [{value:'resolve',label:supported?(t.optional?'Yes · Resolve':'Resolve required ability'):'Continue after checking / resolving manually'},
     ...(t.optional?[{value:'pass',label:'No · Decline'}]:[])],
    {p:t.p,task:t,abilityText:t.text});
   break;
  }
  case 'ability-draw':
   if(t.upTo)choice(s,'ability-count','How many cards do you want to draw?',Array.from({length:t.count+1},(_,i)=>({value:String(i),label:String(i)})),{p:t.p,task:t});
   else prepend(s,...Array.from({length:t.count},()=>({type:'draw',p:t.p})));
   break;
  case 'ability-mill':
   if(t.count&&z(s,t.p).deck.length){
    take(s,{p:t.p,z:'deck',uid:z(s,t.p).deck.at(-1).uid},'waiting');
    if(t.count>1)prepend(s,{...t,count:t.count-1});
   }
   break;
  case 'ability-look':{
   const max=Math.min(t.count,z(s,t.p).deck.length);
   if(t.upTo&&max)choice(s,'ability-count','How many top cards do you want to look at?',Array.from({length:max+1},(_,i)=>({value:String(i),label:String(i)})),{p:t.p,task:t});
   else lookForAbility(s,t,max);
   break;
  }
  case 'ability-look-discard':take(s,{p:t.p,z:'deck',uid:t.uid},'waiting');break;
  case 'ability-look-finish':finishAbilityLook(s,t.task);break;
  case 'ability-salvage':{
   const cardType=t.cardType||'Character';
   const options=z(s,t.p).waiting.filter(c=>get(c.id)?.type===cardType).map(c=>cardOption(t.p,'waiting',c));
   if(options.length===1&&!t.upTo)take(s,options[0].ref,'hand');
   else if(options.length)choice(s,'ability-salvage','Waiting Room · Choose a '+cardType.toLowerCase()+' to return to hand',[...options,...(t.upTo?[{value:'pass',label:'Choose none'}]:[])],{p:t.p});
   break;
  }
  case 'ability-clock-move':{
   const clock=z(s,t.p).clock;
   if(clock.length&&t.upTo){
    choice(s,'ability-clock-choice','Move the top card of your Clock?',[
     {...cardOption(t.p,'clock',clock.at(-1)),label:'Move to '+(t.to==='stock'?'Stock':'Waiting Room')},
     {value:'pass',label:'Leave it in Clock'}
    ],{p:t.p,task:t});
   }else finishClockMove(s,t,clock.length>0);
   break;
  }
  case 'ability-hand-move':chooseHandMove(s,t);break;
  case 'ability-draw-then-move':
   prepend(s,{type:'ability-draw',p:t.p,count:t.count,upTo:t.upTo},{type:'ability-hand-move',p:t.p,to:'waiting',count:t.discard});
   break;
  case 'ability-look-place':{
   const card=z(s,t.p).deck.at(-1);
   if(card)choice(s,'ability-look-place','Top of Deck · Choose where to put this card',[
    {value:'keep',label:'Keep on top',card:card.id},
    {value:'move',label:t.to==='waiting'?'Move to Waiting Room':'Put on bottom',card:card.id}
   ],{p:t.p,task:t,looked:[card.uid]});
   break;
  }
  case 'ability-look-order':{
   const count=Math.min(t.count,z(s,t.p).deck.length);
   if(t.upTo&&count)choice(s,'ability-count','How many top cards do you want to look at?',Array.from({length:count+1},(_,i)=>({value:String(i),label:String(i)})),{p:t.p,task:t});
   else beginLookOrder(s,t,count);
   break;
  }
  case 'brainstorm-flip':{
   const deck=z(s,t.p).deck;
   if(t.count&&deck.length){
    const card=take(s,{p:t.p,z:'deck',uid:deck.at(-1).uid},'resolution');
    prepend(s,{...t,count:t.count-1,flipped:[...t.flipped,{uid:card.uid,climax:get(card.id)?.type==='Climax'}]});
    flash(s,t.p,card,'ability','Brainstorm · Card '+(t.flipped.length+1));
   }else{
    for(const card of t.flipped)take(s,{p:t.p,z:'resolution',uid:card.uid},'waiting');
    const hits=t.flipped.filter(c=>c.climax).length;
    log(s,'Brainstorm · '+hits+' climax card(s) revealed.');
    const reward=t.reward==='draw'?{type:'ability-draw',p:t.p,count:1,upTo:true}:{type:'ability-salvage',p:t.p,upTo:true};
    prepend(s,...Array.from({length:hits},()=>reward));
   }
   break;
  }
  case 'ability-pay':{
   if(!canPayAutomatic(s,t.p,t))break;
   if(t.discard){
    const options=paymentCards(s,t.p,t).map(c=>cardOption(t.p,'hand',c));
    if(options.length===1)finishAbilityPayment(s,t,options[0].ref);
    else choice(s,'ability-pay-card','Hand · Choose one '+t.discard+' to discard as cost',options,{p:t.p,task:t});
   }else{
    finishAbilityPayment(s,t);
   }
   break;
  }
  case 'ability-search':{
   delete auto(s).notice;
   const q=z(s,t.p);
   const options=q.deck.filter(c=>{
    const card=get(c.id);
    if(t.name)return getCardName(card)===t.name;
    return card?.type==='Character'&&(t.maxLevel===undefined||Number(card.level)<=t.maxLevel)&&(!t.trait||(card.attributes||[]).some(trait=>trait.replace(/^《|》$/g,'')===t.trait));
   }).map(c=>({value:c.uid,label:get(c.id)?.name||c.id,card:c.id})).sort((a,b)=>a.label.localeCompare(b.label)||a.value.localeCompare(b.value));
   if(options.length)choice(s,'ability-search','Deck · Choose up to one '+(t.name?'card named '+t.name:'eligible character'),[...options,{value:'pass',label:'Choose none and shuffle'}],{p:t.p,task:t});
   else{
    shuffle(q.deck);
    const message=t.name?'Deck searched and shuffled. No card named exactly “'+t.name+'” was found.':'Deck searched and shuffled. No eligible character was found.';
    auto(s).notice={p:t.p,message};
    log(s,'Player '+(t.p+1)+' searched and shuffled without taking a card.');
   }
   break;
  }
  case 'declare-request':beginAttack(s,t.ref,t.attackType);break;
  case 'trigger-start':s.step='Trigger';prepend(s,check(s,'Beginning of trigger step'),{type:'trigger-reveal'});break;
  case 'trigger-reveal':{const q=z(s,a.attack.p);if(!q.deck.length){choice(s,'blocked','No deck card available. Resolve rule procedures or use manual correction.',[{value:'retry',label:'Recheck and retry'}],{task:t});break;}const c=q.deck.pop();c.faceDown=false;q.resolution.push(c);a.trigger={uid:c.uid,p:a.attack.p,icons:triggerIcons(get(c.id))};log(s,'Trigger revealed: '+get(c.id)?.code);flash(s,a.attack.p,c,'trigger','Trigger check');prepend(s,{type:'trigger-icons'});break;}
  case 'trigger-icons':{const tr=a.trigger;if(!tr.icons.length){prepend(s,{type:'trigger-stock'});break;}if(tr.icons.length>1&&new Set(tr.icons).size>1){choice(s,'icon-order','Choose the next trigger icon to resolve',tr.icons.map((icon,i)=>({value:String(i),label:icon})));break;}prepend(s,{type:'icon',icon:tr.icons.shift()},{type:'trigger-icons'});break;}
  case 'icon':resolveIcon(s,t.icon);break;
  case 'trigger-stock':{const tr=a.trigger;if(z(s,tr.p).resolution.some(c=>c.uid===tr.uid))take(s,{p:tr.p,z:'resolution',uid:tr.uid},'stock');a.trigger=null;prepend(s,check(s,'After trigger check'),{type:'counter-start'});log(s,'Trigger check complete; remaining trigger card moved face down to top of stock.');break;}
  case 'counter-start':if(a.attack.type==='frontal'){s.step='Counter';prepend(s,check(s,'Beginning of counter step'),{type:'counter'});}else prepend(s,{type:'damage-start'});break;
  case 'counter':{const legal=counters(s);if(legal.length)choice(s,'counter','Player '+(2-a.attack.p)+' · play a counter?',[...legal,{value:'pass',label:'Pass counter'}],{p:1-a.attack.p});else {log(s,'No eligible counter card; counter window passed automatically.');prepend(s,check(s,'After counter step'),{type:'damage-start'});}break;}
  case 'damage-start':s.step='Damage';prepend(s,check(s,'Beginning of damage step'),{type:'damage-attack'});break;
  case 'damage-attack':{const r=a.attack.ref,c=inst(s,r);if(c)startDamageTask(s,1-a.attack.p,stats(s,r).soul,c.uid,'Attack damage');prependAfterDamage(s,{type:'after-damage'});break;}
  case 'effect-damage':startDamageTask(s,t.p,t.n,t.source,t.label||'Effect damage');break;
  case 'damage-reveal':{const d=a.damage,q=z(s,d.p);if(d.canceled||!d.remaining){prepend(s,{type:'damage-finish'});break;}if(!q.deck.length){endGame(s,[d.p],'No card available for required damage');break;}const c=q.deck.pop();c.faceDown=false;q.resolution.push(c);d.uids.push(c.uid);d.remaining--;d.canceled=get(c.id)?.type==='Climax';log(s,d.label+': revealed '+get(c.id)?.code+(d.canceled?' · CANCELED':''));flash(s,d.p,c,'damage',d.label+' · '+(d.canceled?'CANCELED':'check '+d.uids.length+' / '+d.n));prepend(s,{type:d.canceled||!d.remaining?'damage-finish':'damage-reveal'});break;}
  case 'damage-finish':{const d=a.damage;for(const uid of d.uids)take(s,{p:d.p,z:'resolution',uid},d.canceled?'waiting':'clock');a.results.unshift({...d});a.results=a.results.slice(0,8);log(s,d.label+' '+(d.canceled?'canceled in full → waiting room':d.n+' → clock')+'.');const shot=a.shots.filter(x=>x.uid===d.source&&x.turn===s.turn);a.shots=a.shots.filter(x=>!shot.includes(x));a.damage=null;if(d.canceled&&shot.length)prepend(s,...shot.map(()=>({type:'effect-damage',p:d.p,n:1,source:d.source,label:'Shot · separate damage instance'})));break;}
  case 'after-damage':prepend(s,check(s,'After damage'),a.attack.type==='frontal'?{type:'battle-start'}:{type:'attack-end'});break;
  case 'battle-start':s.step='Battle';prepend(s,check(s,'Beginning of battle step'),{type:'battle'});break;
  case 'battle':compareBattle(s);break;
  case 'attack-end':prepend(s,check(s,'After battle / at end of attack'),{type:'attack-finish'});break;
  case 'attack-finish':a.effects=a.effects.filter(e=>e.expires!=='attack');a.attack=null;s.step='Attack declaration';prepend(s,check(s,'Beginning of next attack declaration step'));log(s,'Attack sub-phase complete. Choose another standing attacker or end attacks.');break;
  case 'entry-target':chooseEntryTargets(s,t);break;
  case 'entry-self':if(inst(s,t.source))effect(s,t.source,{power:t.power,soul:t.soul},t.label);break;
  case 'entry-global':{
   const options=t.stockColor||t.stockLevel!==undefined?z(s,t.p).waiting.filter(c=>{
    const card=get(c.id);
    return t.stockColor?card?.color===t.stockColor:card?.type==='Character'&&Number(card.level)<=t.stockLevel;
   }).map(c=>({value:c.uid,label:get(c.id)?.name||c.id,card:c.id,ref:{p:t.p,z:'waiting',uid:c.uid}})):[];
   if(options.length)choice(s,'entry-stock','Choose up to one card to put into Stock for '+t.label,[...options,{value:'pass',label:'Skip stocking a card'}],{p:t.p,task:t});
   else prepend(s,{...t,type:'entry-global-apply'});
   break;
  }
  case 'entry-global-apply':for(const {ref} of modifierTargets(s,t.p))effect(s,ref,{power:t.power,soul:t.soul},t.label);break;
  case 'optional-move':if(z(s,t.p).deck.length){const obj=z(s,t.p).deck.pop();obj.faceDown=t.to==='stock';z(s,t.p)[t.to].push(obj);}else log(s,'No deck card available for optional trigger transfer.');break;
  case 'draw':if(z(s,t.p).deck.length){const obj=z(s,t.p).deck.pop();obj.faceDown=false;z(s,t.p).hand.push(obj);}else log(s,'No card available to draw.');break;
  case 'act-effect':{
   const q=z(s,t.p);
   if(t.action.kind==='heal'){
    if(q.clock.length)take(s,{p:t.p,z:'clock',uid:q.clock.at(-1).uid},'waiting');
   }else{
    const options=t.action.kind==='draw-discard'
     ?q.hand.map(c=>({value:c.uid,label:get(c.id)?.name||c.id,card:c.id,ref:{p:t.p,z:'hand',uid:c.uid}}))
     :modifierTargets(s,t.action.kind==='bounce'?1-t.p:t.p).filter(o=>!t.action.other||o.value!==t.source?.uid);
    if(options.length)choice(s,'act-target','Choose a card for '+t.label,options,{p:t.p,task:t});
   }
   break;
  }
  case 'encore':{s.step='Encore';const candidates=[s.active,1-s.active].flatMap(p=>allStage(s,p).filter(r=>inst(s,r).orientation==='reverse'));if(candidates.length===1){const r=candidates[0],obj=take(s,r,'waiting');prepend(s,check(s,'Character moved from stage to waiting'),{type:'encore-offer',p:r.p,position:r.z,card:obj});}else if(candidates.length){const p=candidates[0].p;choice(s,'encore-select','Player '+(p+1)+' · choose the next reversed character to send to waiting',candidates.filter(r=>r.p===p).map(r=>({value:r.uid,label:get(inst(s,r).id)?.name,ref:r})));}else {s.phase=6;prepend(s,check(s,'Beginning of end phase'),{type:'end-discard'});}break;}
  case 'encore-offer':{const canPay=z(s,t.p).stock.length>=3,other=abilityLines(get(t.card.id)).some(text=>/Encore/i.test(text));if(canPay||other)choice(s,'encore-offer','Encore · '+get(t.card.id)?.name,[...(canPay?[{value:'pay',label:'Pay top 3 stock · return rested'}]:[]),...(other?[{value:'manual',label:'Other printed Encore ability'}]:[]),{value:'pass',label:'Decline Encore'}],{task:t,p:t.p});else prepend(s,{type:'encore'});break;}
  case 'end-discard':{const p=s.active,q=z(s,p);if(q.hand.length>7)choice(s,'discard','Player '+(p+1)+' · discard to seven cards',q.hand.map(c=>({value:c.uid,label:get(c.id)?.name,card:c.id})),{p});else{q.waiting.push(...q.climax.splice(0));prepend(s,check(s,'End phase cleanup'),{type:'end-expire'});}break;}
  case 'end-expire':a.effects=a.effects.filter(e=>e.expires==='persistent');a.shots=[];prepend(s,check(s,'After effects expire'),{type:'turn-ready'});break;
  case 'turn-ready':nextTurn(s);break;
  case 'stand':for(const r of allStage(s,s.active))inst(s,r).orientation='stand';prepend(s,check(s,'After standing'),{type:'draw-phase'});break;
  case 'draw-phase':s.phase=1;prepend(s,check(s,'Beginning of draw phase'),{type:'draw',p:s.active},check(s,'After draw'),{type:'clock-phase'});break;
  case 'clock-phase':s.phase=2;s.step='Clock';log(s,'Clock phase: optional hand → clock and draw two remains in the card menu.');break;
  default:throw Error('Unknown resolution task '+t.type);
 }}if(guard>=200)throw Error('Resolution stopped to prevent a loop.');if(a.choice&&!['level','level-order','rule-order'].includes(a.choice.kind)&&!s.cost&&[0,1].some(p=>z(s,p).clock.length>=7||!z(s,p).deck.length&&z(s,p).waiting.length>0||!z(s,p).deck.length&&!z(s,p).waiting.length&&a.damage?.p===p&&!a.damage.canceled))run(s);}
 function prependAfterDamage(s,task){const a=auto(s);if(a.damage)a.queue.splice(1,0,task);else prepend(s,task);}
 function resolveIcon(s,icon){const a=auto(s),p=a.attack.p,q=z(s,p),tr=a.trigger,r=a.attack.ref;log(s,'Resolve trigger icon '+icon);if(icon==='SOUL'){if(inst(s,r))effect(s,r,{soul:1},'Soul trigger');return;}if(icon==='SHOT'){a.shots.push({uid:r.uid,turn:s.turn});return;}if(icon==='TREASURE'){take(s,{p,z:'resolution',uid:tr.uid},'hand');icon='POOL';}
  if(['POOL','DRAW'].includes(icon)){if(a.optionalTop!=='ask'){log(s,'Automatic '+icon+' trigger choice: take the top card.');prepend(s,{type:'optional-move',p,to:icon==='DRAW'?'hand':'stock'});return;}choice(s,'optional-top',icon==='DRAW'?'Draw trigger · draw a card?':'Pool / Treasure · put top deck card into stock?',[{value:'yes',label:'Yes'},{value:'no',label:'Decline'}],{p,to:icon==='DRAW'?'hand':'stock'});return;}
  let opts=[];if(icon==='RETURN')opts=optionsStage(s,1-p);if(['COMEBACK','GATE','STANDBY','CHOICE'].includes(icon))opts=q.waiting.filter(c=>{const d=get(c.id);return icon==='GATE'?d?.type==='Climax':d?.type==='Character'&&(icon!=='STANDBY'||Number(d.level)<=q.level.length+1)&&(icon!=='CHOICE'||triggerIcons(d).includes('SOUL'));}).map(c=>({value:c.uid,label:get(c.id)?.name,card:c.id,ref:{p,z:'waiting',uid:c.uid}}));
  if(['RETURN','COMEBACK','GATE','STANDBY','CHOICE'].includes(icon)){if(!opts.length){log(s,icon+' has no eligible target; passed automatically.');return;}choice(s,'trigger-target',icon+' · choose up to one card',[...opts,{value:'pass',label:'Decline'}],{p,icon});return;}choice(s,'unknown-icon','Unsupported trigger icon: '+icon,[{value:'done',label:'Resolved manually'}],{unsupported:[{text:'Resolve the printed icon manually before continuing.'}]});}
 function beginAttack(s,r,type){const a=auto(s);if(a.choice||a.reveal||a.paused||a.queue.length||a.attack||a.gameOver)throw Error('Finish the current resolution first.');const c=inst(s,r),d=get(c?.id);if(s.phase!==5||s.active!==r.p||!r.z.startsWith('center-')||!c||c.orientation!=='stand'||d?.type!=='Character')throw Error('A standing active-player center-stage character is required.');if(s.turn===1&&(s.attacksThisTurn||0)>=1)throw Error('The starting player may attack only once on the first turn.');if(a.attackPhaseTurn!==s.turn){a.attackPhaseTurn=s.turn;prepend(s,check(s,'Beginning of attack phase'),check(s,'Beginning of attack declaration step'),{type:'declare-request',ref:{...r},attackType:type});run(s);return;}const dz=facing(r.z),def=z(s,1-r.p)[dz].at(-1);if(!def)type='direct';else if(!['frontal','side'].includes(type))throw Error('Choose frontal or side against the opposing character.');a.attack={p:r.p,ref:{...r},type,defender:def?{p:1-r.p,z:dz,uid:def.uid}:null};c.orientation='rest';s.attackType=type[0].toUpperCase()+type.slice(1);s.attacksThisTurn=(s.attacksThisTurn||0)+1;s.step='Attack declaration';if(type==='direct')effect(s,r,{soul:1},'Direct attack','attack');if(type==='side')effect(s,r,{soul:-Math.max(0,stats(s,{p:1-r.p,z:dz,uid:def.uid}).level||0)},'Side attack · defending level at declaration','attack');queueTriggered(s,r,c,'attack');prepend(s,check(s,'Attack declared / after rest'),{type:'trigger-start'});log(s,'Player '+(r.p+1)+' declared '+type+' attack; attacker rested.');run(s);}
 function finishAbilityLook(s,t){
  if(t.boost&&inst(s,t.source))effect(s,t.source,t.boost,t.label);
 }
 function cardOption(p,zone,card){
  return {value:card.uid,label:get(card.id)?.name||card.id,card:card.id,ref:{p,z:zone,uid:card.uid}};
 }
 function finishAbilityPayment(s,t,discard){
  if(!canPayAutomatic(s,t.p,t))throw Error('You cannot pay the full cost of this ability.');
  const q=z(s,t.p);
  for(let i=0;i<t.stock;i++)take(s,{p:t.p,z:'stock',uid:q.stock.at(-1).uid},'waiting');
  if(discard)take(s,discard,'waiting');
  if(t.clockTop)take(s,{p:t.p,z:'deck',uid:q.deck.at(-1).uid},'clock');
  prepend(s,t.then);
 }
 function finishClockMove(s,t,moveCard){
  const clock=z(s,t.p).clock;
  if(moveCard&&clock.length)take(s,{p:t.p,z:'clock',uid:clock.at(-1).uid},t.to);
  finishAbilityLook(s,t);
 }
 function chooseHandMove(s,t,picked=[]){
  const hand=z(s,t.p).hand,remaining=hand.filter(c=>!picked.includes(c.uid));
  const count=Math.min(t.count,hand.length);
  if(picked.length>=count||remaining.length===count-picked.length){
   const chosen=picked.length>=count?picked:[...picked,...remaining.map(c=>c.uid)];
   for(const uid of chosen)take(s,{p:t.p,z:'hand',uid},t.to);
  }else choice(s,'ability-hand-move','Hand · Choose '+(count-picked.length)+' card(s) for '+(t.to==='stock'?'Stock':'Waiting Room'),remaining.map(c=>cardOption(t.p,'hand',c)),{p:t.p,task:t,picked});
 }
 function beginLookOrder(s,t,count,picked=[],looked=z(s,t.p).deck.slice(-count).reverse().map(c=>c.uid)){
  if(!count)return;
  const deck=z(s,t.p).deck,remaining=looked.filter(uid=>!picked.includes(uid));
  if(remaining.length<=1){
   const ordered=[...picked,...remaining].map(uid=>deck.find(c=>c.uid===uid)).filter(Boolean);
   const excluded=new Set(looked);
   z(s,t.p).deck=deck.filter(c=>!excluded.has(c.uid)).concat(ordered.reverse());
  }else choice(s,'ability-look-order','Top of Deck · Choose the next card, top first',remaining.map(uid=>cardOption(t.p,'deck',deck.find(c=>c.uid===uid))),{p:t.p,task:t,picked,looked});
 }
 function lookForAbility(s,t,count){
  if(!count)return finishAbilityLook(s,t);
  const cards=z(s,t.p).deck.slice(-count).reverse();
  const options=cards.map(c=>{
   const card=get(c.id);
   const disabled=!!t.traits&&(card?.type!=='Character'||!(card.attributes||[]).some(trait=>t.traits.includes(trait.replace(/^《|》$/g,''))));
   return {value:c.uid,label:(card?.name||c.id)+(disabled?' · Not eligible':''),card:c.id,disabled};
  });
  choice(s,'ability-look-target','Top of Deck · Choose up to one card to put into hand',[...options,{value:'pass',label:'Put all looked-at cards in Waiting Room'}],
   {p:t.p,task:t,looked:cards.map(c=>c.uid)});
 }
 function respond(s,id,value,extra={}){if(s.cost)throw Error('Finish the complete cost and end cost-payment suspension before continuing.');const a=auto(s),c=a.choice;if(!c||c.id!==id)throw Error('This choice has already been resolved.');const option=c.options.find(o=>o.value===value&&!o.disabled);if(!option)throw Error('Choose an available option.');a.choice=null;switch(c.kind){
  case 'act-target':{
   const {action,label}=c.task;
   if(action.kind==='buff')effect(s,option.ref,action.modifier,label);
   else if(action.kind==='stand')inst(s,option.ref).orientation='stand';
   else take(s,option.ref,action.kind==='bounce'?'hand':'waiting');
   break;
  }
  case 'ability-offer':if(value==='resolve')prepend(s,...c.task.tasks);break;
  case 'trigger-order':{
   const next=a.triggered.filter(t=>t.p===c.p)[+value];
   a.triggered.splice(a.triggered.indexOf(next),1);
   prepend(s,next,{type:'trigger-continue'});
   break;
  }
  case 'auto-manual':break;
  case 'ability-count':
   if(c.task.type==='ability-look')lookForAbility(s,c.task,+value);
   else if(c.task.type==='ability-look-order')beginLookOrder(s,c.task,+value);
   else prepend(s,...Array.from({length:+value},()=>({type:'draw',p:c.p})));
   break;
  case 'ability-clock-choice':finishClockMove(s,c.task,value!=='pass');break;
  case 'ability-hand-move':chooseHandMove(s,c.task,[...c.picked,value]);break;
  case 'ability-look-place':
   if(value==='move'){
    if(c.task.to==='waiting')take(s,{p:c.p,z:'deck',uid:c.looked[0]},'waiting');
    else{const deck=z(s,c.p).deck;if(deck.at(-1)?.uid===c.looked[0])deck.unshift(deck.pop());}
   }
   break;
  case 'ability-look-order':beginLookOrder(s,c.task,c.looked.length,[...c.picked,value],c.looked);break;
  case 'ability-look-target':
   if(value!=='pass'){
    const picked=take(s,{p:c.p,z:'deck',uid:value},'hand');
    if(picked&&c.task.reveal)flash(s,c.p,picked,'ability','Card chosen from the top of the deck');
   }
   prepend(s,...c.looked.filter(uid=>uid!==value).map(uid=>({type:'ability-look-discard',p:c.p,uid})),{type:'ability-look-finish',task:c.task});
   break;
  case 'ability-salvage':if(value!=='pass')take(s,option.ref,'hand');break;
  case 'ability-pay-card':{
   finishAbilityPayment(s,c.task,option.ref);
   break;
  }
  case 'ability-search':{
   if(value!=='pass'){
    const card=take(s,{p:c.p,z:'deck',uid:value},'hand');
    if(card)flash(s,c.p,card,'ability','Card found by deck search');
   }
   shuffle(z(s,c.p).deck);
   break;
  }
  case 'ability-resonate':payResonate(s,c.task,option.ref);break;
  case 'rule-order':if(value==='level')levelChoice(s,c.p);else refreshNow(s,c.p);break;
  case 'level':resolveLevel(s,c.p,value);break;
  case 'level-order':{const picked=c.cards.find(x=>x.uid===value);c.cards=c.cards.filter(x=>x!==picked);c.ordered.push(picked);if(c.cards.length){choice(s,'level-order',c.title,c.cards.map(x=>({value:x.uid,label:get(x.id)?.name,card:x.id})),{p:c.p,cards:c.cards,ordered:c.ordered});}else z(s,c.p).waiting.push(...c.ordered);break;}
  case 'icon-order':prepend(s,{type:'icon',icon:a.trigger.icons.splice(+value,1)[0]},{type:'trigger-icons'});break;
  case 'optional-top':if(value==='yes')prepend(s,{type:'optional-move',p:c.p,to:c.to});break;
  case 'trigger-target':if(value!=='pass'){if(c.icon==='STANDBY')choice(s,'standby-position','Choose any stage position (occupied card will go to waiting)',stageKeys.map(k=>({value:k,label:k})),{p:c.p,ref:option.ref});else if(c.icon==='CHOICE')choice(s,'choice-destination','Put chosen character in hand or stock',[{value:'hand',label:'Hand'},{value:'stock',label:'Stock'}],{ref:option.ref});else take(s,option.ref,'hand');}break;
  case 'standby-position':{for(const old of [...z(s,c.p)[value]])take(s,{p:c.p,z:value,uid:old.uid},'waiting');const obj=take(s,c.ref,value);obj.orientation='rest';break;}
  case 'choice-destination':take(s,c.ref,value);break;
  case 'counter':if(value==='pass')prepend(s,check(s,'After counter step'),{type:'damage-start'});else {const p=c.p,ref={p,z:'hand',uid:value};if(option.backup){const b=option.backup;for(let i=0;i<b.cost;i++)take(s,{p,z:'stock',uid:z(s,p).stock.at(-1).uid},'waiting');queueTriggered(s,ref,take(s,ref,'waiting'),'backup');if(inst(s,a.attack.defender))effect(s,a.attack.defender,{power:b.power},'Backup');prepend(s,check(s,'After Backup (other abilities manual)'),{type:'damage-start'});}else {choice(s,'manual-counter','Counter event · verify additional printed requirements, pay costs, resolve manually',[{value:'done',label:'Legal counter resolved manually'},{value:'cancel',label:'Do not play; return to response choice'}],{p,uid:value});}}break;
  case 'manual-counter':prepend(s,value==='cancel'?{type:'counter'}:check(s,'After manual counter'),value==='cancel'?null:{type:'damage-start'});break;
  case 'damage-view':prepend(s,{type:a.damage.canceled||!a.damage.remaining?'damage-finish':'damage-reveal'});break;
  case 'battle':{const atk=inst(s,a.attack.ref),def=inst(s,a.attack.defender),ap=extra.attacker??c.attacker.power,dp=extra.defender??c.defender.power;if(!Number.isFinite(+ap)||!Number.isFinite(+dp))throw Error('Enter valid battle power values.');if(atk&&def){if(+ap<=+dp)reverseCharacter(s,a.attack.ref);if(+dp<=+ap)reverseCharacter(s,a.attack.defender);log(s,'Battle '+ap+' versus '+dp+'; lower power reversed (both on tie).');}prepend(s,{type:'attack-end'});break;}
  case 'target-effect':{
   const picked=c.picked||[];
   if(value==='pass'){for(const ref of picked)effect(s,ref,{power:c.task.power,soul:c.task.soul},c.task.label);}
   else chooseEntryTargets(s,c.task,[...picked,option.ref]);
   break;
  }
  case 'entry-stock':
   if(value!=='pass')take(s,option.ref,'stock');
   prepend(s,{...c.task,type:'entry-global-apply'});
   break;
  case 'encore-select':{const obj=take(s,option.ref,'waiting');prepend(s,check(s,'Character moved from stage to waiting'),{type:'encore-offer',p:option.ref.p,position:option.ref.z,card:obj});break;}
  case 'encore-offer':{const t=c.task;if(value==='pay'){for(let i=0;i<3;i++)take(s,{p:t.p,z:'stock',uid:z(s,t.p).stock.at(-1).uid},'waiting');if(z(s,t.p).waiting.some(x=>x.uid===t.card.uid)){for(const old of [...z(s,t.p)[t.position]])take(s,{p:t.p,z:t.position,uid:old.uid},'waiting');const obj=take(s,{p:t.p,z:'waiting',uid:t.card.uid},t.position);obj.orientation='rest';}}if(value==='manual'){choice(s,'encore-manual','Resolve the alternative Encore and its complete cost manually',[{value:'done',label:'Encore resolved / declined'}]);}prepend(s,{type:'encore'});break;}
  case 'discard':take(s,{p:c.p,z:'hand',uid:value},'waiting');prepend(s,{type:'end-discard'});break;
  case 'turn-ready':s.turn++;s.active=1-s.active;s.phase=0;s.attacksThisTurn=0;s.attackType=null;prepend(s,check(s,'Beginning of stand phase'),{type:'stand'});break;
  case 'blocked':prepend(s,c.task);break;
  default:break;
 }run(s);}
 function ruleInterrupts(s){const a=auto(s),pending=a.choice;if(pending&&['level','level-order','rule-order'].includes(pending.kind))return; a.choice=null;let guard=0;while(!a.choice&&!a.gameOver&&guard++<20&&interrupts(s)){}if(pending&&!a.gameOver){if(a.choice)prepend(s,{type:'resume-choice',choice:pending});else a.choice=pending;}}
 // A top-deck trigger move must also run the same interrupt checks as every other transfer.
 function afterMutation(s,before){
  const a=auto(s);
  a.effects=a.effects.filter(e=>(e.expires==='persistent'||e.turn===s.turn)&&allStage(s,e.p).some(r=>r.uid===e.uid));
  if(before)for(const p of [s.active,1-s.active]){
   const prior=before.players[p].zones;
   const q=z(s,p);
   const sources=[...allStage(s,p),...q.climax.map(c=>({p,z:'climax',uid:c.uid}))];
   for(const source of sources){
    const card=inst(s,source);
    if(prior.hand.some(c=>c.uid===card.uid))queueTriggered(s,source,card,source.z==='climax'?'climax':'stage');
   }
   for(const slot of stageKeys)for(const card of prior[slot]){
    const ref={p,z:slot,uid:card.uid};
    const unchanged=timing=>(before.auto?.triggerMarks?.[card.uid+':'+timing]||0)===(a.triggerMarks?.[card.uid+':'+timing]||0);
    if(unchanged('waiting')&&q.waiting.some(c=>c.uid===card.uid))queueTriggered(s,ref,card,'waiting');
    const current=stageKeys.flatMap(key=>q[key]).find(c=>c.uid===card.uid);
    if(!current&&a.activatedUses)delete a.activatedUses[card.uid];
    if(unchanged('reverse')&&card.orientation!=='reverse'&&current?.orientation==='reverse')queueTriggered(s,ref,current,'reverse');
   }
  }
  run(s);
 }
 function endAttacks(s){const a=auto(s);if(a.choice||a.reveal||a.paused||a.queue.length||a.attack)throw Error('Finish the current attack or choice.');prepend(s,check(s,'Beginning of encore step'),{type:'encore'});run(s);}
 function procedure(s,tasks){const a=auto(s);if(a.reveal)throw Error('Wait for the current card check to finish.');if(a.damage)throw Error('Finish the pending damage instance first.');const pending=a.choice;if(pending&&!['checkpoint','manual-counter','encore-manual'].includes(pending.kind))throw Error('Finish the current choice first.');a.choice=null;prepend(s,...tasks,pending?{type:'resume-choice',choice:pending}:null);run(s);}
 function damage(s,p,n,source){if(!Number.isInteger(n)||n<1||n>50)throw Error('Damage must be an integer from 1 to 50.');procedure(s,[{type:'effect-damage',p,n,source,label:'Separate effect damage'},check(s,'After effect damage')]);}
 function drawCards(s,p,n){procedure(s,Array.from({length:n},()=>({type:'draw',p})));}
 function advance(s){const a=auto(s);if(a.choice||a.reveal||a.paused||a.queue.length||a.attack||a.gameOver)throw Error('Finish the current resolution before advancing.');if(s.phase===5)return endAttacks(s);if(s.phase===0){prepend(s,check(s,'Beginning of stand phase'),{type:'stand'});}else if(s.phase===1){prepend(s,{type:'draw-phase'});}else if(s.phase===6){prepend(s,check(s,'Beginning of end phase'),{type:'end-discard'});}else{s.phase++;if(s.phase===5){a.attackPhaseTurn=s.turn;s.step='Attack declaration';}else s.step=['Stand','Draw','Clock','Main','Climax','Attack','End'][s.phase];prepend(s,check(s,'Beginning of '+['Stand','Draw','Clock','Main','Climax','Attack','End'][s.phase]+' phase'),s.phase===5?check(s,'Beginning of attack declaration step'):null);}run(s);}
 function finishReveal(s,id){const a=auto(s);if(!a.reveal||a.reveal.id!==id)throw Error('This reveal has already finished.');a.reveal=null;run(s);}
 function payResonate(s,task,reveal){
  const {ref,action,index,label,text}=task,q=z(s,ref.p);
  const source=inst(s,ref),card=inst(s,reveal);
  if(source?.orientation!=='stand'||q.stock.length<action.stock||!card||getCardName(get(card.id))!==action.revealName)throw Error('You cannot pay the full Resonate cost.');
  for(let i=0;i<action.stock;i++)take(s,{p:ref.p,z:'stock',uid:q.stock.at(-1).uid},'waiting');
  source.orientation='rest';
  const a=auto(s);
  if(action.once){a.activatedUses??={};a.activatedUses[ref.uid]??={};a.activatedUses[ref.uid][index]=s.turn;}
  log(s,'Player '+(ref.p+1)+' activated '+label+' · '+text);
  flash(s,ref.p,card,'ability','Resonate cost · Reveal '+action.revealName);
  prepend(s,{...action.task,p:ref.p,label,source:ref},check(s,'After activated ability'));
 }
 function activate(s,ref,index){
  const a=auto(s),instance=inst(s,ref),card=get(instance?.id);
  if(!a.enabled||a.choice||a.reveal||a.paused||a.queue.length||a.attack||a.gameOver||s.cost||s.botOpening!=null)throw Error('Finish the current resolution before activating an ability.');
  if(s.phase!==3||s.active!==ref.p||!stage(ref.z)||instance?.faceDown||card?.type!=='Character')throw Error('Use a stage character’s ACT ability during your Main phase.');
  const selected=activatedAbilities(card)[index];
  if(!selected?.action)throw Error('This ACT ability requires manual resolution.');
  const action=selected.action,q=z(s,ref.p),label=card.code||card.name;
  if(action.once&&a.activatedUses?.[ref.uid]?.[index]===s.turn)throw Error('This ability has already been activated this turn.');
  if(q.stock.length<action.stock||action.rest&&instance.orientation!=='stand')throw Error('You cannot pay the full cost of this ability.');
  if(action.revealName){
   if(action.kind!=='simple')throw Error('This Resonate effect requires manual resolution.');
   const options=q.hand.filter(c=>getCardName(get(c.id))===action.revealName).map(c=>({value:c.uid,label:get(c.id)?.code||action.revealName,card:c.id,ref:{p:ref.p,z:'hand',uid:c.uid}}));
   if(!options.length)throw Error('Resonate requires a card named '+action.revealName+' in your hand.');
   const task={ref,action,index,label,text:selected.text};
   if(options.length===1)payResonate(s,task,options[0].ref);
   else choice(s,'ability-resonate','Hand · Choose a '+action.revealName+' to reveal for Resonate',options,{p:ref.p,task});
   return;
  }
  if(action.once){a.activatedUses??={};a.activatedUses[ref.uid]??={};a.activatedUses[ref.uid][index]=s.turn;}
  for(let i=0;i<action.stock;i++)take(s,{p:ref.p,z:'stock',uid:q.stock.at(-1).uid},'waiting');
  if(action.rest)instance.orientation='rest';
  if(action.sacrifice)take(s,ref,'waiting');
  log(s,'Player '+(ref.p+1)+' activated '+label+' · '+selected.text);
  const tasks=[];
  if(['draw','draw-discard'].includes(action.kind))tasks.push({type:'draw',p:ref.p});
  if(action.kind==='simple')tasks.push({...action.task,p:ref.p,label,source:ref});
  else if(action.kind!=='draw')tasks.push({type:'act-effect',p:ref.p,action,label,source:ref});
  prepend(s,...tasks,check(s,'After activated ability'));
  run(s);
 }
 return {ruleInterrupts,stats,beginAttack,respond,finishReveal,run,advance,afterMutation,endAttacks,damage,drawCards,counters,allStage,inst,activate,manualEffect:effect,auto};
}
