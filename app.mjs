import {mountOnline} from './online-ui.mjs';
import {nextPracticeBotAction,practiceMulligan} from './practice-bot.mjs';
import {activatedAbilities,createResolver,parseAbility} from './automation.mjs';
import {mountResolution} from './resolution-ui.mjs';
import {mountAtelier} from './atelier-ui.mjs';
import {createPresentation,decodeText} from './presentation.mjs';
import {zones,phases,stage,shuffle,validate,createMatch,draw,move,refresh,levelUp,startDamage,damageReveal,finishDamage,nextPhase,playFromHandError} from './engine.mjs';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)], esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const read=(k,f)=>{try{return JSON.parse(localStorage.getItem(k))??f;}catch{return f;}};
const persist=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v));}catch{toast('Browser storage is full or unavailable. Export your decks to keep a copy.');}};
let design=null,resolutionUI=null,catalogReady=false;
function rulesCard(id){const c=catalog.get(id);if(!c)return null;const local=presentation?.get(id);return {...c,name:local?.name||c.name,ability:local?.kind==='official'&&local?.ability?.length?local.ability:c.ability};}
const resolver=createResolver(rulesCard);
let cards=[],catalog=new Map(),presentation=null,seriesNames={},translationReferences={},includedDecks=[],coverage={},restrictions=null,jpRestrictions=null,page=0,filtered=[],activeView='home',draft=read('ws-draft',{name:'Untitled deck',cards:{},format:'Standard',language:'EN'}),saved=read('ws-decks',[]),match=read('ws-match',null),history=[],future=[],selected=[],pile=null;
let practiceDeck=saved.find(deck=>deck.id && deck.id===draft.id)||null;
const colors={YELLOW:'#e7c967',GREEN:'#83c399',RED:'#e88a8c',BLUE:'#88b2e6',PURPLE:'#bc95dc'};
const zoneName=z=>z.startsWith('markers:')?'Markers · '+zoneName(z.slice(8)):({'deck':'Deck','hand':'Hand','waiting':'Waiting room','stock':'Stock','clock':'Clock','level':'Level','memory':'Memory','climax':'Climax area','resolution':'Resolution zone','center-left':'Center · left','center-middle':'Center · middle','center-right':'Center · right','back-left':'Back · left','back-right':'Back · right'})[z]||z;
function toast(s){$('#toast').textContent=s;$('#toast').style.display='block';clearTimeout(toast.timer);toast.timer=setTimeout(()=>$('#toast').style.display='none',4500);}
function showDialog(html){$('#dialog').dataset.kind='other';$('#dialog-body').innerHTML=html;$('#dialog').scrollTop=0;if(!$('#dialog').open)$('#dialog').showModal();}
$('#close-dialog').onclick=()=>{$('#dialog').close();pile=null;};$('#dialog').onclick=e=>{if(e.target===$('#dialog')){$('#dialog').close();pile=null;}};
function view(v){activeView=v;resolutionUI?.viewChanged(v);$$('.view').forEach(x=>x.hidden=x.id!==v);$$('nav button').forEach(x=>x.classList.toggle('active',x.dataset.view===v));design?.onView(v);if(v==='decks')renderDeck();if(v==='practice'){renderSetup();renderMatch();}window.scrollTo({top:0,behavior:'smooth'});}
$$('[data-view]').forEach(b=>b.onclick=()=>view(b.dataset.view));$('.brand').onclick=e=>{e.preventDefault();view('home');};
function img(c,extra=''){return `<img src="${esc(c.image)}" alt="${esc(displayName(c))} · ${esc(c.code)}" loading="lazy" referrerpolicy="no-referrer" class="${extra}">`;}
document.addEventListener('error',e=>{if(e.target.tagName==='IMG'){e.target.alt='Official artwork unavailable · '+e.target.alt;e.target.title=e.target.alt;}},true);

function displayName(c){if(!c)return 'Loading card…';const p=presentation?.get(c);return p&&p.name!=='English name unavailable'?p.name:decodeText(c?.name||'');}
function fullSeries(c){if(!c)return 'Loading series…';return presentation?.get(c)?.series||seriesNames[c?.series]||'Series name unavailable';}
function rebuildPresentation(){presentation=createPresentation(cards,seriesNames,translationReferences);}
function nameBadge(c){if(c.language!=='JP')return '';const p=presentation?.get(c);return '<small class="name-provenance '+(p?.nameKind||'missing')+'">'+(p?.nameKind==='machine'?'Machine-translated name · unreviewed':p?.nameKind==='unofficial'?'Unofficial English name':p?.nameKind==='official'?'Official English name':'English name translation missing')+'</small>';}
function translationPanel(c,p){if(c.language!=='JP')return '';const body=p.ability?.length===0?'No printed abilities':p.kind==='official'?'Official English text · equivalent card '+esc(p.equivalent):p.textKind==='machine'?'Machine-assisted English gameplay text · unreviewed':p.textKind==='community'?'Unofficial English gameplay text':p.ability?.length===0?'No printed abilities':'English gameplay translation missing';return '<div class="translation-status '+(p.kind==='official'?'official':'unofficial')+'"><b>'+body+'</b><p>'+(p.ability?.length===0?'This printing has no printed ability text.':p.kind==='official'?'Official English localization. Japanese artwork and card identity are preserved.':p.textKind==='machine'?'Read the English text below. This translation is unreviewed and may contain errors; confirm unusual interactions against the original. Effects from this translation remain manual.':p.textKind==='community'?'Read the translated abilities below. This is community wording, not official Bushiroad localization. Effects remain manual.':p.ability?.length===0?'This printing has no printed ability text.':'No inline translation is available for this printing yet.')+'</p><small>Name: '+esc(p.nameSource||'Original')+(p.nameUncertain?' · proper-name reading needs review':'')+'</small>'+(p.nameSourceUrl?'<a href="'+esc(p.nameSourceUrl)+'" target="_blank" rel="noopener">Name source ↗</a>':'')+(p.textSourceUrl?'<a href="'+esc(p.textSourceUrl)+'" target="_blank" rel="noopener">Gameplay text source ↗</a>':'')+'</div>';}
function cardTextStatus(c,p){if(c.language!=='JP')return '';return '<p class="inline-text-status '+(p.kind==='official'?'official':'unofficial')+'">'+(p.kind==='official'?'Official English wording':p.textKind==='machine'?'Machine-assisted English text · unreviewed':'Unofficial English text')+'</p>';}
function referencePanel(c,p){return '';}
function readableDetails(id){const c=catalog.get(id);if(!c)return '<p>Card details unavailable.</p>';const p=presentation?.get(c)||{name:decodeText(c.name),traits:c.attributes,ability:c.ability,kind:'missing'};return '<p class="eyebrow">'+esc(c.language)+' · '+esc(c.rarity)+' · '+esc(c.type)+'</p><h2>'+esc(p.name)+'</h2>'+(c.language==='JP'?'<p class="original-name">'+esc(p.originalName||c.name)+'</p>':'')+'<p class="series-name">'+esc(fullSeries(c))+'</p><small>'+esc(c.code)+'</small>'+'<p>Level '+esc(c.level||'0')+' · Cost '+esc(c.cost||'0')+' · Power '+esc(c.power||'—')+' · Soul '+esc(c.soul||'—')+'</p><p>Traits: '+(p.traits===null?'<span class="translation-missing">English trait translation unavailable</span>':esc(p.traits.join(' / ')||'None')+(p.traitKind==='machine'?' <small class="translation-missing">(machine translated · unreviewed)</small>':''))+'</p><p>Trigger: '+esc(c.trigger?.join(' / ')||'None')+'</p>'+cardTextStatus(c,p)+'<div class="ability">'+(p.ability===null?'<p class="translation-missing">English gameplay translation is unavailable for this printing. Original Japanese text is available below.</p>':p.ability.map(a=>'<p>'+esc(a)+'</p>').join(''))+'</div>'+(c.language==='JP'?'<details class="translation-source-details"><summary>Translation sources & notes</summary>'+translationPanel(c,p)+'</details>':'')+referencePanel(c,p)+(c.language==='JP'?'<details class="original-text"><summary>Original Japanese gameplay text</summary><p>'+esc(c.attributes.join(' / '))+'</p><p>'+c.ability.map(esc).join('<br>')+'</p></details>':'');}
const artDialog=document.createElement('dialog');artDialog.id='artwork-dialog';artDialog.setAttribute('aria-label','Full-screen card artwork');document.body.append(artDialog);let artReturnFocus=null;
function closeArtwork(){if(!artDialog.open)return;artDialog.close();artDialog.innerHTML='';artReturnFocus?.focus?.({preventScroll:true});}
function enlargeArtwork(id){const c=catalog.get(id);if(!c)return;design?.hidePreview();design?.closeMenu();artReturnFocus=$('#enlarge-card-art')||document.activeElement;artDialog.innerHTML='<div class="artwork-full-toolbar"><span>'+esc(displayName(c))+' · '+esc(c.code)+'</span><button id="close-artwork" aria-label="Back to card details">← Back to details</button></div><div class="artwork-full-image">'+img(c)+'</div>';if(!artDialog.open)artDialog.showModal();$('#close-artwork').onclick=closeArtwork;}
artDialog.onclick=e=>{if(e.target===artDialog||e.target.classList.contains('artwork-full-image'))closeArtwork();};artDialog.addEventListener('cancel',e=>{e.preventDefault();closeArtwork();});document.addEventListener('keydown',e=>{if(artDialog.open&&e.key==='Escape'){e.preventDefault();e.stopImmediatePropagation();closeArtwork();}},true);
function inspect(id){const c=catalog.get(id);if(!c)return;design?.hidePreview();design?.closeMenu();pile=null;showDialog('<div class="preview pinned-preview"><div class="pinned-image"><button id="enlarge-card-art" class="pinned-art-zoom" aria-label="View full-screen artwork for '+esc(displayName(c))+'">'+img(c)+'</button><p class="artwork-caption">'+(c.language==='JP'?'Official Japanese artwork · unchanged':'Official card artwork')+'<br>Click or tap artwork to view full screen</p></div><div class="pinned-text" tabindex="0" aria-label="Scrollable English card details">'+readableDetails(id)+'<p><button class="primary" id="preview-add">+ Add to deck</button></p><a href="'+esc(c.image)+'" target="_blank" rel="noopener">Open official artwork ↗</a></div></div>');$('#dialog').dataset.kind='card';$('#preview-add').onclick=()=>add(id);$('#enlarge-card-art').onclick=()=>enlargeArtwork(id);}
function seriesOptions(){const language=$('#language').value,current=$('#series').value,names=[...new Set(cards.filter(c=>!language||c.language===language).map(fullSeries))].sort((a,b)=>a.localeCompare(b));$('#series').innerHTML='<option value="">All titles</option>'+names.map(name=>'<option value="'+esc(name)+'">'+esc(name)+'</option>').join('');if(names.includes(current))$('#series').value=current;}
function filter(reset=true){if(reset)page=0;const values=Object.fromEntries(['language','series','type','color','level','cost','trait','rarity','power','trigger','sort','search'].map(id=>[id,$('#'+id).value.trim()])),value=id=>values[id]||'',q=value('search').toLowerCase();filtered=cards.filter(c=>(!value('language')||c.language===value('language'))&&(!value('series')||fullSeries(c)===value('series'))&&(!value('type')||c.type===value('type'))&&(!value('color')||c.color===value('color'))&&(!value('level')||String(c.level)===value('level'))&&(!value('cost')||+c.cost===+value('cost'))&&(!value('power')||+c.power>=+value('power'))&&(!value('trait')||c.attributes.join(' ').toLowerCase().includes(value('trait').toLowerCase()))&&(!value('rarity')||(c.rarity+' '+c.variant).toLowerCase().includes(value('rarity').toLowerCase()))&&(!value('trigger')||c.trigger?.join(' ').toLowerCase().includes(value('trigger').toLowerCase()))&&(!q||presentation.matches(c,q)));
 const sort=value('sort');filtered.sort((a,b)=>sort==='level'||sort==='power'?(+a[sort]||0)-(+b[sort]||0):String(sort==='name'?displayName(a):a[sort]).localeCompare(String(sort==='name'?displayName(b):b[sort])));renderGrid();}
