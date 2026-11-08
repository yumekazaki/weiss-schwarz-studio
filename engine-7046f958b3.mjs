export const zones=['deck','hand','waiting','stock','clock','level','memory','climax','resolution','center-left','center-middle','center-right','back-left','back-right',...['center-left','center-middle','center-right','back-left','back-right'].map(x=>'markers:'+x)];
export const phases=['Stand','Draw','Clock','Main','Climax','Attack','End'];
export const stage=z=>/^(center|back)-/.test(z);
export const noSideAttack=text=>/^(?:【CONT】 This card cannot side attack\.|【永】 このカードはサイドアタックできない。)$/i.test(text.trim());
export function handLevelRule(text){
 const en=text.match(/^【CONT】 If your waiting room has (\d+) or less climax(?:es)?, this card gets -(\d+) level while in your hand\.$/i);
 const jp=text.match(/^【永】 あなたの控え室のクライマックスが(\d+)枚以下なら、あなたの手札のこのカードのレベルを[－−-](\d+)。$/);
 const match=en||jp;
 return match?{maximum:+match[1],reduction:+match[2]}:null;
}
export function playFromHandError(card,zones,phase,get){
 if(!card)return 'Card data is unavailable.';
 const climax=card.type==='Climax';
 if(climax?phase!==4:phase!==3)return climax?'Play climaxes during your Climax phase.':'Play characters and events during your Main phase.';
 if(climax&&zones.climax.length)return 'You can play only one climax.';
 const climaxCount=zones.waiting.filter(c=>get(c.id)?.type==='Climax').length;
 const reduction=(card.ability||[]).flatMap(text=>text.split(/\r?\n/)).map(text=>handLevelRule(text.trim())).reduce((sum,rule)=>sum+(rule&&climaxCount<=rule.maximum?rule.reduction:0),0);
 const level=climax?0:Math.max(0,Number(card.level)-reduction);
 const cost=climax?0:Number(card.cost)||0;
 if(!Number.isFinite(level)||level>zones.level.length)return 'Card level is too high.';
 if((climax||level>0)&&![...zones.clock,...zones.level].some(c=>get(c.id)?.color===card.color))return 'You need a matching color in your Clock or Level.';
 if(zones.stock.length<cost)return 'This card costs '+cost+' Stock. You only have '+zones.stock.length+'.';
 return null;
}
export const shuffle=a=>{for(let i=a.length-1;i>0;i--){const range=i+1,limit=Math.floor(4294967296/range)*range;let n;do{n=crypto.getRandomValues(new Uint32Array(1))[0];}while(n>=limit);const j=n%range;[a[i],a[j]]=[a[j],a[i]];}return a;};
export function validate(deck,catalog,format='Standard',language='EN'){
 const errors=[],warnings=[],names=new Map(),entries=Object.entries(deck).map(([id,n])=>[catalog.get(id),Number(n)]);let total=0,cx=0;
 for(const [c,n] of entries){if(!c){errors.push('Unknown card in deck');continue;}if(!Number.isInteger(n)||n<1){errors.push('Invalid card count');continue;}total+=n;if(c.type==='Climax')cx+=n;names.set(c.name,(names.get(c.name)||0)+n);if(language!=='Mixed'&&c.language!==language)errors.push('Card edition differs from deck setting: '+c.code+'. Select Mixed if intended.');}
 if(total!==50)errors.push(`Deck has ${total}/50 cards`);if(cx>8)errors.push(`${cx}/8 climax cards`);
 for(const [name,n] of names){const c=entries.find(([c])=>c?.name===name)[0],text=c.ability.join(' ');let limit=4;const match=text.match(/(?:can|may) (?:put|have|include) up to (\d+) cards? with the same card name as this card (?:into|in) your deck/i);if(match)limit=+match[1];if(/(?:can|may) (?:put|have|include) any number of cards? with the same card name as this card (?:into|in) your deck/i.test(text))limit=50;if(n>limit)errors.push(`${name}: ${n}/${limit} copies`);if(/(?:can|may) (?:put|have|include) (?:any number|up to \d+) cards? with the same card name|デッキ.*(?:枚まで|好きな枚数)/i.test(text))warnings.push('Construction text applied where recognized; review: '+c.code);}
 const rows=entries.filter(([c])=>c);if(format==='Neo Standard'&&new Set(rows.map(([c])=>c.series)).size>1)warnings.push('Multiple title codes: check official Neo Standard group exceptions.');
 if(format==='Side'&&new Set(rows.map(([c])=>c.side)).size>1)errors.push('Multiple sides in Side format');
 if(language==='Mixed')warnings.push('Mixed editions are for casual play. Cross-edition copy limits and title exceptions need manual review.');
 if(language==='JP')warnings.push('Japanese restriction list and title exceptions require official review.');
 warnings.push('Validation covers basic construction; confirm current restrictions and special deck text.');
 for(const [c] of entries){if(!c)continue;for(const text of c.ability){const combined=text.match(/can put up to (\d+) cards with the same card name as this card and cards named "(.+)" in your deck/i);if(combined){const n=(names.get(c.name)||0)+(names.get(combined[2])||0);if(n>+combined[1])errors.push(`${c.name} + ${combined[2]}: ${n}/${combined[1]} combined copies`);}}}
 return {total,cx,errors:[...new Set(errors)],warnings:[...new Set(warnings)]};
}
export function createMatch(decks){let uid=0;const s={players:decks.map(d=>({zones:Object.fromEntries(zones.map(z=>[z,[]])),mulligan:false})),turn:1,active:0,phase:0,step:'Attack declaration',log:[],damage:[null,null],cost:false};decks.forEach((d,p)=>{s.players[p].zones.deck=shuffle(Object.entries(d).flatMap(([id,n])=>Array.from({length:n},()=>({uid:String(++uid),id,orientation:'stand',faceDown:false,revealed:false,note:''}))));});return s;}
export function draw(s,p,n=1,to='hand'){const z=s.players[p].zones;let moved=0;for(let i=0;i<n;i++){if(!z.deck.length)break;z[to].push(z.deck.pop());moved++;}return moved;}
export function move(s,refs,p,to,position='top'){const result=[];for(const r of refs){const z=s.players[r.p].zones[r.z],i=z.findIndex(c=>c.uid===r.uid);if(i<0)continue;const [c]=z.splice(i,1);
 if(stage(r.z)&&r.z!==to){
  const markers=s.players[r.p].zones['markers:'+r.z].splice(0);
  if(stage(to)&&p===r.p)s.players[p].zones['markers:'+to].push(...markers);
  else{for(const marker of markers){marker.faceDown=false;marker.revealed=false;marker.orientation='stand';}s.players[r.p].zones.waiting.push(...markers);}
 }
 if(!stage(r.z)||!stage(to))c.orientation='stand';c.revealed=false;result.push(c);}const dest=s.players[p].zones[to];if(position==='bottom')dest.unshift(...result);else dest.push(...result);return result;}
