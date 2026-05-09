/* app.js — De Cuestas, Abras y Quebradas */
'use strict';

let activeTipo    = "TODOS";
let activeProv    = "TODAS";
let activeFilter  = "TODOS";
let searchQuery   = "";
let activeItemEl  = null;
let currentDetail = null;

/* ── STORAGE ─────────────────────────────────────────────── */
function getFavs()  { try { return JSON.parse(localStorage.getItem('favs')  || '{}'); } catch(e){ return {}; } }
function getDones() { try { return JSON.parse(localStorage.getItem('dones') || '{}'); } catch(e){ return {}; } }
function itemKey(d) { return d.tipo + '|' + d.nombre + '|' + d.prov; }

function toggleFav(d) {
  const favs = getFavs(), k = itemKey(d);
  favs[k] ? delete favs[k] : (favs[k] = true);
  localStorage.setItem('favs', JSON.stringify(favs));
  renderList(); renderDetail(d);
}
function toggleDone(d) {
  const dones = getDones(), k = itemKey(d);
  dones[k] ? delete dones[k] : (dones[k] = true);
  localStorage.setItem('dones', JSON.stringify(dones));
  renderList(); renderDetail(d);
}

/* ── COMPARTIR ───────────────────────────────────────────── */
function shareRuta(d) {
  // Guardar en localStorage que esta ruta fue compartida
  const k = itemKey(d);
  localStorage.setItem('shared_' + k, '1');

  // Generar slug para la URL
  const slug = (d.tipo + '_' + d.nombre).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');

  const base = window.location.href.split('?')[0].split('#')[0];
  const url  = `${base}?ruta=${encodeURIComponent(slug)}`;

  const tipo = d.tipo === 'RUTA ESCÉNICA' ? 'Ruta Escénica' : d.tipo.charAt(0) + d.tipo.slice(1).toLowerCase();
  const text = `${tipo} ${d.nombre} — ${d.prov}${d.alt ? ', ' + d.alt.toLocaleString('es-AR') + ' m' : ''}`;
  const full = `${text}\n${url}`;

  if (navigator.share) {
    navigator.share({ title: text, text: full, url })
      .then(() => { renderList(); renderDetail(d); })
      .catch(() => {});
  } else {
    navigator.clipboard.writeText(full).then(() => {
      showToast('¡Link copiado al portapapeles!');
      renderList(); renderDetail(d);
    }).catch(() => showToast('No se pudo copiar'));
  }
}

function showToast(msg) {
  let t = document.getElementById('share-toast');
  if (!t) {
    t = document.createElement('div');
    t.id = 'share-toast';
    document.body.appendChild(t);
  }
  t.textContent = msg;
  t.classList.add('visible');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('visible'), 2800);
}

/* ── TTS ──────────────────────────────────────────────────── */
let isSpeaking = false;
function speakObs(text, btnEl) {
  if (!window.speechSynthesis) return;
  if (isSpeaking) {
    window.speechSynthesis.cancel(); isSpeaking = false;
    document.querySelectorAll('.tts-btn').forEach(b => b.classList.remove('tts-playing'));
    return;
  }
  function doSpeak() {
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = 'es-AR'; utt.rate = 0.88;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find(v=>v.lang==='es-AR') || voices.find(v=>v.lang==='es-ES') || voices.find(v=>v.lang.startsWith('es'));
    if (v) utt.voice = v;
    utt.onstart = () => { isSpeaking = true; btnEl && btnEl.classList.add('tts-playing'); };
    utt.onend = utt.onerror = () => { isSpeaking = false; document.querySelectorAll('.tts-btn').forEach(b=>b.classList.remove('tts-playing')); };
    window.speechSynthesis.speak(utt);
  }
  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) doSpeak();
  else { window.speechSynthesis.onvoiceschanged = ()=>{ window.speechSynthesis.onvoiceschanged=null; doSpeak(); }; setTimeout(doSpeak, 400); }
}

/* ── SEARCH ─────────────────────────────────────────────── */
const searchInput = document.getElementById("searchInput");
const searchClear = document.getElementById("searchClear");

searchInput.addEventListener("input", () => {
  searchQuery = searchInput.value.trim().toLowerCase();
  searchClear.classList.toggle("visible", searchQuery.length > 0);
  activeProv = "TODAS";
  renderList();
});
searchClear.addEventListener("click", () => {
  searchInput.value = ""; searchQuery = "";
  searchClear.classList.remove("visible");
  searchInput.focus(); renderList();
});

