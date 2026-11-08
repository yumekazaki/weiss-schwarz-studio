import {noSideAttack} from './engine.mjs';
export const stagePositions=['center-left','center-middle','center-right','back-left','back-right'];
export const statAdjustments=[
 {label:'Gain +1 soul until end of turn',stat:'soul',amount:1,duration:'turn'},
 {label:'Gain 1000',stat:'power',amount:1000,duration:'persistent'},
 {label:'Gain 1000 until end of turn',stat:'power',amount:1000,duration:'turn'},
 {label:'Gain 500',stat:'power',amount:500,duration:'persistent'},
 {label:'Gain 500 until end of turn',stat:'power',amount:500,duration:'turn'},
];
export const facingPosition=z=>({'center-left':'center-right','center-middle':'center-middle','center-right':'center-left'})[z];
export const cardMoveOptions=[
 ['waiting','top','Move to waiting room'],
 ['deck','top','Put on top of deck'],
 ['deck','bottom','Put on bottom of deck'],
 ['hand','top','Move to hand'],
 ['stock','top','Put on top of stock'],
 ['stock','bottom','Put on bottom of stock'],
 ['clock','top','Put on top of clock'],
 ['clock','bottom','Put on bottom of clock'],
 ['level','top','Move to level'],
 ['memory','top','Place in memory face up',false],
 ['memory','top','Place in memory face down',true],
 ['climax','top','Move to climax area'],
 ['resolution','top','Move to resolution'],
];
export function cardContext({match,ref,card,englishAbility=''}){
 const player=match.players[ref.p],ownTurn=match.active===ref.p,phase=match.phase,out=[];
 const add=(key,label,options={})=>out.push({key,label,...options});
 if(ref.z==='hand'){
  if(!player.mulligan&&match.turn===1&&phase===0)add('mulligan','Mulligan this card',{hint:'Select several cards to mulligan together before beginning the first turn.'});
  if(ownTurn&&phase===2)add('clock','Clock this card & draw 2');
  if(ownTurn&&phase===3&&card?.type==='Character')add('play-stage','Play to stage…',{hint:'Check level, color and costs; resolve abilities manually.'});
  if(ownTurn&&phase===3&&card?.type==='Event')add('event','Play event → resolution',{hint:'Pay costs and resolve the card manually.'});
  if(ownTurn&&phase===4&&card?.type==='Climax')add('climax','Play climax');
  const counterText=englishAbility+' '+(card?.ability||[]).join(' ');
  if(!ownTurn&&phase===5&&match.step==='Counter'&&(!match.attackType||match.attackType==='Frontal')&&/COUNTER|BACKUP|助太刀|カウンター/i.test(counterText)){if(card?.type==='Event')add('counter','Play counter event → resolution',{hint:'One counter play timing. Pay costs and resolve its text manually.'});else if(/BACKUP|助太刀/i.test(counterText))add('backup','Use backup: resolve its cost…',{hint:'This is an ability from hand; the character is not played onto the stage.'});else add('counter-ability','Activate counter ability…',{hint:'Pay the printed cost and resolve the ability manually.'});}
  add('discard','Discard to waiting room');
 }
 if(stagePositions.includes(ref.z)){
  const instance=player.zones[ref.z].find(c=>c.uid===ref.uid);
  if(ownTurn&&phase===5&&ref.z.startsWith('center-')&&instance?.orientation==='stand'&&match.step==='Attack declaration'){
   if(match.turn===1&&(match.attacksThisTurn||0)>=1)add('first-turn-limit','First turn: one attack already declared',{disabled:true});
   else{const opponent=match.players[1-ref.p].zones[facingPosition(ref.z)];if(!opponent?.length)add('attack-direct','Direct attack',{hint:'No opposing character. Apply +1 soul manually.'});else{add('attack-frontal','Frontal attack');if(!(card?.ability||[]).flatMap(text=>text.split('\n')).some(noSideAttack))add('attack-side','Side attack',{hint:'Apply the opposing character’s level as the soul reduction manually.'});}}
  }
  if(ownTurn&&phase===3)add('swap-stage','Move / swap stage position…');
  if(instance?.orientation!=='rest')add('rest','Rest character');
  if(instance?.orientation!=='stand')add('stand-selected','Stand character');
  if(instance?.orientation!=='reverse')add('reverse','Reverse character');
  add('discard','Move to waiting room');
 }
 if(ref.z==='waiting'){add('return-hand','Return to hand');if(card?.type==='Character')add('return-stage-rested','Return to stage rested…',{hint:'For encore or effects: pay the applicable cost separately and choose the appropriate position.'});add('deck-top','Return to deck top');add('deck-bottom','Return to deck bottom');}
 if(ref.z==='deck'){const top=player.zones.deck.at(-1);if(top?.uid===ref.uid){add('draw','Draw top card');add('trigger','Reveal top card → resolution');}add('return-hand','Take chosen card to hand',{hint:'Search / effect movement; shuffle afterward when required.'});add('shuffle','Shuffle deck');}
 if(ref.z==='stock'){if(player.zones.stock.at(-1)?.uid===ref.uid)add('pay','Pay top stock');else add('stock-order','Stock costs are paid from the top',{disabled:true});}
 if(ref.z==='clock'&&player.zones.clock.length>=7){const i=player.zones.clock.findIndex(c=>c.uid===ref.uid);if(i<7)add('level','Choose this card for level-up');else add('clock-order','Choose a card from the bottom seven',{disabled:true});}
 if(ref.z==='resolution'){const d=match.damage[ref.p];if(d){if(d.canceled||!d.remaining)add('damage-finish',d.canceled?'Resolve canceled damage':'Resolve damage → clock');else add('damage-reveal','Reveal next damage card');}else{add('stock','Finish trigger → stock');add('discard','Send to waiting room');}}
 if(ref.z==='climax')add('discard','Clear climax → waiting room');
 if(ref.z==='memory'||ref.z.startsWith('markers:')){add('flip','Flip face up / down');add('reveal','Reveal / hide card');add('return-hand','Return to hand');}
 return out;
}