export function refresh(s,p){const z=s.players[p].zones;if(z.deck.length)throw Error('Refresh requires an empty deck. Move remaining cards manually for a special effect.');if(!z.waiting.length)throw Error('Waiting room is empty; resolve pending damage or check loss conditions.');z.deck=shuffle(z.waiting.splice(0));draw(s,p,1,'clock');}
export function levelUp(s,p,uid){const z=s.players[p].zones;if(z.clock.length<7)throw Error('At least 7 clock cards are needed.');const seven=z.clock.slice(0,7),chosen=seven.find(c=>c.uid===uid);if(!chosen)throw Error('Choose one of the bottom seven clock cards.');z.clock.splice(0,7);z.level.push(chosen);z.waiting.push(...seven.filter(c=>c!==chosen));}
export function startDamage(s,p,n){if(s.damage[p])throw Error('Finish the pending damage first.');s.damage[p]={remaining:n,canceled:false,uids:[]};}
export function damageReveal(s,p,catalog){const d=s.damage[p];if(!d||!d.remaining||d.canceled)throw Error('No further damage card is needed.');const z=s.players[p].zones;if(!z.deck.length)throw Error('Deck empty: refresh before continuing damage.');const c=z.deck.pop();z.resolution.push(c);d.uids.push(c.uid);d.remaining--;if(catalog.get(c.id)?.type==='Climax')d.canceled=true;}
export function finishDamage(s,p){const d=s.damage[p];if(!d)throw Error('No pending damage.');if(d.remaining&&!d.canceled)throw Error('Reveal the remaining damage cards first.');move(s,d.uids.map(uid=>({p,z:'resolution',uid})),p,d.canceled?'waiting':'clock');s.damage[p]=null;}
export function nextPhase(s){if(s.phase===6){s.phase=0;s.active=1-s.active;s.turn++;}else s.phase++;}