/* ── MAPS MODAL ──────────────────────────────────────────── */
function openMaps(nombre, prov, tipo, mapSrc) {
  const src = mapSrc || "https://maps.google.com/maps?q=" +
    encodeURIComponent((tipo==="RUTA ESCÉNICA"?"Ruta Escénica ":tipo+" ")+nombre+" "+prov+" Argentina") +
    "&output=embed&hl=es";
  document.getElementById("mapsFrame").src = src;
  document.getElementById("mapsTitle").textContent = tipo+" "+nombre+" — "+prov;
  document.getElementById("mapsModal").classList.add("open");
  document.body.style.overflow = "hidden";
}
function closeMaps(e) { if (e.target===document.getElementById("mapsModal")) closeMapsBtn(); }
function closeMapsBtn() {
  document.getElementById("mapsModal").classList.remove("open");
  document.getElementById("mapsFrame").src = "";
  document.body.style.overflow = "";
}
document.addEventListener("keydown", e => { if (e.key==="Escape") closeMapsBtn(); });

/* ── FILTERING ───────────────────────────────────────────── */
function getFiltered() {
  const favs = getFavs(), dones = getDones();
  return DATA.filter(d => {
    const matchTipo = searchQuery ? true : (activeTipo==="TODOS" || d.tipo===activeTipo);
    let matchSearch = true;
    if (searchQuery) {
      const hay = [d.nombre, d.prov, d.ruta, d.obs, d.tipo, d.dif, d.sup, d.epoca||'', d.prec||'']
        .join(" ").toLowerCase()
        .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      const q = searchQuery.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
      matchSearch = q.split(/\s+/).every(tok => hay.includes(tok));
    }
    const k = itemKey(d);
    const matchFilter = activeFilter==="TODOS" ? true
      : activeFilter==="FAVORITOS" ? !!favs[k]
      : !!dones[k];
    return matchTipo && matchSearch && matchFilter;
  }).sort((a,b) => {
    const TIPO_ORDER = {"RUTA ESCÉNICA":0,"QUEBRADA":1,"CUESTA":2,"ABRA":3};
    const showingAll = activeTipo==="TODOS" && !searchQuery && activeFilter==="TODOS";
    if (showingAll) {
      const ta = TIPO_ORDER[a.tipo]??9, tb = TIPO_ORDER[b.tipo]??9;
      if (ta !== tb) return ta - tb;
    }
    return a.nombre.localeCompare(b.nombre,'es');
  });
}

function filterTipo(t, btn) {
  activeTipo = t; activeItemEl = null;
  searchInput.value = ""; searchQuery = "";
  searchClear.classList.remove("visible");
  document.querySelectorAll("#tipoSection .pill").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  // Restaurar sidebar en mobile si estaba oculta
  document.querySelector(".sidebar").style.display = "";
  document.querySelector(".main").classList.remove("has-selection");
  document.getElementById("detail").innerHTML = emptyState();
  renderList();
}

function filterSpecial(f, btn) {
  activeFilter = f;
  document.querySelectorAll(".filter-special").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  // Restaurar sidebar en mobile si estaba oculta
  document.querySelector(".sidebar").style.display = "";
  document.querySelector(".main").classList.remove("has-selection");
  activeItemEl = null;
  document.getElementById("detail").innerHTML = emptyState();
  renderList();
}

/* ── RANDOM ──────────────────────────────────────────────── */
function showRandom() {
  // Clear search so we pick from the full tipo list
  searchInput.value = ""; searchQuery = "";
  searchClear.classList.remove("visible");

  const filtered = getFiltered();
  if (!filtered.length) return;
  const d = filtered[Math.floor(Math.random() * filtered.length)];

  renderList();
  const list = document.getElementById("sideList");
  const allItems = list.querySelectorAll(".route-item");
  let found = null;
  getFiltered().forEach((fd, idx) => {
    if (fd.nombre === d.nombre && fd.prov === d.prov) found = allItems[idx];
  });
  if (found) {
    if (activeItemEl) activeItemEl.classList.remove("active");
    found.classList.add("active");
    activeItemEl = found;
    found.scrollIntoView({ behavior:"smooth", block:"start" });
    document.getElementById("detail").scrollTop = 0;
  }
  renderDetail(d);
}

