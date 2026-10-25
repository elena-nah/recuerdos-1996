'use strict';

/* Recuerdos 1996 · Diario personal sin cuentas ni servidores. */
const $ = id => document.getElementById(id);
const DB_NAME = 'recuerdos1996-diary';
const DB_VERSION = 1;
const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const now = new Date();
const state = {
  db: null,
  date: dateKey(now),
  month: new Date(now.getFullYear(), now.getMonth(), 1, 12),
  entries: new Map(),
  selectedPhoto: null,
  photoUrls: [],
  photoRenderToken: 0,
  saveTimer: null,
  toastTimer: null,
  savingCount: 0,
  loaded: false
};

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function dateFromKey(key) {
  const [y,m,d] = key.split('-').map(Number);
  return new Date(y,m-1,d,12);
}
function prettyDate(key) {
  const d=dateFromKey(key);
  return `${d.getDate()} de ${MONTHS[d.getMonth()]} de ${d.getFullYear()}`;
}
function getEntry(key=state.date) {
  if (!state.entries.has(key)) state.entries.set(key,{date:key,text:'',favorite:false,photos:[],updatedAt:null});
  return state.entries.get(key);
}
function isWritten(entry) { return Boolean(entry && (entry.text.trim() || entry.photos.length)); }
function isPersistent(entry) { return Boolean(entry && (entry.favorite || isWritten(entry))); }
function uid() { return crypto?.randomUUID?.() || `f${Date.now()}_${Math.random().toString(36).slice(2)}`; }
function cloneEntry(entry) {
  return {date:entry.date,text:entry.text,favorite:Boolean(entry.favorite),photos:entry.photos.map(p=>({...p})),updatedAt:new Date().toISOString()};
}
function dbOpen() {
  return new Promise((resolve,reject)=>{
    if (!('indexedDB' in window)) { reject(new Error('Tu navegador no admite almacenamiento de diario.')); return; }
    const req=indexedDB.open(DB_NAME,DB_VERSION);
    req.onupgradeneeded=()=>{
      const db=req.result;
      if(!db.objectStoreNames.contains('entries')) db.createObjectStore('entries',{keyPath:'date'});
      if(!db.objectStoreNames.contains('photos')) db.createObjectStore('photos',{keyPath:'id'});
    };
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('No se pudo abrir el almacenamiento.'));
    req.onblocked=()=>reject(new Error('Cierra otras pestañas de Recuerdos 1996 y vuelve a abrirla.'));
  });
}
function requestResult(req) {
  return new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);});
}
function transactionFinished(tx) {
  return new Promise((resolve,reject)=>{ tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error||new Error('Error al guardar.'));tx.onabort=()=>reject(tx.error||new Error('Operación cancelada.')); });
}
async function readAllEntries() {
  const tx=state.db.transaction('entries','readonly');
  const result=await requestResult(tx.objectStore('entries').getAll());
  state.entries=new Map(result.map(item=>[item.date,{
    date:item.date,text:typeof item.text==='string'?item.text:'',favorite:Boolean(item.favorite),
    photos:Array.isArray(item.photos)?item.photos:[],updatedAt:item.updatedAt||null
  }]));
}
async function getPhotoBlob(id) {
  const tx=state.db.transaction('photos','readonly');
  const found=await requestResult(tx.objectStore('photos').get(id));
  return found?.blob||null;
}
async function putPhotoBlob(id,blob) {
  const tx=state.db.transaction('photos','readwrite');
  const done=transactionFinished(tx);
  tx.objectStore('photos').put({id,blob});
  await done;
}
async function removePhotoBlob(id) {
  const tx=state.db.transaction('photos','readwrite');
  const done=transactionFinished(tx);
  tx.objectStore('photos').delete(id);
  await done;
}
function setSaveStatus(message,kind='ready') {
  const node=$('saveStatus'); node.textContent=message;
  node.parentElement.classList.toggle('busy',kind==='busy');
  node.parentElement.classList.toggle('error',kind==='error');
}
async function writeEntry(snapshot) {
  state.savingCount++;
  setSaveStatus('Guardando…','busy');
  try {
    const tx=state.db.transaction('entries','readwrite');
    const done=transactionFinished(tx);
    if(isPersistent(snapshot)) tx.objectStore('entries').put(snapshot);
    else tx.objectStore('entries').delete(snapshot.date);
    await done;
    if (state.savingCount===1) setSaveStatus('Todos los cambios guardados ♡');
  } catch(err) {
    console.error(err);
    setSaveStatus('No se pudo guardar. Haz una copia si puedes.','error');
    toast('No se pudo guardar. Comprueba el espacio disponible y el modo privado.');
  } finally { state.savingCount--; }
}
function requestSave() {
  if (!state.loaded) return;
  setSaveStatus('Cambios pendientes…','busy');
  clearTimeout(state.saveTimer);
  state.saveTimer=setTimeout(flushSave,550);
  renderSummary();
}
function flushSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer=null;
  if (!state.loaded || !state.db) return Promise.resolve();
  return writeEntry(cloneEntry(getEntry()));
}
function toast(message) {
  const elem=$('toast');elem.textContent=message;elem.classList.add('visible');
  clearTimeout(state.toastTimer);
  state.toastTimer=setTimeout(()=>elem.classList.remove('visible'),3600);
}
function updateTheme() {
  const dark=document.body.classList.contains('dark');
  $('themeButton').innerHTML=dark?'<svg><use href="#i-sun"/></svg>':'<svg><use href="#i-moon"/></svg>';
  document.querySelector('meta[name="theme-color"]').content=dark?'#24242d':'#cfc7b6';
  try{localStorage.setItem('recuerdos1996-theme',dark?'dark':'light');}catch{}
}
function navigateMonth(delta) {
  state.month=new Date(state.month.getFullYear(),state.month.getMonth()+delta,1,12);
  renderCalendar();
}
function renderCalendar() {
  const month=state.month;
  $('monthTitle').textContent=`${cap(MONTHS[month.getMonth()])} ${month.getFullYear()}`;
  $('monthInput').value=`${month.getFullYear()}-${String(month.getMonth()+1).padStart(2,'0')}`;
  const grid=$('calendarGrid');grid.replaceChildren();
  const offset=(new Date(month.getFullYear(),month.getMonth(),1,12).getDay()+6)%7;
  const daysInMonth=new Date(month.getFullYear(),month.getMonth()+1,0,12).getDate();
  const total=Math.max(35,Math.ceil((offset+daysInMonth)/7)*7);
  const origin=new Date(month.getFullYear(),month.getMonth(),1-offset,12);
  for(let i=0;i<total;i++) {
    const d=new Date(origin.getFullYear(),origin.getMonth(),origin.getDate()+i,12);
    const key=dateKey(d); const entry=state.entries.get(key);
    const button=document.createElement('button');button.type='button';button.className='calendar-cell';
    button.textContent=String(d.getDate());button.title=prettyDate(key);
    button.setAttribute('aria-label',`${prettyDate(key)}${isWritten(entry)?', con entrada':''}${entry?.favorite?', favorito':''}`);
    if(d.getMonth()!==month.getMonth()) button.classList.add('outside');
    if(key===dateKey(new Date())) button.classList.add('today');
    if(key===state.date) {button.classList.add('selected');button.setAttribute('aria-current','date');}
    if(isWritten(entry)) button.classList.add('has-note');
    if(entry?.favorite) button.classList.add('is-fav');
    button.addEventListener('click',()=>selectDate(key));grid.append(button);
  }
}
function cap(str) { return str.charAt(0).toUpperCase()+str.slice(1); }
function renderFavorites() {
  const list=$('favoritesList');list.replaceChildren();
  const favs=[...state.entries.values()].filter(e=>e.favorite).sort((a,b)=>b.date.localeCompare(a.date));
  if(!favs.length) { const el=document.createElement('p');el.className='empty-help';el.textContent='Marca una página con la estrella para encontrarla aquí.';list.append(el);return; }
  for(const entry of favs) {
    const btn=document.createElement('button');btn.type='button';btn.className='favorite-item';
    const strong=document.createElement('strong');strong.textContent=`★ ${prettyDate(entry.date)}`;
    const small=document.createElement('small');small.textContent=entry.text.trim().replace(/\s+/g,' ').slice(0,70)||(entry.photos.length?`${entry.photos.length} fotografía(s)`:'Página reservada');
    btn.append(strong,small);btn.addEventListener('click',()=>selectDate(entry.date));list.append(btn);
  }
}
function renderSearch() {
  const q=$('searchInput').value.trim().toLocaleLowerCase('es');
  const result=$('searchResults');result.replaceChildren();
  if(!q){result.hidden=true;return;}
  result.hidden=false;
  const found=[...state.entries.values()].filter(entry=>entry.text.toLocaleLowerCase('es').includes(q)).sort((a,b)=>b.date.localeCompare(a.date));
  if(!found.length){ const p=document.createElement('p');p.className='empty-help';p.style.padding='10px 4px';p.textContent='No hay recuerdos con esa palabra.';result.append(p);return; }
  for(const entry of found.slice(0,30)) {
    const btn=document.createElement('button');const title=document.createElement('strong');title.textContent=prettyDate(entry.date);
    const small=document.createElement('span');small.textContent=entry.text.trim().replace(/\s+/g,' ').slice(0,90);
    btn.append(title,small);btn.addEventListener('click',()=>{selectDate(entry.date);$('searchInput').value='';renderSearch();});result.append(btn);
  }
}
function renderSummary() {
  const written=[...state.entries.values()].filter(isWritten).length;
  $('diaryCount').textContent=`${written} ${written===1?'página escrita':'páginas escritas'}`;
  renderCalendar();renderFavorites();renderSearch();
}
function updateHeader() {
  const date=dateFromKey(state.date), entry=getEntry();
  $('weekdayLabel').textContent=WEEKDAYS[date.getDay()].toLocaleUpperCase('es');
  $('selectedDateLabel').textContent=prettyDate(state.date);
  $('breadcrumbYear').textContent=String(date.getFullYear());
  $('breadcrumbMonth').textContent=MONTHS[date.getMonth()].toLocaleUpperCase('es');
  const fav=$('favoriteButton');fav.classList.toggle('active',entry.favorite);
  fav.setAttribute('aria-pressed',String(entry.favorite));
  fav.querySelector('span').textContent=entry.favorite?'En favoritos':'Favorito';
}
async function selectDate(key) {
  if(!/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
  if(key===state.date){closeMobileMenu();return;}
  if(state.saveTimer) flushSave();
  state.date=key;
  const date=dateFromKey(key);
  state.month=new Date(date.getFullYear(),date.getMonth(),1,12);
  $('diaryText').value=getEntry().text;
  updateHeader(); renderSummary(); await renderPhotos();
  closeMobileMenu();
  updatePaperHeight();
  setSaveStatus('Todos los cambios guardados ♡');
}
function shiftDay(n) {
  const d=dateFromKey(state.date);d.setDate(d.getDate()+n);void selectDate(dateKey(d));
}
function randomPage() {
  const entries=[...state.entries.values()].filter(isWritten).map(e=>e.date);
  const others=entries.filter(key=>key!==state.date);
  const pool=others.length?others:entries;
  if(!pool.length){toast('Todavía no tienes páginas escritas. ¡Empieza por una!');return;}
  const key=pool[Math.floor(Math.random()*pool.length)];
  void selectDate(key);toast(`Un recuerdo inesperado: ${prettyDate(key)} ✦`);
}
function openMobileMenu() { $('sidebar').classList.add('open');$('mobileBackdrop').classList.add('open'); }
function closeMobileMenu() { $('sidebar').classList.remove('open');$('mobileBackdrop').classList.remove('open'); }

function updatePaperHeight() {
  const text=$('diaryText');const page=$('paperContent');
  // Adjust the entire lined sheet, not a tiny internal scrolling textarea.
  text.style.height='620px';
  let height=Math.max(620,text.scrollHeight);
  const width=page.clientWidth||350;
  for(const p of getEntry().photos) {
    height=Math.max(height,Math.round(p.y+(width*p.w/100)/Math.max(.3,p.ratio)+85));
  }
  page.style.height=`${height}px`;
  text.style.height=`${height}px`;
}
function clearPhotos() {
  for (const url of state.photoUrls) URL.revokeObjectURL(url);
  state.photoUrls=[];
  $('photoLayer').replaceChildren();
  state.selectedPhoto=null;
}
function photoMeta(id) { return getEntry().photos.find(p=>p.id===id); }
function syncSticker(el,p) {
  el.style.left=`${p.x}%`;
  el.style.top=`${p.y}px`;
  el.style.width=`${p.w}%`;
  el.style.aspectRatio=String(Math.max(.35,p.ratio));
  el.style.setProperty('--rot',`${p.rot||0}deg`);
  el.style.zIndex=String(p.z||1);
}
function selectPhoto(id) {
  state.selectedPhoto=id;
  for(const el of $('photoLayer').children) {
    const selected=el.dataset.id===id;
    el.classList.toggle('selected',selected);
    el.querySelector('.photo-tools')?.remove();
    el.querySelector('.resize-grip')?.remove();
    if(!selected)continue;
    const tools=document.createElement('div');tools.className='photo-tools';
    const actions=[
      ['−','Hacer foto más pequeña','smaller'],['+','Hacer foto más grande','larger'],['↻','Girar fotografía','rotate'],
      ['⇧','Traer al frente','front'],['×','Eliminar fotografía','delete']
    ];
    for(const [label,title,action] of actions) {
      const btn=document.createElement('button');btn.type='button';btn.textContent=label;btn.title=title;btn.setAttribute('aria-label',title);
      if(action==='delete')btn.classList.add('remove-photo');
      btn.addEventListener('pointerdown',event=>event.stopPropagation());
      btn.addEventListener('click',event=>{event.stopPropagation();doPhotoAction(id,action);});
      tools.append(btn);
    }
    const handle=document.createElement('div');handle.className='resize-grip';handle.textContent='↘';
    handle.title='Arrastra para cambiar el tamaño';handle.setAttribute('aria-label','Cambiar tamaño de la foto');
    handle.addEventListener('pointerdown',event=>startPhotoDrag(event,el,id,'resize'));
    el.append(tools,handle);
  }
}
function doPhotoAction(id,action) {
  const p=photoMeta(id);if(!p)return;
  if(action==='delete') {
    if(!confirm('¿Eliminar esta fotografía de la página?'))return;
    const entry=getEntry();entry.photos=entry.photos.filter(photo=>photo.id!==id);
    requestSave();void removePhotoBlob(id).catch(err=>console.error(err));
    void renderPhotos();updatePaperHeight();return;
  }
  if(action==='smaller')p.w=Math.max(14,Math.round(p.w-6));
  if(action==='larger')p.w=Math.min(94-p.x,Math.round(p.w+6));
  if(action==='rotate')p.rot=((p.rot||0)+3)>9?-9:(p.rot||0)+3;
  if(action==='front')p.z=Math.max(0,...getEntry().photos.map(ph=>ph.z||1))+1;
  const node=[...$('photoLayer').children].find(el=>el.dataset.id===id);
  if(node)syncSticker(node,p);
  requestSave();updatePaperHeight();
}
function startPhotoDrag(event,el,id,mode='move') {
  if(event.button!==undefined&&event.button!==0)return;
  const p=photoMeta(id);if(!p)return;
  event.preventDefault();event.stopPropagation();
  selectPhoto(id);
  const container=$('paperContent');const bounding=container.getBoundingClientRect();
  const startX=event.clientX,startY=event.clientY,originX=p.x,originY=p.y,originW=p.w;
  let moved=false;
  const move=e=>{
    if(e.pointerId!==event.pointerId)return;
    const dx=e.clientX-startX,dy=e.clientY-startY;
    if(Math.abs(dx)+Math.abs(dy)>2)moved=true;
    const width=bounding.width||300;
    if(mode==='resize') {
      p.w=Math.max(14,Math.min(95-p.x,originW+dx/width*100));
    } else {
      p.x=Math.max(0,Math.min(97-p.w,originX+dx/width*100));
      p.y=Math.max(5,Math.min(20000,originY+dy));
    }
    syncSticker(el,p);updatePaperHeight();
  };
  const up=e=>{
    if(e.pointerId!==event.pointerId)return;
    window.removeEventListener('pointermove',move);window.removeEventListener('pointerup',up);window.removeEventListener('pointercancel',up);
    if(moved)requestSave();
  };
  window.addEventListener('pointermove',move);
  window.addEventListener('pointerup',up);
  window.addEventListener('pointercancel',up);
}
async function renderPhotos() {
  const token=++state.photoRenderToken;
  clearPhotos();
  const entry=getEntry();const date=state.date;
  for(const p of entry.photos) {
    let blob;
    try { blob=await getPhotoBlob(p.id); } catch(err) { console.error(err); continue; }
    if(token!==state.photoRenderToken||date!==state.date)return;
    if(!blob)continue;
    const url=URL.createObjectURL(blob);state.photoUrls.push(url);
    const el=document.createElement('div');el.className='photo-sticker';el.dataset.id=p.id;
    el.setAttribute('role','button');el.setAttribute('tabindex','0');el.setAttribute('aria-label','Fotografía. Toca para seleccionar o arrastra para mover.');
    const img=document.createElement('img');img.src=url;img.alt='Fotografía del diario';img.draggable=false;
    el.append(img);syncSticker(el,p);
    el.addEventListener('pointerdown',event=>startPhotoDrag(event,el,p.id));
    el.addEventListener('keydown',event=>{
      if(event.key==='Enter'||event.key===' '){event.preventDefault();selectPhoto(p.id);}
      if(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'].includes(event.key)) {
        event.preventDefault();const step=event.shiftKey?15:3;
        if(event.key==='ArrowUp')p.y=Math.max(0,p.y-step);
        if(event.key==='ArrowDown')p.y+=step;
        if(event.key==='ArrowLeft')p.x=Math.max(0,p.x-step/4);
        if(event.key==='ArrowRight')p.x=Math.min(96-p.w,p.x+step/4);
        syncSticker(el,p);updatePaperHeight();requestSave();
      }
    });
    $('photoLayer').append(el);
  }
  updatePaperHeight();
}
async function preparePhoto(file) {
  if (!file.type.startsWith('image/')) throw new Error('Ese archivo no es una imagen.');
  const url=URL.createObjectURL(file);
  try {
    const img=new Image();img.src=url;
    await img.decode();
    const ratio=img.naturalWidth/img.naturalHeight;
    if(!Number.isFinite(ratio)||ratio<=0) throw new Error('La fotografía está dañada.');
    const max=2200, scale=Math.min(1,max/Math.max(img.naturalWidth,img.naturalHeight));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.naturalWidth*scale));canvas.height=Math.max(1,Math.round(img.naturalHeight*scale));
    const ctx=canvas.getContext('2d');if(!ctx)throw new Error('No se puede procesar la imagen.');
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const outputType=file.type==='image/png'?'image/png':'image/jpeg';
    const blob=await new Promise((resolve,reject)=>canvas.toBlob(result=>result?resolve(result):reject(new Error('No se pudo procesar la fotografía.')),outputType,.84));
    return {blob,ratio};
  } finally {URL.revokeObjectURL(url);}
}
async function addPhotos(files) {
  if(!state.db||!files.length)return;
  const date=state.date;
  const entry=getEntry(date);
  let success=0;
  setSaveStatus('Preparando fotografías…','busy');
  for(const [index,file] of files.entries()) {
    try {
      const {blob,ratio}=await preparePhoto(file);
      const id=uid();await putPhotoBlob(id,blob);
      const top=$('paperContent').getBoundingClientRect().top;
      const y=Math.max(35,Math.round(Math.min(850,window.innerHeight*.43-top)))+(index%5)*38;
      const photo={id,x:Math.min(44,12+(index%3)*12),y,w:Math.min(46,ratio<.72?34:45),ratio,rot:[-3,2,-1,4][index%4],z:entry.photos.length+1};
      entry.photos.push(photo);success++;
    } catch(err){console.error(err);toast(`No se pudo añadir «${file.name}»: ${err.message}`);}
  }
  if(success) {
    // Save to the correct day even if user changed pages while importing.
    await writeEntry(cloneEntry(entry));
    renderSummary();
    if(state.date===date){await renderPhotos();updatePaperHeight();}
    toast(success===1?'Fotografía añadida. ¡Puedes moverla!':`${success} fotografías añadidas. Puedes moverlas y cambiar su tamaño.`);
  } else setSaveStatus('No se pudieron añadir fotografías','error');
}
function readBlobAsDataURL(blob) {
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(reader.error);reader.readAsDataURL(blob);
  });
}
function fromDataURL(value) {
  const match=/^data:(image\/[a-zA-Z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(value);
  if(!match) throw new Error('La copia contiene una imagen no válida.');
  const binary=atob(match[2]);const chunks=[];
  for(let start=0;start<binary.length;start+=65536) {
    const end=Math.min(binary.length,start+65536),chunk=new Uint8Array(end-start);
    for(let i=start;i<end;i++)chunk[i-start]=binary.charCodeAt(i);
    chunks.push(chunk);
  }
  return new Blob(chunks,{type:match[1]});
}
async function exportBackup() {
  if(state.saveTimer)await flushSave();
  if(!state.db)return;
  try {
    setSaveStatus('Preparando copia de seguridad…','busy');
    const entries=[...state.entries.values()].filter(isPersistent).map(cloneEntry);
    const ids=[...new Set(entries.flatMap(e=>e.photos.map(p=>p.id)))];
    const photos=[];
    for(const id of ids) {
      const blob=await getPhotoBlob(id);
      if(blob)photos.push({id,data:await readBlobAsDataURL(blob)});
    }
    const payload={format:'recuerdos1996-backup',version:1,exportedAt:new Date().toISOString(),entries,photos};
    const name=`Recuerdos1996_Copia_${dateKey(new Date())}.json`;
    const file=new File([JSON.stringify(payload)],name,{type:'application/json'});
    if(navigator.canShare?.({files:[file]}) && navigator.share) {
      try {await navigator.share({files:[file],title:'Copia de mi diario Recuerdos 1996'});} catch(e) {if(e.name!=='AbortError')throw e;}
    } else {
      const url=URL.createObjectURL(file);const link=document.createElement('a');link.href=url;link.download=name;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),10000);
    }
    toast('Copia preparada. Guárdala en Archivos o iCloud Drive.');
    setSaveStatus('Todos los cambios guardados ♡');
  } catch(err) {console.error(err);setSaveStatus('Error creando la copia','error');toast(`No se pudo crear la copia: ${err.message}`);}
}
function validEntry(item) {
  return item&&/^\d{4}-\d{2}-\d{2}$/.test(item.date)&&typeof item.text==='string'&&Array.isArray(item.photos)&&
    item.photos.every(p=>p&&typeof p.id==='string'&&Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.w)&&Number.isFinite(p.ratio));
}
async function importBackup(file) {
  if(!state.db)return;
  try {
    const data=JSON.parse(await file.text());
    if(data.format!=='recuerdos1996-backup'||data.version!==1||!Array.isArray(data.entries)||!Array.isArray(data.photos)||!data.entries.every(validEntry)) throw new Error('El archivo no es una copia compatible de Recuerdos 1996.');
    if(!confirm(`La copia contiene ${data.entries.length} páginas y ${data.photos.length} fotografías.\n\nRestaurarla sustituirá TODO tu diario actual. ¿Quieres continuar?`))return;
    setSaveStatus('Restaurando tu diario…','busy');
    clearTimeout(state.saveTimer);state.saveTimer=null;
    const photos=[];
    for(const record of data.photos) {
      if(!record||typeof record.id!=='string'||typeof record.data!=='string')throw new Error('La copia contiene fotografías incorrectas.');
      photos.push({id:record.id,blob:fromDataURL(record.data)});
    }
    const tx=state.db.transaction(['entries','photos'],'readwrite');
    const done=transactionFinished(tx);
    tx.objectStore('entries').clear();tx.objectStore('photos').clear();
    for(const e of data.entries) tx.objectStore('entries').put(e);
    for(const p of photos)tx.objectStore('photos').put(p);
    await done;
    await readAllEntries();
    $('diaryText').value=getEntry().text;
    updateHeader();renderSummary();await renderPhotos();
    setSaveStatus('Copia restaurada ♡');
    toast(`¡Recuerdos recuperados! ${data.entries.length} páginas restauradas.`);
  } catch(err){console.error(err);setSaveStatus('No se pudo restaurar la copia','error');toast(`No se pudo restaurar: ${err.message}`);}
}
function bind() {
  $('prevMonth').addEventListener('click',()=>navigateMonth(-1));
  $('nextMonth').addEventListener('click',()=>navigateMonth(1));
  $('monthInput').addEventListener('change',event=>{
    const [y,m]=event.target.value.split('-').map(Number);
    if(y>=1900&&y<=2200&&m>=1&&m<=12){state.month=new Date(y,m-1,1,12);renderCalendar();}
  });
  $('todayButton').addEventListener('click',()=>selectDate(dateKey(new Date())));
  $('prevDay').addEventListener('click',()=>shiftDay(-1));
  $('nextDay').addEventListener('click',()=>shiftDay(1));
  $('randomButton').addEventListener('click',randomPage);
  $('themeButton').addEventListener('click',()=>{document.body.classList.toggle('dark');updateTheme();});
  $('favoriteButton').addEventListener('click',()=>{
    const entry=getEntry();entry.favorite=!entry.favorite;updateHeader();requestSave();
    toast(entry.favorite?'Esta página ya está en tus favoritos ★':'Página retirada de favoritos');
  });
  $('diaryText').addEventListener('input',()=>{getEntry().text=$('diaryText').value;updatePaperHeight();requestSave();});
  $('addPhoto').addEventListener('click',()=>$('photosInput').click());
  $('photosInput').addEventListener('change',async event=>{ const files=[...event.target.files];event.target.value='';await addPhotos(files);});
  $('backupButton').addEventListener('click',exportBackup);
  $('importButton').addEventListener('click',()=>$('backupInput').click());
  $('backupInput').addEventListener('change',async event=>{const file=event.target.files?.[0];event.target.value='';if(file)await importBackup(file);});
  $('searchInput').addEventListener('input',renderSearch);
  $('menuButton').addEventListener('click',openMobileMenu);
  $('closeMenuButton').addEventListener('click',closeMobileMenu);
  $('mobileBackdrop').addEventListener('click',closeMobileMenu);
  $('helpButton').addEventListener('click',()=>$('helpDialog').showModal());
  $('privacyButton').addEventListener('click',()=>$('helpDialog').showModal());
  $('closeHelp').addEventListener('click',()=>$('helpDialog').close());
  $('dialogDone').addEventListener('click',()=>$('helpDialog').close());
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.photo-sticker'))selectPhoto(null);});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&state.saveTimer)flushSave();});
  window.addEventListener('pagehide',()=>{if(state.saveTimer)flushSave();});
  window.addEventListener('resize',updatePaperHeight);
  document.addEventListener('keydown',event=>{if(event.key==='Escape'){closeMobileMenu();selectPhoto(null);}});
}
async function init() {
  bind();
  try {if(localStorage.getItem('recuerdos1996-theme')==='dark')document.body.classList.add('dark');}catch{}
  updateTheme();
  try {
    state.db=await dbOpen();await readAllEntries();state.loaded=true;
    getEntry();$('diaryText').value=getEntry().text;
    updateHeader();renderSummary();await renderPhotos();
    setSaveStatus('Todos los cambios guardados ♡');
    if(navigator.storage?.persist)navigator.storage.persist().catch(()=>{});
  } catch(err) {
    console.error(err);
    setSaveStatus('No se puede guardar: almacenamiento bloqueado','error');
    toast('Tu navegador no permite guardar. Abre la app en Safari normal y vuelve a intentarlo.');
  }
  if('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    navigator.serviceWorker.register('./service-worker.js').catch(err=>console.warn('Offline cache:',err));
  }
}
init();