function renderGrid(){const size=24,items=filtered.slice(page*size,(page+1)*size);$('#results').textContent=filtered.length.toLocaleString()+' cards found';$('#grid').innerHTML=items.map(c=>`<article class="card-tile" data-hover-card="${esc(c.id)}"><button class="art-button" data-add="${esc(c.id)}" aria-label="Add ${esc(displayName(c))} to deck">${img(c,'card-art')}</button><button class="library-zoom" data-inspect="${esc(c.id)}" aria-label="Inspect ${esc(displayName(c))}">⤢</button><span class="card-name" title="${esc(displayName(c))}">${esc(displayName(c))}</span><span class="card-code"><i class="color-dot" style="background:${colors[c.color]||'#aaa'}"></i>${esc(c.code)} · ${esc(c.rarity)}</span><span class="card-series">${esc(fullSeries(c))}</span>${nameBadge(c)}<button class="card-add" data-add="${esc(c.id)}" aria-label="Add ${esc(displayName(c))}">+</button></article>`).join('')||'<p class="muted">No cards match these filters.</p>';$('#page-count').textContent=`${page+1} / ${Math.max(1,Math.ceil(filtered.length/size))}`;$('#prev').disabled=!page;$('#next').disabled=(page+1)*size>=filtered.length;}
['language','series','type','color','level','cost','trait','rarity','power','trigger','sort'].forEach(id=>$('#'+id).onchange=()=>{if(id==='language')seriesOptions();filter();});let timer;$('#search').oninput=()=>{clearTimeout(timer);timer=setTimeout(filter,180);};$('#prev').onclick=()=>{page--;renderGrid();};$('#next').onclick=()=>{page++;renderGrid();};$('#clear-filters').onclick=()=>{['language','series','type','color','level','cost','trait','rarity','power','trigger','search'].forEach(id=>$('#'+id).value='');seriesOptions();filter();};document.addEventListener('keydown',e=>{if(e.key==='/'&&!/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) {e.preventDefault();view('library');$('#search').focus();}if((e.ctrlKey||e.metaKey)&&e.key==='z'&&activeView==='practice'&&!/INPUT|TEXTAREA/.test(e.target.tagName)){e.preventDefault();undo();}});
function add(id){draft.cards[id]=(draft.cards[id]||0)+1;saveDraft();renderDock();if(activeView==='decks')renderDeck();toast('Added '+displayName(catalog.get(id)));}
function saveDraft(){persist('ws-draft',draft);}
function renderDock(){const total=Object.values(draft.cards).reduce((a,b)=>a+b,0);$('#dock-name').textContent=draft.name;$('#dock-total').textContent=total;$('#saved-count').textContent=saved.length;$('#dock-cards').innerHTML=Object.entries(draft.cards).slice(-5).map(([id,n])=>`<div class="dock-row"><b>${n}×</b><span>${esc(catalog.has(id)?displayName(catalog.get(id)):id)}</span></div>`).join('');}
function checkJP(v){if(!jpRestrictions)return v;const names=new Map(),codeNames=new Map(cards.filter(c=>c.language==='JP').map(c=>[c.code,c.name]));for(const [id,n] of Object.entries(draft.cards)){const c=catalog.get(id);if(c?.language==='JP')names.set(c.name,(names.get(c.name)||0)+n);}if(draft.format!=='Neo Standard'){const bannedNames=new Set(jpRestrictions.standardBans.map(code=>codeNames.get(code)).filter(Boolean));for(const name of names.keys())if(bannedNames.has(name))v.errors.push(name+': banned by Japanese Standard/Side list');return v;}for(const r of jpRestrictions.rules){const used=r.options.map(option=>[...new Set(option.map(code=>codeNames.get(code)).filter(Boolean))]).map(ns=>ns.reduce((n,name)=>n+(names.get(name)||0),0));const bad=r.kind==='choice'?used.filter(n=>n>0).length>1:used.some(n=>n>r.limit);if(bad){const msg=`${r.title}: Japanese ${r.kind==='choice'?'choice restriction':r.limit+'-copy limit'}`;if(r.conditional)v.warnings.push(msg+' — special deck exception requires review.');else v.errors.push(msg);}}return v;}
function restrictionCheck(v){if(draft.language==='JP')return checkJP(v);if(draft.language==='Mixed')checkJP(v);if(!restrictions)return v;const counts=new Map();for(const [id,n] of Object.entries(draft.cards)){const c=catalog.get(id);if(c?.language!=='EN')continue;const base=c.code.replace(/(SSP|SP|OFR|ABR|IGP|SR|RRR|SEC|S)$/,'');counts.set(base,(counts.get(base)||0)+n);}for(const r of restrictions.limits){let n=r.codes.reduce((n,c)=>n+(counts.get(c)||0),0);if(n>r.limit)v.errors.push(`${r.name}: ${n}/${r.limit} allowed by EN restriction list`);}for(const group of restrictions.choices){const used=group.options.filter(codes=>codes.some(c=>counts.get(c)));if(used.length>group.choose)v.errors.push(`${group.title}: choose ${group.choose}; ${used.length} restricted choices present`);}if(draft.format==='Neo Standard'){const series=[...new Set(Object.keys(draft.cards).map(id=>catalog.get(id)).filter(c=>c?.language==='EN').map(c=>c.series))];if(series.length>1&&!restrictions.groups.some(g=>series.every(s=>g.codes.includes(s))))v.errors.push('Title codes do not share an imported official Neo Standard group. Check special title exceptions.');}return v;}
function renderDeck(){renderDock();$('#deck-name').value=draft.name;$('#format').value=draft.format;$('#deck-language').value=draft.language;const v=restrictionCheck(validate(draft.cards,catalog,draft.format,draft.language));$('#validation').innerHTML=`<div class="validation"><b>${v.total}/50 cards · ${v.cx}/8 climax</b><div class="${v.errors.length?'bad':'good'}">${v.errors.length?v.errors.map(esc).join('<br>'):'Basic construction checks passed'}</div>${v.warnings.map(w=>`<small>${esc(w)}</small>`).join('')}</div>`;renderDeckOrigin();$('#deck-cards').innerHTML=Object.entries(draft.cards).map(([id,n])=>{const c=catalog.get(id);return `<div class="deck-row" data-hover-card="${esc(id)}">${c?`<button class="art-button" style="width:56px" data-inspect="${esc(id)}">${img(c)}</button>`:''}<div><p>${esc(c?displayName(c):id)}</p><small>${esc(c?.code||id)}</small><small class="card-series">${esc(c?fullSeries(c):'Series name unavailable')}</small>${c?nameBadge(c):''}<button class="deck-zoom" data-inspect="${esc(id)}" aria-label="Inspect ${esc(c?displayName(c):id)}">⤢ Inspect</button><div><button data-decrement="${esc(id)}" aria-label="Remove one">−</button> <b>${n}</b> <button data-add="${esc(id)}" aria-label="Add one">+</button> <button data-remove="${esc(id)}">Remove</button></div></div></div>`;}).join('')||'<p class="muted">Your deck is a blank canvas. Add cards from the library.</p>';$('#saved-list').innerHTML=saved.map((d,i)=>`<div class="saved-item"><b>${esc(d.name)}</b><p class="muted">${Object.values(d.cards).reduce((a,b)=>a+b,0)} cards · ${esc(d.language)} · ${esc(d.format)}</p><button data-load="${i}">Load</button><button data-duplicate="${i}">Duplicate</button>${d.included?'<small class="included-badge">Included deck</small>':'<button data-delete="'+i+'">Delete</button>'}</div>`).join('')||'<p class="muted">No saved decks yet.</p>';}
$('#deck-name').oninput=e=>{draft.name=e.target.value;saveDraft();renderDock();};['format','deck-language'].forEach(id=>$('#'+id).onchange=()=>{draft.format=$('#format').value;draft.language=$('#deck-language').value;saveDraft();renderDeck();});$('#save-deck').onclick=()=>{if(!draft.name.trim())return toast('Give your deck a name.');draft.id=draft.id||crypto.randomUUID();const i=saved.findIndex(d=>d.id===draft.id);if(i<0)saved.push(structuredClone(draft));else saved[i]=structuredClone(draft);persist('ws-decks',saved);saveDraft();renderDeck();toast('Deck saved on this browser.');document.dispatchEvent(new CustomEvent('ws-deck-saved',{detail:structuredClone(draft)}));};$('#new-deck').onclick=()=>{draft={name:'Untitled deck',cards:{},format:'Standard',language:'EN'};saveDraft();renderDeck();};
$('#example-deck').onclick=async()=>{try{const r=await fetch('data/example-deck.json');if(!r.ok)throw Error('Study deck unavailable.');draft=await r.json();delete draft.id;selectPracticeDeck(draft);saveDraft();renderDeck();toast('50-card study deck loaded. Save it to use at the practice table.');}catch(e){toast(e.message);}};
function download(name,text,type='application/json'){const url=URL.createObjectURL(new Blob([text],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#export-deck').onclick=()=>download(draft.name+'.json',JSON.stringify({...draft,schema:'ws-atelier-deck-v1'},null,2));
$('#export-text').onclick=()=>download(draft.name+'.txt',Object.entries(draft.cards).map(([id,n])=>n+' '+(id.includes(':art:')?id:catalog.get(id)?.code||id)).join('\n'),'text/plain');
function parseTextDeck(text, filename, language){
 const deck={name:filename.replace(/\.txt$/i,'')||'Imported deck',cards:{},format:'Standard',language};
 for(const [index,raw] of text.split(/\r\n?|\n/).entries()){
  const line=raw.trim();
  if(!line || /^(#|\/\/|;)/.test(line) || /^(deck(?: list)?|main deck|characters?|events?|climax(?:es)?)\s*:?$/i.test(line))continue;
  const match=line.match(/^(\d+)(?:\s*[x×]\s*|\s+)(\S+)(?:\s+.*)?$/i);
  const label='Line '+(index+1)+': ';
  if(!match)throw Error(label+'Use a quantity and card number, like 4 SAO/S20-E101.');
  const [,quantity,code]=match;
  const matches=cards.filter(c=>(language==='Mixed'||c.language===language)&&c.code.toUpperCase()===code.toUpperCase());
  const canonical=matches.filter(c=>c.id===c.language.toLowerCase()+':'+c.code);
 const base=canonical.length===1?canonical[0]:null;
  const card=catalog.get(code)||base||(matches.length===1?matches[0]:null);
  if(!card){
   if(matches.length>1)throw Error(label+'Multiple artworks match '+code+'. Use the full card ID or a JSON deck file.');
   throw Error(label+'Card not found: '+code+'. Check the deck language and card number.'+(!catalogReady?' If the card library is still loading, try again once it finishes.':''));
  }
  const count=+quantity;
  const total=(deck.cards[card.id]||0)+count;
  if(!Number.isSafeInteger(count)||count<1||total>500)throw Error(label+'Invalid quantity for '+code+'.');
  deck.cards[card.id]=total;
 }
 if(!Object.keys(deck.cards).length)throw Error('This text file contains no cards.');
 return deck;
}
function applyImportedDeck(deck){
 draft=deck;
 selectPracticeDeck(draft);
 saveDraft();
 renderDeck();
 toast('Deck imported. Review construction checks before saving.');
}
function openDeckImport(){
 showDialog('<h2>Upload deck list</h2><p>Choose a text or JSON file, or enter a shared Bushiroad Deck Log code.</p><p class="muted">For text files, use one quantity and card number per line, such as 4 SAO/S20-E101. Select the deck language in the editor first.</p><button type="button" id="choose-deck-file">Choose text or JSON file</button><form id="decklog-import-form"><h3>Deck Log</h3><label>Code or share link <input name="code" required maxlength="200" autocapitalize="characters" autocomplete="off"></label> <label>Edition <select name="language"><option value="EN">English</option><option value="JP">Japanese</option></select></label> <button type="submit">Import Deck Log</button><p role="status" id="decklog-import-status"></p></form>');
 $('#choose-deck-file').onclick=()=>$('#import-file').click();
 const form=$('#decklog-import-form');
 form.elements.language.value=$('#deck-language').value==='JP'?'JP':'EN';
 form.onsubmit=async e=>{
  e.preventDefault();
  const button=form.querySelector('[type=submit]');
  const status=form.querySelector('[role=status]');
  let code=form.elements.code.value.trim();
  let language=form.elements.language.value;
  if(/^https?:/i.test(code)){
   const link=code.match(/^https:\/\/(decklog-en|decklog)\.bushiroad\.com\/(?:[a-z]{2}\/)?view\/([a-z0-9]{3,10})\/?(?:[?#].*)?$/i);
   if(!link){status.textContent='Enter a Bushiroad Deck Log share link or code.';return;}
   language=link[1].toLowerCase()==='decklog-en'?'EN':'JP';
   code=link[2];
  }
  code=code.toUpperCase();
  if(!/^[A-Z0-9]{3,10}$/.test(code)){status.textContent='Enter a valid Deck Log code.';return;}
  button.disabled=true;
  status.textContent='Looking up the deck…';
  try{
   const response=await fetch('https://gzbladuexyqnjqiemlya.supabase.co/functions/v1/ws-decklog?'+new URLSearchParams({code,language}));
   const data=await response.json();
   if(!response.ok)throw Error(data.error||'Could not load this Deck Log deck.');
   const list=data.cards.map(row=>row.count+' '+row.code).join('\n');
   const title=decodeText(data.title).trim()||'Deck Log '+code;
   let deck;
   try{deck=parseTextDeck(list,title,language);}
   catch(error){
    if(catalogReady || !error.message.includes('Card not found:'))throw error;
    status.textContent='Waiting for the card library…';
    await catalogLoading;
    deck=parseTextDeck(list,title,language);
   }
   if(!form.isConnected||!$('#dialog').open)return;
   applyImportedDeck({...deck,name:title,format:data.format});
   $('#dialog').close();
  }catch(error){status.textContent=error.message;}
  finally{button.disabled=false;}
 };
}
$('#import-deck').onclick=$('#upload-deck-list').onclick=openDeckImport;
$('#import-file').onchange=async e=>{
 const f=e.target.files[0];
 if(!f)return;
 try{
  const text=await f.text();
  let deck;
  if(text.trim().startsWith('{')){
   const data=JSON.parse(text);
   if(!data.cards||typeof data.cards!=='object'||Array.isArray(data.cards))throw Error('Expected a cards object.');
   for(const [id,count] of Object.entries(data.cards)){
    if(!catalog.has(id)||!Number.isInteger(count)||count<1||count>500)throw Error('Unknown card or invalid count: '+id);
   }
   deck={name:String(data.name||f.name),cards:data.cards,format:['Standard','Side','Neo Standard'].includes(data.format)?data.format:'Standard',language:['JP','Mixed'].includes(data.language)?data.language:'EN'};
  }else deck=parseTextDeck(text,f.name,$('#deck-language').value);
  applyImportedDeck(deck);
  if($('#decklog-import-form')&&$('#dialog').open)$('#dialog').close();
 }catch(error){
  const status=$('#decklog-import-status');
  if(status&&$('#dialog').open)status.textContent=error.message;
  else toast(error.message);
 }
 finally{e.target.value='';}
};
$('#practice-deck').onclick=()=>{if(!saved.some(d=>d.id===draft.id))$('#save-deck').click();selectPracticeDeck(draft);view('practice');};

function renderDeckOrigin(){const d=draft.provenance,original=includedDecks.find(x=>x.provenance?.product===d?.product),unaltered=original&&Object.keys(original.cards).length===Object.keys(draft.cards).length&&Object.entries(original.cards).every(([id,n])=>draft.cards[id]===n);$('#deck-origin').innerHTML=d?'<div class="notice"><b>'+esc(draft.name)+'</b><p>'+esc(unaltered?d.note:'Edited deck based on the original preconstructed configuration. Its current list and construction checks are shown below.')+'</p><a href="'+esc(d.product)+'" target="_blank" rel="noopener">Official product ↗</a> · <a href="'+esc(d.quantities)+'" target="_blank" rel="noopener">Published full quantity list ↗</a><p>Full card list below · '+Object.values(draft.cards).reduce((a,b)=>a+b,0)+' cards</p></div>':'';}
function duplicateDeck(d){draft=structuredClone(d);draft.id=crypto.randomUUID();draft.name+=' (copy)';delete draft.included;selectPracticeDeck(draft);saved.push(structuredClone(draft));persist('ws-decks',saved);saveDraft();renderDeck();toast('Editable copy saved.');document.dispatchEvent(new CustomEvent('ws-deck-saved',{detail:structuredClone(draft)}));}
$('#duplicate-deck').onclick=()=>duplicateDeck(draft);
function installIncludedDecks(decks){for(const deck of decks)if(!saved.some(d=>d.id===deck.id))saved.push(structuredClone(deck));persist('ws-decks',saved);}

function selectPracticeDeck(deck){
 practiceDeck=Object.keys(deck.cards).length?deck:null;
 renderSetup(true);
}
function loadEditorDeck(deck,remember=true){
 draft=structuredClone(deck);
 selectPracticeDeck(draft);
 if(remember)saveDraft();
 renderDeck();
 $('#saved-decks-menu').open=false;
}
function renderSetup(preferLoaded=false){
 for(const [player,id] of ['p1-deck','p2-deck'].entries()){
  const select=$('#'+id);
  const old=select.value;
  const options=saved.map((deck,index)=>({deck,value:String(index)}));
  if(player===0 && practiceDeck){
   const index=options.findIndex(({deck})=>deck.id && deck.id===practiceDeck.id);
   if(index>=0)options.splice(index,1);
   options.unshift({deck:practiceDeck,value:'loaded'});
  }
  select.replaceChildren(...options.map(({deck,value})=>Object.assign(document.createElement('option'),{textContent:deck.name,value})));
  const choice=preferLoaded && player===0 && practiceDeck?'loaded':old;
  if(options.some(({value})=>value===choice))select.value=choice;
 }
}
$('#new-match').onclick=()=>{$('#match-setup').hidden=false;renderSetup(true);};
$('#start-match').onclick=()=>{
 const decks=['p1-deck','p2-deck'].map(id=>{
  const value=$('#'+id).value;
  return value==='loaded'?practiceDeck:value===''?null:saved[+value];
 });
 if(decks.some(deck=>!deck||!Object.keys(deck.cards).length))return toast('Choose two non-empty decks.');
 match=createMatch(decks.map(deck=>deck.cards));
 match.deckNames=decks.map(deck=>deck.name);
 match.active=$('#first-player').value==='random'?Math.floor(Math.random()*2):+$('#first-player').value;match.players.forEach((_,p)=>draw(match,p,5));if($('#practice-opponent').value==='bot'){match.practiceBot=true;match.botOpening=match.active;}match.log=['Opening hands drawn. Player '+(match.active+1)+' goes first.'];history=[];future=[];selected=[];persist('ws-match',match);$('#match-setup').hidden=true;$('#control-player').value=String(match.active);renderMatch();};
if(match)document.getElementById('match-setup').hidden=true;
const cp=()=>match?.practiceBot?0:+$('#control-player').value,amount=()=>Math.max(1,Math.min(50,Math.floor(+$('#amount').value)||1));
function matchCardsReady(){return !!match&&match.players.every(player=>Object.values(player.zones).every(pile=>pile.every(card=>catalog.has(card.id))));}
let botTimer;
function schedulePracticeBot(){
 clearTimeout(botTimer);
 if(activeView!=='practice'||!match?.practiceBot||!$('#match-setup').hidden||!matchCardsReady())return;
 const action=nextPracticeBotAction(match,catalog,resolver);
 if(!action)return;
 const current=match;
 botTimer=setTimeout(()=>{
  if(match!==current||activeView!=='practice'||!$('#match-setup').hidden)return;
  const next=nextPracticeBotAction(match,catalog,resolver);
  if(next)commit(next.label,next.run);
 },500);
}
function commit(label,fn){if(!match)return toast('Start a match first.');const before=structuredClone(match);try{fn();if(resolver.auto(match).enabled)resolver.afterMutation(match,before);if(before.auto?.choice&&!match.auto?.choice&&!match.auto?.attack)$('#control-player').value=String(match.active);history.push(before);if(history.length>100)history.shift();future=[];match.log.unshift(`T${match.turn} · ${label}`);match.log=match.log.slice(0,150);persist('ws-match',match);selected=selected.filter(r=>match.players[r.p].zones[r.z]?.some(c=>c.uid===r.uid));renderMatch();if(pile)renderPile();}catch(e){match=before;toast(e.message);}}
function undo(){if(!history.length)return;future.push(structuredClone(match));match=history.pop();selected=[];persist('ws-match',match);renderMatch();if(pile)renderPile();}$('#undo').onclick=undo;$('#redo').onclick=()=>{if(!future.length)return;history.push(structuredClone(match));match=future.pop();selected=[];persist('ws-match',match);renderMatch();};
function ref(p,z,c){return {p,z,uid:c.uid};}const isSelected=(p,z,c)=>selected.some(r=>r.p===p&&r.z===z&&r.uid===c.uid);
function toggle(p,z,uid){const i=selected.findIndex(r=>r.p===p&&r.z===z&&r.uid===uid);if(i<0)selected.push({p,z,uid});else selected.splice(i,1);renderMatch();if(pile)renderPile();}
function visible(p,z,c){return c.revealed||(!c.faceDown&&(z!=='deck'&&z!=='stock'&&(z!=='hand'||p===cp()||$('#show-hidden').checked)));}
function tiny(p,z,c){const info=catalog.get(c.id);return visible(p,z,c)&&info?img(info,c.orientation):'<span class="card-back" aria-label="Hidden card">W</span>';}
function zoneHTML(p,z){const a=match.players[p].zones[z],top=a.at(-1);return '<div class="zone" role="button" tabindex="0" data-pile="'+p+'|'+z+'" '+(top?'data-ref="'+p+'|'+z+'|'+top.uid+'"':'')+' aria-label="Inspect '+zoneName(z)+', '+a.length+' cards"><span class="zone-label">'+esc(zoneName(z).toUpperCase())+'</span>'+(top?tiny(p,z,top):'')+'<span class="zone-count"> '+a.length+'</span>'+(top&&visible(p,z,top)?'<button class="zone-zoom" data-inspect="'+esc(top.id)+'" aria-label="Inspect '+esc(displayName(catalog.get(top.id)))+'">⤢</button>':'')+'</div>';}
function stageHTML(p,z){const a=match.players[p].zones[z],c=a.at(-1),markers=match.players[p].zones['markers:'+z];return '<div class="zone stage-zone '+(c&&isSelected(p,z,c)?'selected':'')+'" data-stage="'+p+'|'+z+'" '+(c?'data-ref="'+p+'|'+z+'|'+c.uid+'"':'')+' role="button" tabindex="0" aria-label="'+zoneName(z)+(c&&visible(p,z,c)?' · '+esc(displayName(catalog.get(c.id))):'')+'"><span class="zone-label">'+esc(zoneName(z))+'</span>'+(c?tiny(p,z,c):'<span class="zone-count">◇</span>')+(c&&visible(p,z,c)?'<button class="zone-zoom" data-inspect="'+esc(c.id)+'" aria-label="Inspect '+esc(displayName(catalog.get(c.id)))+'">⤢</button>':'')+(c&&catalog.has(c.id)?'<button class="auto-soul" data-soul="'+p+'|'+z+'|'+c.uid+'" aria-label="Inspect current soul">Soul '+resolver.stats(match,{p,z,uid:c.uid}).soul+'</button>':'')+(c?.note?'<small>'+esc(c.note)+'</small>':'')+'<button class="marker-link" data-pile="'+p+'|markers:'+z+'">Markers '+markers.length+'</button>'+(a.length>1?'<button class="marker-link" style="bottom:10px" data-pile="'+p+'|'+z+'">'+a.length+' cards · inspect</button>':'')+'</div>';}
function playerHTML(p){const z=match.players[p].zones,hand=`<div class="hand"><span class="zone-label">HAND · ${z.hand.length}</span>${z.hand.map(c=>`<div class="hand-card-wrap" data-ref="${p}|hand|${c.uid}"><button class="hand-card ${isSelected(p,'hand',c)?'selected':''}" data-select="${p}|hand|${c.uid}" aria-label="${visible(p,'hand',c)?esc(displayName(catalog.get(c.id))):'Hidden hand card'}">${tiny(p,'hand',c)}</button>${visible(p,'hand',c)?`<button class="hand-zoom" data-inspect="${esc(c.id)}" aria-label="Inspect ${esc(displayName(catalog.get(c.id)))}">⤢</button>`:''}</div>`).join('')}<button data-pile="${p}|hand">Inspect hand</button></div>`;const front=`<div class="stage-row stage-front">${(p===1?['center-right','center-middle','center-left']:['center-left','center-middle','center-right']).map(a=>stageHTML(p,a)).join('')}</div>`,back=`<div class="stage-row stage-back">${(p===1?['back-right','back-left']:['back-left','back-right']).map(a=>stageHTML(p,a)).join('')}</div>`;return `<section class="player-mat ${p===1?'opponent':''}"><h3><span>PLAYER ${p+1} ${match.active===p?'· ACTIVE TURN':''}</span><span>Level ${z.level.length} · Clock ${z.clock.length}${z.level.length>=4?' · LOSS CONDITION':''}</span></h3><p class="player-deck-name">${esc(match.deckNames?.[p]||'Practice deck')}</p>${p===1?hand+back+front:front+back}<div class="zone-row">${['deck','waiting','stock','clock','level','memory'].map(a=>zoneHTML(p,a)).join('')}</div><div class="zone-row" style="grid-template-columns:1fr 1fr;margin-top:8px">${['climax','resolution'].map(a=>zoneHTML(p,a)).join('')}</div>${p===0?hand:''}${match.damage[p]?`<p class="notice">Damage pending: ${match.damage[p].remaining} remaining ${match.damage[p].canceled?'· CANCELED':''}</p>`:''}${!z.deck.length?'<p class="notice">Deck empty: refresh now when appropriate. Costs defer refresh and level-up until payment ends.</p>':''}${z.clock.length>=7?'<p class="notice">Level-up pending: inspect clock and select one of the bottom seven cards.</p>':''}</section>`;}
function renderMatch(){if(Number.isInteger(match?.auto?.choice?.p))$('#control-player').value=String(match.auto.choice.p);if(!match){$('#match-content').hidden=true;return;}$('#match-content').hidden=false;$('#table').innerHTML=playerHTML(1)+playerHTML(0);$('#turn-info').innerHTML=`<b>Turn ${match.turn} · Player ${match.active+1}</b><br>${phases[match.phase]} phase<br><small>${esc(match.step)}</small>`;$('#phase-override').innerHTML=phases.map((p,i)=>`<option value="${i}" ${i===match.phase?'selected':''}>${p}</option>`).join('');$('#attack-step').value=match.step;$('#selection-info').innerHTML=selected.length?selected.map(r=>{const c=match.players[r.p].zones[r.z].find(c=>c.uid===r.uid);return `<p><small>P${r.p+1} · ${esc(zoneName(r.z))}</small><br>${visible(r.p,r.z,c)?`<button class="link" data-inspect="${esc(c.id)}">${esc(displayName(catalog.get(c.id)))}</button>`:'Hidden card'}</p>`;}).join(''):'<p class="muted">Select cards, then choose a destination. Selection order is preserved.</p>';$('#journal').innerHTML=match.log.map(l=>`<p>${esc(l)}</p>`).join('');$('#undo').disabled=!history.length;$('#redo').disabled=!future.length;design?.matchUpdated();resolutionUI?.render();renderPracticeBotControls();schedulePracticeBot();}
$('#dest-zone').innerHTML=zones.map(z=>`<option value="${z}">${zoneName(z)}</option>`).join('');$('#dest-zone').value='waiting';$('#control-player').onchange=()=>{selected=[];renderMatch();};$('#show-hidden').onchange=renderMatch;$('#clear-selection').onclick=()=>{selected=[];renderMatch();};$('#advance').onclick=advancePhase;$('#phase-override').onchange=e=>commit('Phase override',()=>match.phase=+e.target.value);$('#attack-step').onchange=e=>commit('Attack step: '+e.target.value,()=>match.step=e.target.value);
function renderPracticeBotControls(){
 $('#practice-bot-status')?.remove();
 if(!match.practiceBot)return;
 const status=document.createElement('div');
 status.id='practice-bot-status';status.className='notice';
 if(match.botOpening===0){
  status.textContent='Opening hand · Select cards using Multi-select, then discard and redraw. ';
  const confirm=document.createElement('button');confirm.textContent='Confirm mulligan';
  confirm.onclick=()=>commit('Player 1 · Mulligan',()=>actions.mulligan());status.append(confirm);
 }else status.textContent=match.botOpening===1?'Practice bot is choosing its opening hand.':match.active===1?'Practice bot’s turn · Respond when prompted.':'Your turn · Player 2 is the practice bot.';
 $('#resolution-panel')?.before(status);
 for(const id of ['advance','next-phase-middle','previous-phase'])if($('#'+id)&& (match.botOpening!=null||match.active===1))$('#'+id).disabled=true;
 if($('#auto-enabled'))$('#auto-enabled').disabled=true;
}
function openPile(p,z){if(match.practiceBot&&p===1&&['deck','hand','stock'].includes(z))return toast('The bot’s private cards are hidden.');pile={p,z,search:'',peek:false};renderPile();}
function lookAtPracticeDeck(count){
 const cards=match.players[pile.p].zones.deck;
 if(!Number.isInteger(count)||count<1||count>cards.length)return toast('Enter a valid number of cards to look at.');
 pile.looked=cards.slice(-count).reverse().map(card=>card.uid);
 renderPile();
}
function renderLookedDeck(){
 const {p,looked}=pile;
 const deck=match.players[p].zones.deck;
 const cards=looked.map(uid=>deck.find(card=>card.uid===uid)).filter(Boolean);
 showDialog('<h2>Player '+(p+1)+' · Looked-at deck cards</h2><p class="muted">Original order, top card first. Click a card for its actions.</p><div class="pile-grid">'+cards.map(c=>'<div class="pile-card"><button class="art-button" data-select="'+p+'|deck|'+esc(c.uid)+'">'+img(catalog.get(c.id))+'</button><button type="button" data-look-reveal="'+esc(c.uid)+'">'+(c.revealed?'Hide':'Reveal')+'</button></div>').join('')+'</div><button type="button" id="back-to-practice-deck">Back to deck</button>');
 $('#back-to-practice-deck').onclick=()=>openPile(p,'deck');
 $('[data-look-reveal]').forEach(button=>button.onclick=()=>{
  const card=deck.find(c=>c.uid===button.dataset.lookReveal);
  if(card)commit(card.revealed?'Hide deck card':'Reveal deck card',()=>{card.revealed=!card.revealed;});
 });
}
function renderPile(){if(!pile)return;if(pile.looked)return renderLookedDeck();const {p,z,search,peek}=pile,a=match.players[p].zones[z],hidden=z==='deck'||z==='stock'||(z==='hand'&&p!==cp()&&!$('#show-hidden').checked);showDialog(`<h2>Player ${p+1} · ${esc(zoneName(z))}</h2><p class="muted">${a.length} cards · displayed bottom / first → top / last. Click in the order you want to move cards.</p><div class="pile-tools">${z==='deck'&&a.length?'<form id="practice-top-look"><label>Number of top cards <input type="number" name="count" min="1" max="'+a.length+'" value="1" required></label> <button type="submit">Look at top cards</button></form>':''}<input id="pile-search" aria-label="Search this pile" value="${esc(search)}" placeholder="Search names, numbers and abilities"><div class="toolbar">${hidden?`<button id="pile-peek">${peek?'Stop inspecting':'Privately inspect / search'}</button>`:''}<button id="pile-select-all">Select visible cards</button><button id="pile-clear">Clear</button><button id="pile-top">Move selection to top</button><button id="pile-bottom">Move selection to bottom</button><button id="pile-reverse">Reverse selected order</button><button id="pile-done" class="primary">Done · ${selected.length} selected</button></div><p class="muted">Use the table controls to move selected cards to another zone, reveal them, or change orientation.</p></div><div class="pile-grid">${a.map((c,i)=>({c,i})).filter(({c})=>{const info=catalog.get(c.id);return !search||((!hidden||peek)&&[info?.name,info?.code,...info?.ability||[]].join(' ').toLowerCase().includes(search.toLowerCase()));}).map(({c,i})=>`<div class="pile-card ${isSelected(p,z,c)?'selected':''}" data-ref="${p}|${z}|${c.uid}"><button class="art-button" data-select="${p}|${z}|${c.uid}">${(!hidden&&!c.faceDown||peek&&['deck','stock','hand'].includes(z))||c.revealed?img(catalog.get(c.id)):'<span class="card-back">W</span>'}</button><small>#${i+1} ${i===0?'· bottom':''}${i===a.length-1?'· top':''}</small>${(!hidden&&!c.faceDown||peek&&['deck','stock','hand'].includes(z))||c.revealed?`<button class="link" data-inspect="${esc(c.id)}">Read card</button>`:''}<small>${selected.findIndex(r=>r.uid===c.uid)>=0?'Selection '+(selected.findIndex(r=>r.uid===c.uid)+1):''}</small></div>`).join('')}</div>`);if($('#practice-top-look'))$('#practice-top-look').onsubmit=e=>{e.preventDefault();lookAtPracticeDeck(Number(e.currentTarget.elements.count.value));};$('#pile-search').oninput=e=>{pile.search=e.target.value;const pos=e.target.selectionStart;renderPile();$('#pile-search').focus();$('#pile-search').setSelectionRange(pos,pos);};if($('#pile-peek'))$('#pile-peek').onclick=()=>{pile.peek=!pile.peek;renderPile();};$('#pile-select-all').onclick=()=>{for(const c of a){const info=catalog.get(c.id);if((!search||(!hidden||peek)&&[info?.name,info?.code,...info?.ability||[]].join(' ').toLowerCase().includes(search.toLowerCase()))&&!isSelected(p,z,c))selected.push(ref(p,z,c));}renderMatch();renderPile();};$('#pile-clear').onclick=()=>{selected=[];renderMatch();renderPile();};$('#pile-reverse').onclick=()=>{selected.reverse();renderPile();};$('#pile-top').onclick=()=>commit('Reordered '+zoneName(z),()=>move(match,selected.filter(r=>r.p===p&&r.z===z),p,z,'top'));$('#pile-bottom').onclick=()=>commit('Reordered '+zoneName(z),()=>move(match,selected.filter(r=>r.p===p&&r.z===z),p,z,'bottom'));$('#pile-done').onclick=()=>{$('#dialog').close();pile=null;renderMatch();};}
const actions={
 stand:()=>{for(const [z,a] of Object.entries(match.players[cp()].zones))if(stage(z))a.forEach(c=>c.orientation='stand');},
 draw:()=>{if(resolver.auto(match).enabled)return resolver.drawCards(match,cp(),amount());const n=draw(match,cp(),amount());if(n<amount())toast(`Drew ${n}. Deck empty: refresh, then draw the remaining ${amount()-n}.`);},
 clock:()=>{if(resolver.auto(match).enabled&&resolver.auto(match).clockedTurn===match.turn)throw Error('The optional clock action was already used this turn. Use an explicit manual zone move for a card effect.');const r=selected.filter(r=>r.p===cp()&&r.z==='hand');if(r.length!==1)throw Error('Select exactly one card from this player’s hand.');move(match,r,cp(),'clock');if(resolver.auto(match).enabled)resolver.auto(match).clockedTurn=match.turn;if(resolver.auto(match).enabled)resolver.drawCards(match,cp(),2);else draw(match,cp(),2);selected=[];},
 mulligan:()=>{const p=cp();if(match.players[p].mulligan)throw Error('This player has already mulliganed. Use manual moves for an override.');const r=selected.filter(r=>r.p===p&&r.z==='hand');if(match.practiceBot){practiceMulligan(match,p,r);selected=[];return;}move(match,r,p,'waiting');if(resolver.auto(match).enabled)resolver.drawCards(match,p,r.length);else draw(match,p,r.length);match.players[p].mulligan=true;selected=[];},
 shuffle:()=>shuffle(match.players[cp()].zones.deck),refresh:()=>refresh(match,cp()),
 level:()=>{const r=selected.filter(r=>r.p===cp()&&r.z==='clock');if(r.length!==1)throw Error('Inspect clock and select one of its bottom seven cards.');levelUp(match,cp(),r[0].uid);selected=[];},
 pay:()=>{const z=match.players[cp()].zones;if(z.stock.length<amount())throw Error('Not enough stock. Use manual movement for a special cost.');for(let i=0;i<amount();i++){const c=z.stock.pop();c.faceDown=false;z.waiting.push(c);}},
 trigger:()=>{if(!match.players[cp()].zones.deck.length)throw Error('Refresh the empty deck first.');draw(match,cp(),1,'resolution');match.step='Trigger';},
 stock:()=>{const z=match.players[cp()].zones,r=selected.filter(r=>r.p===cp()&&r.z==='resolution');if(r.length)move(match,r,cp(),'stock');else if(z.resolution.length)z.stock.push(z.resolution.pop());else throw Error('No trigger card in resolution.');selected=[];},
 damage:()=>resolver.auto(match).enabled?resolver.damage(match,cp(),amount(),selected[0]?.uid):startDamage(match,cp(),amount()),'damage-reveal':()=>damageReveal(match,cp(),catalog),'damage-finish':()=>finishDamage(match,cp()),
 encore:()=>{const z=match.players[cp()].zones;for(const key of Object.keys(z))if(stage(key)){const reverse=z[key].filter(c=>c.orientation==='reverse');move(match,reverse.map(c=>ref(cp(),key,c)),cp(),'waiting');}z.waiting.push(...z.climax.splice(0));toast('Reversed cards and climax moved. Resolve encore manually; discard to seven cards if needed.');},
 attack:()=>{if(resolver.auto(match).enabled){if(selected.length!==1)throw Error('Select one attacker.');return resolver.beginAttack(match,selected[0],$('#attack-type').value.toLowerCase());}const r=selected.filter(r=>r.p===cp()&&r.z.startsWith('center-'));if(r.length!==1)throw Error('Select one center-stage attacker.');const c=match.players[r[0].p].zones[r[0].z].find(c=>c.uid===r[0].uid);c.orientation='rest';match.step='Attack declaration';match.log.unshift($('#attack-type').value+' attack declared by Player '+(cp()+1));},
 move:()=>{if(!selected.length)throw Error('Select cards first.');const moved=move(match,selected,+$('#dest-player').value,$('#dest-zone').value,$('#placement').value);if(!moved.length)throw Error('No cards moved.');selected=[];},
 rest:()=>orientation('rest'),reverse:()=>orientation('reverse'),'stand-selected':()=>orientation('stand'),
 flip:()=>modify(c=>c.faceDown=!c.faceDown),reveal:()=>modify(c=>c.revealed=!c.revealed),note:()=>{const t=prompt('Card note, such as “Power 8500 · Soul 2”');if(t!==null)modify(c=>c.note=t.slice(0,100));}
};
function modify(fn){if(!selected.length)throw Error('Select one or more cards first.');for(const r of selected){const c=match.players[r.p].zones[r.z].find(c=>c.uid===r.uid);if(c)fn(c);}}
function orientation(o){modify(c=>c.orientation=o);}
document.addEventListener('click',e=>{const b=e.target.closest('[data-add],[data-inspect],[data-decrement],[data-remove],[data-load],[data-delete],[data-duplicate],[data-action],[data-pile],[data-select],[data-stage]');if(!b)return;const d=b.dataset;if(d.add)add(d.add);else if(d.inspect)inspect(d.inspect);else if(d.decrement){if(--draft.cards[d.decrement]<=0)delete draft.cards[d.decrement];saveDraft();renderDeck();}else if(d.remove){delete draft.cards[d.remove];saveDraft();renderDeck();}else if(d.load!==undefined){loadEditorDeck(saved[+d.load]);toast('Deck loaded and selected for Practice.');}else if(d.duplicate!==undefined){duplicateDeck(saved[+d.duplicate]);}else if(d.delete!==undefined){if(confirm('Delete this saved deck?')){saved.splice(+d.delete,1);persist('ws-decks',saved);renderDeck();}}else if(d.action){const name=d.action;commit(`Player ${cp()+1}: ${b.textContent.trim()}`,()=>actions[name]());}else if(d.pile){const [p,z]=d.pile.split('|');if(design&&b.closest('#table'))design.clickPile(+p,z,b);else openPile(+p,z);}else if(d.select){const [p,z,uid]=d.select.split('|');if(design)design.clickCard({p:+p,z,uid},b,e);else toggle(+p,z,uid);}else if(d.stage){const [p,z]=d.stage.split('|'),c=match.players[+p].zones[z].at(-1);if(c&&design)design.clickCard({p:+p,z,uid:c.uid},b,e);else if(c)toggle(+p,z,c.uid);else if(design)design.emptyStage(+p,z,b);else if(selected.length){$('#dest-player').value=p;$('#dest-zone').value=z;toast('Destination selected. Press Move selected.');}}});
document.addEventListener('keydown',e=>{if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role="button"]')){e.preventDefault();e.target.click();}});
const checklist=[['Setup','Choose decks, randomize first player, shuffle, draw five each; select unwanted hand cards and mulligan once per player.'],['Stand & draw','Stand the active player’s characters; draw one. Check deck-empty and clock-seven conditions whenever they arise.'],['Clock','Optionally select one hand card, clock it and draw two. Choose level-up cards when required.'],['Main','Play characters to the five stage positions, replace or swap positions using manual moves, play events, use abilities, pay stock, discard, rest cards and manage markers.'],['Search & reveal','Inspect a pile, privately search, select cards in the desired order, reveal publicly or move to a destination. Shuffle after searches when instructed.'],['Climax','Move a climax from hand to the climax area and manually apply its effects.'],['Attacks','Select an attacker and declare frontal, side or direct attack. First player may attack only once on their first turn.'],['Triggers & counters','Reveal trigger to resolution, apply its icon effect manually, then move it to stock. Switch control to the defender to play counters and pay their costs.'],['Damage & cancellation','Control the damaged player. Start damage, reveal one card at a time until done or a climax cancels; resolve those revealed cards to clock or waiting room. Refresh during resolution if needed.'],['Battle & encore','Compare power manually, reverse defeated characters. Resolve encore costs and return characters rested when applicable. End / encore cleanup moves reversed characters and climax to waiting room.'],['Level-up','Inspect clock: bottom is #1. Choose one of the bottom seven, level it, and move the other six to waiting room. Repeat if needed. Four level cards meets a loss condition.'],['Refresh','With deck empty, use Refresh to shuffle waiting room into deck and immediately put the new top card into clock. Resolve pending level-up and resume the interrupted action.'],['Costs & overrides','Pay complete multi-part costs with manual moves before resolving refresh or level-up. Decks and stock are hidden, ordered piles. You may inspect them privately. Face-down memory/markers remain hidden until revealed.'],['End & next turn','Resolve end effects, clear temporary notes, discard hand to seven where required, then advance to the next player’s Stand phase.'],['Correct mistakes','Undo/redo table actions. Multi-select, reverse selection order and move to top/bottom to set exact pile order. Manual overrides remain available throughout.']];
$('#game-checklist').onclick=()=>{pile=null;showDialog('<p class="eyebrow">A FULL GAME, AT YOUR PACE</p><h2>Manual practice checklist</h2><p class="muted">The controls move cards; you decide when rules and effects apply.</p><ol class="checklist">'+checklist.map(([title,body])=>`<li><label><input type="checkbox"><b>${title}</b></label>${esc(body)}</li>`).join('')+'</ol>');};
function sources(){pile=null;showDialog(`<p class="eyebrow">AN HONEST LOOK AT THE COLLECTION</p><h2>Sources & catalog coverage</h2><p class="notice">This is an available-source catalog, not a verified complete catalog of all publicly released cards. Cards, promotions, artwork and restrictions still require reconciliation.</p><p>Imported: <b>${Number(coverage.english||0).toLocaleString()} English</b> and <b>${Number(coverage.japanese||0).toLocaleString()} Japanese</b> records. Updated ${esc(coverage.updated?.slice(0,10)||'—')}.</p><ul class="source-list">${(coverage.notes||[]).map(n=>`<li>${esc(n)}</li>`).join('')}</ul><p>${coverage.failures?.length||0} recorded source download failures.</p><p>Artwork links come from source card records. Failed artwork is labeled unavailable; it is never replaced with invented art. English and Japanese remain separate card identities. Blau and Rose are excluded.</p><ul class="source-list"><li><a href="https://ws-tcg.com/cardlist/" target="_blank" rel="noopener">Official Japanese card list</a></li><li><a href="https://en.ws-tcg.com/cardlist/" target="_blank" rel="noopener">Official English card list</a></li><li><a href="https://github.com/CCondeluci/WeissSchwarz-ENG-DB" target="_blank" rel="noopener">English mirror and record schema</a></li><li><a href="https://www.heartofthecards.com/code/cardlist.html" target="_blank" rel="noopener">Heart of the Cards · unofficial translation references</a></li><li><a href="https://github.com/Cris-Oblea/ws-card-db/blob/main/documentation/en-name-matching.md" target="_blank" rel="noopener">Japanese name translations · community dataset & matching safeguards</a></li><li><a href="https://en.ws-tcg.com/rules/" target="_blank" rel="noopener">Official English rules, quick manual and playmat</a></li><li><a href="https://en.ws-tcg.com/rules/deck/" target="_blank" rel="noopener">English construction and restriction list</a></li><li><a href="https://ws-tcg.com/rules/deck_rule/" target="_blank" rel="noopener">Japanese construction and restrictions</a></li></ul><p>Basic validation: 50 cards, at most eight climax, same-name copy counts, language, and recognized English copy-limit text. The EN restriction snapshot is ${restrictions?esc(restrictions.date):'not loaded'}. The Japanese snapshot includes 39 Neo Standard groups and Standard/Side bans. Conditional exceptions, all title exceptions, and all special deck text are not fully encoded. Check the official lists before tournament play.</p><p>Decks and practice state are saved in this browser. Export decks for backups or to transfer them to another device. Account decks can also be saved through My account; browser decks remain available offline.</p>`);}
$('#about').onclick=sources;$('#footer-sources').onclick=sources;

function advancePhase(){if(match?.practiceBot&&(match.botOpening!=null||match.active===1))return toast('Wait for the opening mulligan or the bot’s turn.');if(match&&resolver.auto(match).enabled)return commit('Guided phase progression',()=>resolver.advance(match));if(match&&(resolver.auto(match).choice||resolver.auto(match).attack||resolver.auto(match).queue.length))return toast('Resolve the current choice before advancing.');commit('Advanced phase',()=>{const before=match.turn;nextPhase(match);if(match.turn!==before){match.attacksThisTurn=0;match.attackType=null;$('#control-player').value=String(match.active);}});}
function previousPhase(){if(match?.practiceBot&&(match.botOpening!=null||match.active===1))return;commit('Phase correction: previous phase',()=>{if(match.phase>0)match.phase--;else if(match.turn>1){match.turn--;match.active=1-match.active;match.phase=6;}else throw Error('Already at the first phase of the game.');});}
function instanceAt(r){return match?.players[r.p].zones[r.z]?.find(c=>c.uid===r.uid);}
const cardAbilities=ref=>activatedAbilities(rulesCard(instanceAt(ref)?.id));
function playPracticeCard(ref,to){
 const check=()=>{
  if(match.active!==ref.p||ref.z!=='hand')throw Error('Play a card from hand during your turn.');
  const a=resolver.auto(match);
  if(a.choice||a.reveal||a.paused||a.attack||a.queue.length||a.gameOver||match.botOpening!=null)throw Error('Finish the current resolution first.');
  const card=catalog.get(instanceAt(ref)?.id),zones=match.players[ref.p].zones;
  const error=playFromHandError(card,zones,match.phase,id=>catalog.get(id));
  if(error)throw Error(error);
  if(card.type==='Character'&&!stage(to))throw Error('Choose a stage position.');
  return {card,zones,cost:card.type==='Climax'?0:Number(card.cost)||0};
 };
 let choice;
 try{choice=check();}catch(error){return toast(error.message);}
 const play=()=>commit('Play '+displayName(choice.card),()=>{
  const {card,zones,cost}=check();
  if(cost)move(match,zones.stock.slice(-cost).reverse().map(c=>({p:ref.p,z:'stock',uid:c.uid})),ref.p,'waiting');
  if(card.type==='Character'){
   const replaced=zones[to].map(c=>({p:ref.p,z:to,uid:c.uid}));
   if(replaced.length)move(match,replaced,ref.p,'waiting');
   zones.waiting.push(...zones['markers:'+to].splice(0));
  }
  move(match,[ref],ref.p,card.type==='Climax'?'climax':card.type==='Event'?'resolution':to)[0].faceDown=false;
  selected=[];
 });
 if(!choice.cost)return play();
 pile=null;
 showDialog('<h2>Pay '+choice.cost+' Stock?</h2><p>Play '+esc(displayName(choice.card))+' and move '+choice.cost+' cards from the top of your Stock to your Waiting Room.</p><button class="primary" id="practice-pay-play">Pay '+choice.cost+' Stock and play</button>');
 $('#practice-pay-play').onclick=()=>{$('#dialog').close();play();};
}
function openAbilities(ref,manual){
 const abilities=cardAbilities(ref),choice=match.auto?.choice;
 if(!abilities.length){
  showDialog('<h2>Activate ability</h2><p>This card has no activated (ACT) abilities. AUTO abilities trigger at their stated timing, and CONT abilities apply while their conditions are met.</p><button id="practice-read-ability-card">Read card</button>');
  $('#practice-read-ability-card').onclick=()=>inspect(instanceAt(ref)?.id);
  return;
 }
 const backup=choice?.kind==='counter'&&choice.p===ref.p&&choice.options.find(o=>o.value===ref.uid&&o.backup);
 showDialog('<h2>Activate ability</h2><p>Choose an ACT ability. Automatic actions pay the printed cost and ask for targets when needed.</p>'+abilities.map(({text,action},i)=>{
  const available=action||backup&&parseAbility(text)?.kind==='backup';
  return '<p>'+esc(text)+'</p><button type="button" data-practice-ability="'+i+'">'+(available?'Activate':'Resolve manually')+'</button>';
 }).join(''));
 $('[data-practice-ability]').forEach(button=>button.onclick=()=>{
  const selected=abilities[+button.dataset.practiceAbility];
  if(match.practiceBot&&ref.p===1)return toast('The Practice bot controls that character.');
  if(!selected.action&&!(backup&&parseAbility(selected.text)?.kind==='backup'))return manual();
  $('#dialog').close();pile=null;
  commit('Activate ability',()=>selected.action?resolver.activate(match,ref,selected.index):resolver.respond(match,choice.id,backup.value));
 });
}
function selectCards(refs,player){selected=refs;if(player!==undefined){$('#control-player').value=String(player);$('#dest-player').value=String(player);}renderMatch();if(pile)renderPile();}
function performMove(refs,p,to,position='top',orientation){commit('Manual movement to '+zoneName(to),()=>{const moved=move(match,refs,p,to,position);if(orientation)moved.forEach(c=>c.orientation=orientation);selected=[];});}
design=mountAtelier({state:()=>({cards,catalog,match,selected,player:cp(),pile}),view,toast,card:id=>catalog.get(id),name:id=>catalog.has(id)?displayName(catalog.get(id)):'Card unavailable',englishAbility:id=>{const p=presentation?.get(id);return p?.kind==='official'||catalog.get(id)?.language==='EN'?p?.ability?.join(' ')||'':'';},instance:instanceAt,readable:r=>{const c=instanceAt(r);return !!c&&(visible(r.p,r.z,c)||(pile?.peek||pile?.looked?.includes(r.uid))&&pile.p===r.p&&pile.z===r.z&&(!c.faceDown||['deck','stock','hand'].includes(r.z)));},image:id=>img(catalog.get(id)),details:readableDetails,inspect,zoneName,openPile,select:selectCards,setPlayer:p=>{$('#control-player').value=String(p);renderMatch();},setAmount:n=>$('#amount').value=String(n),action:name=>commit('Player '+(cp()+1)+': '+name,()=>actions[name]()),move:performMove,advancePhase,previousPhase,setStep:step=>commit('Attack step: '+step,()=>match.step=step),swapStage:(r,to)=>commit('Stage position swap',()=>{const z=match.players[r.p].zones;[z[r.z],z[to]]=[z[to],z[r.z]];[z['markers:'+r.z],z['markers:'+to]]=[z['markers:'+to],z['markers:'+r.z]];selected=[];}),placeStage:(r,to,rested)=>commit('Place character on '+zoneName(to),()=>{const z=match.players[r.p].zones;const old=z[to].map(c=>({p:r.p,z:to,uid:c.uid}));if(old.length)move(match,old,r.p,'waiting');if(z['markers:'+to].length)z.waiting.push(...z['markers:'+to].splice(0));move(match,[r],r.p,to);if(rested)z[to].at(-1).orientation='rest';selected=[];}),openAbilities,playCard:playPracticeCard,declareAttack:(r,type,override=false)=>commit((override?'Manual override: ':'')+type+' attack',()=>{if(!override&&resolver.auto(match).enabled)return resolver.beginAttack(match,r,type);if(resolver.auto(match).choice||resolver.auto(match).attack)throw Error('Finish or abort the pending guided sequence first.');const c=instanceAt(r);if(!c)throw Error('Choose a stage character.');c.orientation='rest';match.attackType=type[0].toUpperCase()+type.slice(1);match.attacksThisTurn=(match.attacksThisTurn||0)+1;match.step='Attack declaration';})});
resolutionUI=mountResolution({state:()=>match,ready:()=>match?.practiceBot?matchCardsReady():catalogReady,resolver,commit,dialog:showDialog,inspect,image:id=>img(catalog.get(id)),name:id=>displayName(catalog.get(id))});
$('#browse-builder-cards').onclick=()=>{$('#search').focus();$('#search').scrollIntoView?.({block:'center',behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});};

async function loadStarterDecks(){
 try{
  const response=await fetch('data/starter-decks.json');
  if(!response.ok)throw Error('The included practice deck could not load. Reload to retry.');
  const starters=await response.json();
  includedDecks=starters.decks;
  cards=[...new Map([...starters.cards,...cards].map(c=>[c.id,c])).values()];
  catalog=new Map(cards.map(c=>[c.id,c]));
  rebuildPresentation();
  installIncludedDecks(includedDecks);
  renderSetup();
  if(activeView==='decks')renderDeck();
  if(match && activeView==='practice')renderMatch();
 }catch(e){toast(e.message);}
}
loadStarterDecks();
async function init(){try{const [sample,names,references,cov,jpNames,jpTexts]=await Promise.all(['cards','series-names','translation-references','coverage','japanese-names-v1','japanese-texts-v1'].map(f=>fetch('data/'+f+'.json').then(r=>{if(!r.ok)throw Error('Could not load '+f);return r.json();})));seriesNames=names;translationReferences={references:references.references,names:jpNames,texts:jpTexts};cards=[...new Map([...cards,...sample].map(c=>[c.id,c])).values()];catalog=new Map(cards.map(c=>[c.id,c]));coverage=cov;rebuildPresentation();try{[restrictions,jpRestrictions]=await Promise.all(['restrictions','jp-restrictions'].map(f=>fetch('data/'+f+'.json').then(r=>r.ok?r.json():null)));}catch{}$('#catalog-count').textContent=cards.length.toLocaleString();seriesOptions();filter();renderDock();renderSetup();if(activeView==='decks')renderDeck();if(match)renderMatch();const index=await fetch('data/index.json').then(r=>r.json()),all=[];let next=0;async function load(){while(next<index.chunks.length){const f=index.chunks[next++],r=await fetch('data/'+f);if(!r.ok)throw Error('A catalog section could not load. Reload to retry.');all.push(...await r.json());}}await Promise.all([load(),load(),load()]);cards=[...new Map([...cards,...all].map(c=>[c.id,c])).values()];catalog=new Map(cards.map(c=>[c.id,c]));rebuildPresentation();catalogReady=true;$('#catalog-count').textContent=cards.length.toLocaleString();seriesOptions();filter();renderDock();if(activeView==='decks')renderDeck();renderSetup();if(match){if(resolver.auto(match).enabled)resolver.run(match);persist('ws-match',match);renderMatch();}}catch(e){$('#results').textContent=e.message;toast(e.message);}}const catalogLoading=init();

mountOnline({updateInspector:()=>design?.onView(activeView),view,toast,dialog:showDialog,inspect,card:id=>catalog.get(id),name:id=>catalog.has(id)?displayName(catalog.get(id)):id,image:id=>catalog.has(id)?img(catalog.get(id)):"<span class=card-back>W</span>",zoneName,saved:()=>saved,draft:()=>structuredClone(draft),loadDraft:loadEditorDeck,catalogReady:()=>catalogReady});