/* ── HIGHLIGHT ───────────────────────────────────────────── */
function highlight(text, query) {
  if (!query || !text) return text||"";
  const norm = query.normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  let out = text;
  norm.split(/\s+/).filter(Boolean).forEach(tok => {
    const re = new RegExp("("+tok.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi");
    out = out.replace(re,'<span class="hl">$1</span>');
  });
  return out;
}

/* ── SIDEBAR LIST ────────────────────────────────────────── */
function renderList() {
  const filtered = getFiltered();
  document.getElementById("sideCount").textContent =
    filtered.length + (filtered.length===1?" camino":" caminos");

  const list = document.getElementById("sideList");
  list.innerHTML = "";

  if (filtered.length === 0) {
    list.innerHTML = '<div class="no-results"><div class="no-results-icon">🔍</div><div class="no-results-txt">Sin resultados</div></div>';
    return;
  }

  const favs = getFavs(), dones = getDones();
  filtered.forEach(d => {
    const el = document.createElement("div");
    el.className = "route-item";
    const k = itemKey(d);
    const isFav=!!favs[k], isDone=!!dones[k];

    const difCls = d.dif==="BAJA"?"b-baja":d.dif==="MEDIA"?"b-media":d.dif==="ALTA"?"b-alta":"b-nd";
    const supBase = d.sup.split("/")[0];
    const supCls = supBase==="ASFALTO"?"b-asfalto":supBase==="RIPIO"?"b-ripio":supBase==="MIXTO"?"b-mixto":"b-nd";
    const difBadge = d.dif!=="—"?`<span class="badge ${difCls}">${d.dif}</span>`:"";
    const supBadge = d.sup!=="—"?`<span class="badge ${supCls}">${d.sup}</span>`:"";

    // Large icons in the list when active
    const shared = !!localStorage.getItem('shared_'+k);
    const icons = (isFav?'<span class="ri-icon fav-icon" title="Favorito">♥</span>':"") +
                  (isDone?'<span class="ri-icon done-icon" title="Visitado">✓</span>':"") +
                  (shared?'<span class="ri-icon share-icon" title="Compartido">⇧</span>':"");

    el.innerHTML =
      `<div class="ri-type">${d.tipo}</div>` +
      `<div class="ri-name-row"><span class="ri-name">${highlight(d.nombre,searchQuery)}</span><span class="ri-icons">${icons}</span></div>` +
      `<div class="ri-prov">${highlight(d.prov,searchQuery)}${d.ruta?" · "+d.ruta:""}</div>` +
      `<div class="ri-badges">${difBadge}${supBadge}</div>`;

    el.addEventListener("click", () => {
      const yaHabiaSeleccion = !!activeItemEl;
      if (activeItemEl) activeItemEl.classList.remove("active");
      el.classList.add("active");
      activeItemEl = el;
      document.querySelector(".main").classList.add("has-selection");
      // En mobile ocultamos la sidebar completamente
      if (window.innerWidth <= 680) {
        document.querySelector(".sidebar").style.display = "none";
      }
      document.getElementById("detail").scrollTop = 0;
      renderDetail(d);
      if (yaHabiaSeleccion) {
        history.replaceState({ itemIndex: DATA.indexOf(d) }, "");
      } else {
        history.pushState({ itemIndex: DATA.indexOf(d) }, "");
      }
    });
    list.appendChild(el);
  });
}

/* ── DETAIL PANEL ────────────────────────────────────────── */
function renderDetail(d) {
  currentDetail = d;
  const det   = document.getElementById("detail");
  const color = TIPO_COLORS[d.tipo]||"#7A3A18";
  const desc  = TIPO_DESCS[d.tipo]||"";
  const altStr = d.alt ? d.alt.toLocaleString("es-AR")+" m" : "S/D";
  const favs = getFavs(), dones = getDones(), k = itemKey(d);
  const isFav=!!favs[k], isDone=!!dones[k];

  const difColor = d.dif==="BAJA"?"var(--dif-baja)":d.dif==="MEDIA"?"var(--dif-media)":d.dif==="ALTA"?"#C0100A":"var(--ink-lt)";
  const supBase  = d.sup.split("/")[0];
  const supColor = supBase==="ASFALTO"?"#2A5A7A":supBase==="RIPIO"?"var(--ink-md)":supBase==="MIXTO"?"#5A3A7A":"var(--ink-lt)";

  const slug = (d.tipo+"_"+d.nombre).toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g,"")
    .replace(/[^a-z0-9]+/g,"_").replace(/^_|_$/g,"");

  const tipoLabel = d.tipo==="RUTA ESCÉNICA"?"Rutas Escénicas":d.tipo.charAt(0)+d.tipo.slice(1).toLowerCase()+"s";
  function esc(s){ return (s||'').replace(/\\/g,"\\\\").replace(/'/g,"\\'"); }
  const mapSrcJs = d.mapSrc ? `'${esc(d.mapSrc)}'` : "null";
  const obsEscJs = (d.obs||'').replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/"/g,'&quot;');
  const obsClass = d.warn?"obs-warn":(d.obs.toLowerCase().startsWith("de ")||d.obs.toLowerCase().startsWith("desde "))?"obs-route":"obs-info";

  // Map img helper — uses explicit filename fields when present, falls back to slug
  function mapImg(slugSuffix, label, explicitFile) {
    const src = explicitFile ? `mapas/${explicitFile}` : `mapas/${slug}${slugSuffix}.jpg`;
    return `<div class="map-container" id="mapa_${slug}${slugSuffix}">` +
      `<img src="${src}" alt="Mapa ${d.nombre}" ` +
      `style="width:100%;height:auto;max-width:100%;max-height:70vh;object-fit:contain;display:block;" ` +
      `onload="this.nextElementSibling.style.display='none'" onerror="this.parentElement.style.display='none'"/>` +
      `<div class="map-placeholder"><div class="map-placeholder-icon">🗺</div><div class="map-placeholder-txt">${label}</div></div>` +
      `</div>`;
  }

  det.classList.remove('detail-enter');
  // forzar reflow para reiniciar la animación
  void det.offsetWidth;
  det.classList.add('detail-enter');

  det.innerHTML =
    `<div class="hero-accent-bar" style="background:${color}"></div>` +
    `<div class="hero-band">` +
      `<div class="hero-accent" style="color:${color}">${d.tipo}</div>` +
      `<div class="hero-title-row">` +
        `<div class="hero-title">${d.nombre}</div>` +
        `<div class="hero-state-badges">` +
          (isFav  ? `<span class="state-badge fav-badge"  title="Favorito">♥</span>`   : '') +
          (isDone ? `<span class="state-badge done-badge" title="Visitado">✓</span>`   : '') +
        `</div>` +
      `</div>` +
      `<div class="hero-loc">◈ ${d.prov}${d.ruta?" · "+d.ruta:""}</div>` +
      `<div class="hero-actions">` +
        `<button class="action-btn fav-btn${isFav?" active":""}" onclick="toggleFav(currentDetail)">♥ <span class="action-label">Favorito</span></button>` +
        `<button class="action-btn done-btn${isDone?" active":""}" onclick="toggleDone(currentDetail)">✓ <span class="action-label">Visitado</span></button>` +
        `<button class="action-btn share-btn" onclick="shareRuta(currentDetail)" title="Compartir">` +
          `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">` +
            `<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>` +
            `<line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>` +
          `</svg>` +
          `<span class="action-label">Compartir</span>` +
        `</button>` +
      `</div>` +
    `</div>` +

    // Stats
    `<div class="stats-grid">` +
      `<div class="stat"><span class="stat-val">${altStr}</span><span class="stat-key">Altitud máx.</span></div>` +
      `<div class="stat"><span class="stat-val" style="color:${difColor}">${d.dif}</span><span class="stat-key">Dificultad</span></div>` +
      `<div class="stat"><span class="stat-val" style="color:${supColor}">${d.sup}</span><span class="stat-key">Superficie</span></div>` +
      `<div class="stat"><span class="stat-val">${d.ruta||"—"}</span><span class="stat-key">Ruta</span></div>` +
    `</div>` +

    // Observaciones — TTS button junto al título
    (d.obs ? `<div class="obs-block obs-above-map">` +
      `<div class="obs-title-row">` +
        `<div class="sec-title">Observaciones</div>` +
        `<button class="tts-btn" onclick="speakObs('${obsEscJs}',this)" title="Escuchar">` +
          `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">` +
            `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>` +
            `<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>` +
            `<path d="M19.07 4.93a10 10 0 0 1 0 14.14" class="tts-wave2"/>` +
          `</svg>` +
          `<span class="tts-label">Escuchar</span>` +
        `</button>` +
      `</div>` +
      `<span class="obs-tag ${obsClass}">${d.warn?"⚠ ":""}${d.obs}</span>` +
      `</div>` : "") +

    // Mapa
    `<div class="map-section"><div class="sec-title">Mapa</div>` +
      `<div class="map-btns-row">` +
        (d.mapNoDisp
          ? `<div class="gmaps-btn gmaps-nodisp">📍 Ruta no disponible en Google Maps</div>`
          : `<button class="gmaps-btn" onclick="openMaps('${esc(d.nombre)}','${esc(d.prov)}','${esc(d.tipo)}',${mapSrcJs})">` +
              `<svg width="15" height="15" viewBox="0 0 48 48"><path d="M24 4C16.27 4 10 10.27 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.73-6.27-14-14-14z" fill="#EA4335"/><circle cx="24" cy="18" r="5" fill="#fff"/></svg>` +
              `Ver en Google Maps</button>` +
            (d.wazeSrc
              ? `<a class="waze-btn" href="${d.wazeSrc}" target="_blank" rel="noopener">` +
                  `<svg width="15" height="15" viewBox="0 0 48 48" fill="none"><ellipse cx="24" cy="26" rx="18" ry="16" fill="#33CCFF"/><circle cx="17" cy="30" r="3" fill="#fff"/><circle cx="31" cy="30" r="3" fill="#fff"/><path d="M17 22 Q24 16 31 22" stroke="#fff" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="33" cy="12" r="5" fill="#FF6B00"/></svg>` +
                  `Abrir en Waze</a>`
              : '')
        ) +
      `</div>` +
      (!d.mapImgHidden ? mapImg('', `Mapa de ${d.nombre}`, d.mapImg||null) : "") +
      (d.hasMap2 ? mapImg('_2', `Mapa 2 de ${d.nombre}`, d.mapImg2||null) : "") +
    `</div>` +

    // Galería — usa foto1/foto2 explícitos si existen, si no cae al slug
    (!d.noPhotos
      ? `<div class="photos-section" id="gallery_${slug}"><div class="sec-title">Galería</div>` +
        `<div class="photos-pair">` +
          `<div class="photo-container" id="foto1_${slug}"><img src="fotos/${d.foto1||slug+'_1.jpg'}" alt="foto 1" onload="this.nextElementSibling.style.display='none'" onerror="this.parentElement.style.display='none';checkGalleryEmpty('gallery_${slug}')"/><div class="photo-placeholder"><div class="photo-placeholder-icon">📷</div><div class="photo-placeholder-txt">Foto 1</div></div></div>` +
          `<div class="photo-container" id="foto2_${slug}"><img src="fotos/${d.foto2||slug+'_2.jpg'}" alt="foto 2" onload="this.nextElementSibling.style.display='none'" onerror="this.parentElement.style.display='none';checkGalleryEmpty('gallery_${slug}')"/><div class="photo-placeholder"><div class="photo-placeholder-icon">📷</div><div class="photo-placeholder-txt">Foto 2</div></div></div>` +
        `</div></div>`
      : ""
    ) +

    // Mejor época
    (d.epoca ? `<div class="info-block epoca-block"><div class="sec-title">Mejor época</div><p class="info-txt epoca-txt">🗓 ${d.epoca}</p></div>` : "") +

    // Precauciones
    (d.prec ? `<div class="info-block prec-block"><div class="sec-title">Precauciones</div><p class="info-txt prec-txt">⚠ ${d.prec}</p></div>` : "") +

    // Iconos
    `<div class="stats-grid icon-grid">` +
      `<div class="stat icon-stat">${d.icono ? `<img src="iconos/${d.icono}" class="stat-ruta-icon" alt="">` : ``}</div>` +
      `<div class="stat icon-stat">${d.icono2 ? `<img src="iconos/${d.icono2}" class="stat-ruta-icon" alt="">` : ``}</div>` +
      `<div class="stat icon-stat">${d.icono3 ? `<img src="iconos/${d.icono3}" class="stat-ruta-icon" alt="">` : ``}</div>` +
      `<div class="stat icon-stat">${d.icono4 ? `<img src="iconos/${d.icono4}" class="stat-ruta-icon" alt="">` : ``}</div>` +
    `</div>` +

    // Ícono Parque Nacional + descripción PN
    (d.iconopn || d.pnDesc ? `<div class="pn-block">` +
      (d.iconopn ? `<img src="iconos/${d.iconopn}" class="pn-icon" alt="Parque Nacional">` : '') +
      (d.pnDesc  ? `<p class="pn-desc">${d.pnDesc}</p>` : '') +
    `</div>` : '') +

    // Descripción
    `<div class="desc-block"><div class="sec-title">Acerca de las ${tipoLabel}</div><p class="desc-txt">${desc}</p></div>` +
    `<div class="detail-footer"></div>`;
}

function checkGalleryEmpty(id) {
  const g = document.getElementById(id); if (!g) return;
  if ([...g.querySelectorAll('.photo-container')].every(c=>c.style.display==='none')) g.style.display='none';
}

function emptyState() {
  return `<div class="empty-state">` +
    `<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" width="36" height="36" opacity="0.2">` +
      `<circle cx="60" cy="60" r="57" fill="#A0552A"/>` +
      `<polygon points="60,6 64,52 60,58 56,52" fill="#1A0A02"/>` +
      `<polygon points="60,114 64,68 60,62 56,68" fill="#1A0A02"/>` +
      `<polygon points="6,60 52,56 58,60 52,64" fill="#1A0A02"/>` +
      `<polygon points="114,60 68,56 62,60 68,64" fill="#1A0A02"/>` +
      `<polygon points="18,18 52,54 58,60 50,52" fill="#C07040"/>` +
      `<polygon points="102,18 68,54 62,60 70,52" fill="#C07040"/>` +
      `<polygon points="18,102 52,66 58,60 50,68" fill="#C07040"/>` +
      `<polygon points="102,102 68,66 62,60 70,68" fill="#C07040"/>` +
      `<circle cx="60" cy="60" r="14" fill="#7A3A18"/>` +
      `<circle cx="60" cy="60" r="5" fill="#D4956A"/>` +
    `</svg>` +
    `<div class="empty-txt">Seleccioná un camino</div>` +
  `</div>`;
}

/* ── INIT ────────────────────────────────────────────────── */
document.querySelectorAll("#tipoSection .pill").forEach(b => {
  b.classList.toggle("active", b.textContent==="Todos");
});
renderList();

/* ── DEEP LINK: abrir ruta desde URL ─────────────────────── */
(function() {
  const params = new URLSearchParams(window.location.search);
  const rutaSlug = params.get('ruta');
  if (!rutaSlug) return;

  // Buscar la ruta cuyo slug coincida
  function makeSlug(d) {
    return (d.tipo + '_' + d.nombre).toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  }

  const match = DATA.find(d => makeSlug(d) === rutaSlug);
  if (!match) return;

  // Activar el filtro correcto para que la ruta esté en la lista
  activeTipo = match.tipo;
  renderList();

  // Encontrar y clickear el elemento de la lista
  const list = document.getElementById('sideList');
  const items = list.querySelectorAll('.route-item');
  for (const el of items) {
    // Comparar por nombre dentro del elemento
    const nameEl = el.querySelector('.ri-name');
    if (nameEl && nameEl.textContent.trim() === match.nombre) {
      // En mobile ocultar sidebar
      if (window.innerWidth <= 680) {
        document.querySelector('.sidebar').style.display = 'none';
      }
      if (activeItemEl) activeItemEl.classList.remove('active');
      el.classList.add('active');
      activeItemEl = el;
      document.querySelector('.main').classList.add('has-selection');
      document.getElementById('detail').scrollTop = 0;
      renderDetail(match);
      history.replaceState({ itemIndex: DATA.indexOf(match) }, '');
      break;
    }
  }
})();

// Estado base en el historial: impide que el primer "atrás" salga de la app
history.replaceState({ base: true }, "");

/* ── BACK BUTTON ────────────────────────────────────────── */
window.addEventListener("popstate", (e) => {
  if (activeItemEl) {
    // Detener TTS si estaba leyendo
    if (isSpeaking) { window.speechSynthesis.cancel(); isSpeaking = false; }
    // Restaurar sidebar en mobile
    document.querySelector(".sidebar").style.display = "";
    // Volver al listado
    activeItemEl.classList.remove("active");
    activeItemEl = null;
    currentDetail = null;
    document.querySelector(".main").classList.remove("has-selection");
    document.getElementById("detail").innerHTML = emptyState();
    // Dejar el estado base listo para el próximo "atrás"
    history.replaceState({ base: true }, "");
  }
  // Si no hay ítem seleccionado, el navegador sale de la app de forma nativa
});

/* ══════════════════════════════════════════════════════════
   LIGHTBOX v2 — zoom + pan correcto
   ══════════════════════════════════════════════════════════ */
(function () {
  const overlay = document.getElementById('lb-overlay');
  const img     = document.getElementById('lb-img');
  const btnClose= document.getElementById('lb-close');
  const badge   = document.getElementById('lb-badge');

  /* La imagen siempre está centrada con:
     transform: translate(-50%,-50%) translate(panX px, panY px) scale(zoom)
     panX/panY son desplazamientos en px desde el centro. */

  let zoom = 1, minZoom = 1, maxZoom = 6;
  let panX = 0, panY = 0;
  let vpW = 0, vpH = 0;
  let natW = 0, natH = 0;  // tamaño natural de la imagen
  let dispW = 0, dispH = 0; // tamaño desplegado (fit-to-screen)

  function applyTransform(animated) {
    img.style.transition = animated ? 'transform 0.22s ease' : 'none';
    img.style.transform = `translate(-50%,-50%) translate(${panX}px,${panY}px) scale(${zoom})`;
  }

  function clampPan() {
    // Tamaño visual real = tamaño natural × zoom (zoom ya incluye el fit inicial)
    const scaledW = natW * zoom;
    const scaledH = natH * zoom;
    const limitX = Math.max(0, (scaledW - vpW) / 2);
    const limitY = Math.max(0, (scaledH - vpH) / 2);
    panX = Math.max(-limitX, Math.min(limitX, panX));
    panY = Math.max(-limitY, Math.min(limitY, panY));
  }

  function showBadge() {
    badge.textContent = Math.round(zoom * 100) + '%';
    badge.style.opacity = '1';
    clearTimeout(badge._t);
    badge._t = setTimeout(() => { badge.style.opacity = '0'; }, 1400);
  }

  function resetView(animated) {
    zoom = minZoom; panX = 0; panY = 0;
    applyTransform(animated);
  }

  /* zoom hacia/desde un punto (cx,cy) = coordenadas relativas al CENTRO del viewport */
  function zoomAt(cx, cy, factor) {
    const newZoom = Math.max(minZoom, Math.min(maxZoom, zoom * factor));
    if (newZoom === zoom) return;
    const ratio = newZoom / zoom;
    panX = cx + ratio * (panX - cx);
    panY = cy + ratio * (panY - cy);
    zoom = newZoom;
    clampPan();
    applyTransform(false);
    showBadge();
    if (zoom <= minZoom * 1.01) resetView(true);
  }

  /* ── Abrir ── */
  function open(src) {
    img.style.transition = 'none';
    img.style.transform  = 'translate(-50%,-50%) scale(1)';
    img.src = '';
    overlay.classList.add('open');
    document.body.style.overflow = 'hidden';

    const tmp = new Image();
    tmp.onload = () => {
      vpW  = overlay.clientWidth;
      vpH  = overlay.clientHeight;
      natW = tmp.naturalWidth;
      natH = tmp.naturalHeight;

      // Calcular tamaño desplegado (fit dentro del viewport)
      const scaleToFit = Math.min(vpW / natW, vpH / natH, 1);
      dispW = natW * scaleToFit;
      dispH = natH * scaleToFit;

      // Asignar tamaño explícito a la imagen
      img.style.width  = natW + 'px';
      img.style.height = natH + 'px';

      minZoom = scaleToFit;
      zoom    = scaleToFit;
      panX    = 0; panY = 0;

      img.src = src;
      applyTransform(false);
    };
    tmp.src = src;
  }

  function close() {
    overlay.classList.remove('open');
    img.src = '';
    document.body.style.overflow = '';
  }

  btnClose.addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && overlay.classList.contains('open')) close();
  });

  /* ══ MOUSE ══ */
  let mDrag = false, mSX, mSY, mPX, mPY;

  img.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    mDrag = true; mSX = e.clientX; mSY = e.clientY; mPX = panX; mPY = panY;
    img.classList.add('grabbing');
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!mDrag) return;
    panX = mPX + e.clientX - mSX;
    panY = mPY + e.clientY - mSY;
    clampPan();
    applyTransform(false);
  });
  window.addEventListener('mouseup', () => { mDrag = false; img.classList.remove('grabbing'); });

  overlay.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = overlay.getBoundingClientRect();
    const cx = e.clientX - rect.left - vpW / 2;
    const cy = e.clientY - rect.top  - vpH / 2;
    zoomAt(cx, cy, e.deltaY < 0 ? 1.12 : 0.89);
  }, { passive: false });

  /* ══ TOUCH ══ */
  let t1 = null, t2 = null;
  let tPX, tPY, tStartX, tStartY;
  let pinchDist0, pinchZoom0, pinchPX0, pinchPY0, pinchMidX0, pinchMidY0;
  let lastTap = 0, lastTapX = 0, lastTapY = 0;

  function ptDist(a, b) {
    return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
  }
  function ptMid(a, b, rect) {
    return {
      x: (a.clientX + b.clientX) / 2 - rect.left - vpW / 2,
      y: (a.clientY + b.clientY) / 2 - rect.top  - vpH / 2
    };
  }

  overlay.addEventListener('touchstart', e => {
    e.preventDefault();
    const touches = e.touches;

    if (touches.length === 1) {
      t1 = touches[0]; t2 = null;
      tStartX = t1.clientX; tStartY = t1.clientY;
      tPX = panX; tPY = panY;

      // Doble tap
      const now = Date.now();
      const dx = t1.clientX - lastTapX, dy = t1.clientY - lastTapY;
      if (now - lastTap < 280 && Math.hypot(dx, dy) < 50) {
        lastTap = 0;
        const rect = overlay.getBoundingClientRect();
        const cx = t1.clientX - rect.left - vpW / 2;
        const cy = t1.clientY - rect.top  - vpH / 2;
        if (zoom > minZoom * 1.15) {
          resetView(true); showBadge();
        } else {
          const target = Math.min(maxZoom, minZoom * 3);
          const ratio  = target / zoom;
          panX = cx + ratio * (panX - cx);
          panY = cy + ratio * (panY - cy);
          zoom = target;
          clampPan();
          applyTransform(true);
          showBadge();
        }
      } else {
        lastTap = now; lastTapX = t1.clientX; lastTapY = t1.clientY;
      }
    }

    if (touches.length === 2) {
      t1 = touches[0]; t2 = touches[1];
      const rect = overlay.getBoundingClientRect();
      pinchDist0  = ptDist(t1, t2);
      pinchZoom0  = zoom;
      pinchPX0    = panX;
      pinchPY0    = panY;
      const mid   = ptMid(t1, t2, rect);
      pinchMidX0  = mid.x;
      pinchMidY0  = mid.y;
    }
  }, { passive: false });

  overlay.addEventListener('touchmove', e => {
    e.preventDefault();
    const touches = e.touches;

    if (touches.length === 1 && !t2) {
      // Pan — sólo cuando hay zoom activo
      if (zoom > minZoom * 1.02) {
        panX = tPX + touches[0].clientX - tStartX;
        panY = tPY + touches[0].clientY - tStartY;
        clampPan();
        applyTransform(false);
      }
    }

    if (touches.length === 2) {
      t1 = touches[0]; t2 = touches[1];
      const rect  = overlay.getBoundingClientRect();
      const dist  = ptDist(t1, t2);
      const mid   = ptMid(t1, t2, rect);
      const factor= dist / pinchDist0;
      const newZoom = Math.max(minZoom, Math.min(maxZoom, pinchZoom0 * factor));
      const ratio   = newZoom / pinchZoom0;
      panX = pinchMidX0 + ratio * (pinchPX0 - pinchMidX0);
      panY = pinchMidY0 + ratio * (pinchPY0 - pinchMidY0);
      // Seguir el desplazamiento del punto medio
      panX += mid.x - pinchMidX0;
      panY += mid.y - pinchMidY0;
      zoom = newZoom;
      clampPan();
      applyTransform(false);
      showBadge();
    }
  }, { passive: false });

  overlay.addEventListener('touchend', e => {
    const touches = e.touches;
    if (touches.length < 2) { t2 = null; }
    if (touches.length === 1) {
      t1 = touches[0];
      tStartX = t1.clientX; tStartY = t1.clientY; tPX = panX; tPY = panY;
    }
    if (touches.length === 0) {
      t1 = null;
      if (zoom < minZoom * 1.05) resetView(true);
    }
  }, { passive: false });

  /* ── Delegación: click en img dentro de .map-container ── */
  document.getElementById('detail').addEventListener('click', e => {
    const mapImg = e.target.closest('.map-container img');
    if (mapImg && mapImg.complete && mapImg.naturalWidth > 0) {
      open(mapImg.src);
    }
  });

})();
