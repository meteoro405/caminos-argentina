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
  renderList();
  document.getElementById("detail").innerHTML = emptyState(); document.querySelector(".main").classList.remove("has-selection");
}

function filterSpecial(f, btn) {
  activeFilter = f;
  document.querySelectorAll(".filter-special").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
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
    const icons = (isFav?'<span class="ri-icon fav-icon">♥</span>':"")+(isDone?'<span class="ri-icon done-icon">✓</span>':"");

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

  det.innerHTML =
    `<div class="hero-accent-bar" style="background:${color}"></div>` +
    `<div class="hero-band">` +
      `<div class="hero-accent" style="color:${color}">${d.tipo}</div>` +
      `<div class="hero-title-row">` +
        `<div class="hero-title">${d.nombre}</div>` +
        `<div class="hero-actions">` +
          `<button class="action-btn fav-btn${isFav?" active":""}" onclick="toggleFav(currentDetail)">♥ <span class="action-label">Favorito</span></button>` +
          `<button class="action-btn done-btn${isDone?" active":""}" onclick="toggleDone(currentDetail)">✓ <span class="action-label">Visitado</span></button>` +
        `</div>` +
      `</div>` +
      `<div class="hero-loc">◈ ${d.prov}${d.ruta?" · "+d.ruta:""}</div>` +
    `</div>` +

    // Stats
    `<div class="stats-grid">` +
      `<div class="stat"><span class="stat-val">${altStr}</span><span class="stat-key">Altitud máx.</span></div>` +
      `<div class="stat"><span class="stat-val" style="color:${difColor}">${d.dif}</span><span class="stat-key">Dificultad</span></div>` +
      `<div class="stat"><span class="stat-val" style="color:${supColor}">${d.sup}</span><span class="stat-key">Superficie</span></div>` +
      `<div class="stat"><span class="stat-val">${d.ruta||"—"}</span><span class="stat-key">Ruta</span></div>` +
    `</div>` +

    // Observaciones — TTS button inline at right
    (d.obs ? `<div class="obs-block obs-above-map"><div class="sec-title">Observaciones</div>` +
      `<div class="obs-row">` +
        `<span class="obs-tag ${obsClass}">${d.warn?"⚠ ":""}${d.obs}</span>` +
        `<button class="tts-btn" onclick="speakObs('${obsEscJs}',this)" title="Escuchar">` +
          `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">` +
            `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>` +
            `<path d="M15.54 8.46a5 5 0 0 1 0 7.07"/>` +
            `<path d="M19.07 4.93a10 10 0 0 1 0 14.14" class="tts-wave2"/>` +
          `</svg>` +
          `<span class="tts-label">Escuchar</span>` +
        `</button>` +
      `</div></div>` : "") +

    // Mapa
    `<div class="map-section"><div class="sec-title">Mapa</div>` +
      `<div class="map-btns-row">` +
        (d.mapNoDisp
          ? `<div class="gmaps-btn gmaps-nodisp">📍 Ruta no disponible en Google Maps</div>`
          : `<button class="gmaps-btn" onclick="openMaps('${esc(d.nombre)}','${esc(d.prov)}','${esc(d.tipo)}',${mapSrcJs})">` +
              `<svg width="15" height="15" viewBox="0 0 48 48"><path d="M24 4C16.27 4 10 10.27 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.73-6.27-14-14-14z" fill="#EA4335"/><circle cx="24" cy="18" r="5" fill="#fff"/></svg>` +
              `Ver en Google Maps</button>`
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

    // Ícono Parque Nacional
    (d.iconopn ? `<div class="pn-icon-box"><img src="iconos/${d.iconopn}" class="pn-icon" alt="Parque Nacional"></div>` : ``) +

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
   LIGHTBOX — visor de mapas con zoom y pan
   ══════════════════════════════════════════════════════════ */
(function() {
  const lb      = document.getElementById('imgLightbox');
  const lbImg   = document.getElementById('lb-img');
  const lbCanvas= document.getElementById('lb-canvas');
  const lbBadge = document.getElementById('lb-zoom-badge');
  const lbClose = document.getElementById('lb-close-btn');

  /* ── Estado ── */
  let scale = 1, minScale = 1, maxScale = 5;
  let tx = 0, ty = 0;          // translate actual
  let imgW = 0, imgH = 0;      // tamaño natural de la imagen
  let vpW = 0, vpH = 0;        // tamaño del viewport

  /* ── Helpers ── */
  function applyTransform(animate) {
    if (animate) lbImg.style.transition = 'transform 0.2s ease';
    else         lbImg.style.transition = 'none';
    lbImg.style.transform = `translate(${tx}px,${ty}px) scale(${scale})`;
  }

  function clampTranslate() {
    // límites de pan: no dejar salir la imagen del viewport
    const scaledW = imgW * scale;
    const scaledH = imgH * scale;
    const maxTx = scaledW > vpW ? (scaledW - vpW) / 2 : 0;
    const maxTy = scaledH > vpH ? (scaledH - vpH) / 2 : 0;
    tx = Math.max(-maxTx, Math.min(maxTx, tx));
    ty = Math.max(-maxTy, Math.min(maxTy, ty));
  }

  function showBadge() {
    lbBadge.textContent = Math.round(scale * 100) + '%';
    lbBadge.style.opacity = '1';
    clearTimeout(lbBadge._t);
    lbBadge._t = setTimeout(() => lbBadge.style.opacity = '0', 1200);
  }

  function resetTransform(animate) {
    scale = minScale; tx = 0; ty = 0;
    applyTransform(animate);
  }

  /* ── Abrir / Cerrar ── */
  function openLightbox(src) {
    lbImg.src = src;
    lbImg.onload = () => {
      vpW = lbCanvas.clientWidth;
      vpH = lbCanvas.clientHeight;
      imgW = lbImg.naturalWidth;
      imgH = lbImg.naturalHeight;
      // Escala inicial: encaja la imagen en el viewport
      minScale = Math.min(vpW / imgW, vpH / imgH, 1);
      scale = minScale; tx = 0; ty = 0;
      // Centrar imagen
      lbImg.style.width  = imgW + 'px';
      lbImg.style.height = imgH + 'px';
      lbImg.style.marginLeft = (-imgW / 2) + 'px';
      lbImg.style.marginTop  = (-imgH / 2) + 'px';
      lbImg.style.position   = 'absolute';
      lbImg.style.left = '50%';
      lbImg.style.top  = '50%';
      applyTransform(false);
    };
    lb.classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeLightbox() {
    lb.classList.remove('open');
    lbImg.src = '';
    document.body.style.overflow = '';
  }

  lbClose.addEventListener('click', closeLightbox);
  lb.addEventListener('click', e => { if (e.target === lb || e.target === lbCanvas) closeLightbox(); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && lb.classList.contains('open')) closeLightbox(); });

  /* ══ MOUSE — desktop ══ */
  let mouseDragging = false, mouseStartX, mouseStartY, mouseTx, mouseTy;

  lbImg.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    mouseDragging = true;
    mouseStartX = e.clientX; mouseStartY = e.clientY;
    mouseTx = tx; mouseTy = ty;
    lbImg.classList.add('dragging');
    e.preventDefault();
  });

  window.addEventListener('mousemove', e => {
    if (!mouseDragging) return;
    tx = mouseTx + (e.clientX - mouseStartX);
    ty = mouseTy + (e.clientY - mouseStartY);
    clampTranslate();
    applyTransform(false);
  });

  window.addEventListener('mouseup', () => {
    mouseDragging = false;
    lbImg.classList.remove('dragging');
  });

  // Scroll = zoom centrado en el cursor
  lbCanvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = lbCanvas.getBoundingClientRect();
    const cx = e.clientX - rect.left - rect.width  / 2;
    const cy = e.clientY - rect.top  - rect.height / 2;
    const factor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));
    const ratio = newScale / scale;
    tx = cx - ratio * (cx - tx);
    ty = cy - ratio * (cy - ty);
    scale = newScale;
    clampTranslate();
    applyTransform(false);
    showBadge();
    if (scale <= minScale) resetTransform(true);
  }, { passive: false });

  /* ══ TOUCH — mobile ══ */
  let touches = [];
  let lastPinchDist = 0;
  let panStartX, panStartY, panTx, panTy;
  let lastTapTime = 0, lastTapX, lastTapY;

  function getTouchDist(t) {
    const dx = t[0].clientX - t[1].clientX;
    const dy = t[0].clientY - t[1].clientY;
    return Math.sqrt(dx*dx + dy*dy);
  }
  function getTouchMid(t) {
    return {
      x: (t[0].clientX + t[1].clientX) / 2,
      y: (t[0].clientY + t[1].clientY) / 2
    };
  }

  lbCanvas.addEventListener('touchstart', e => {
    e.preventDefault();
    touches = Array.from(e.touches);

    if (touches.length === 1) {
      // Detectar doble tap
      const now = Date.now();
      const tx1 = touches[0].clientX, ty1 = touches[0].clientY;
      if (now - lastTapTime < 300 && Math.abs(tx1 - lastTapX) < 40 && Math.abs(ty1 - lastTapY) < 40) {
        // Doble tap: toggle zoom
        const rect = lbCanvas.getBoundingClientRect();
        const cx = tx1 - rect.left - rect.width  / 2;
        const cy = ty1 - rect.top  - rect.height / 2;
        if (scale > minScale * 1.1) {
          resetTransform(true);
        } else {
          const targetScale = Math.min(maxScale, minScale * 2.5);
          const ratio = targetScale / scale;
          tx = cx - ratio * (cx - tx);
          ty = cy - ratio * (cy - ty);
          scale = targetScale;
          clampTranslate();
          applyTransform(true);
        }
        showBadge();
        lastTapTime = 0;
        return;
      }
      lastTapTime = now; lastTapX = tx1; lastTapY = ty1;
      // Inicio de pan
      panStartX = touches[0].clientX; panStartY = touches[0].clientY;
      panTx = tx; panTy = ty;
    }

    if (touches.length === 2) {
      lastPinchDist = getTouchDist(touches);
      panTx = tx; panTy = ty;
    }
  }, { passive: false });

  lbCanvas.addEventListener('touchmove', e => {
    e.preventDefault();
    touches = Array.from(e.touches);
    const rect = lbCanvas.getBoundingClientRect();

    if (touches.length === 1 && scale > minScale * 1.01) {
      // Pan con un dedo (solo si hay zoom)
      tx = panTx + (touches[0].clientX - panStartX);
      ty = panTy + (touches[0].clientY - panStartY);
      clampTranslate();
      applyTransform(false);
    }

    if (touches.length === 2) {
      // Pinch zoom
      const dist = getTouchDist(touches);
      const mid  = getTouchMid(touches);
      const cx   = mid.x - rect.left - rect.width  / 2;
      const cy   = mid.y - rect.top  - rect.height / 2;
      const factor = dist / lastPinchDist;
      const newScale = Math.max(minScale, Math.min(maxScale, scale * factor));
      const ratio = newScale / scale;
      tx = cx - ratio * (cx - tx);
      ty = cy - ratio * (cy - ty);
      scale = newScale;
      lastPinchDist = dist;
      clampTranslate();
      applyTransform(false);
      showBadge();
    }
  }, { passive: false });

  lbCanvas.addEventListener('touchend', e => {
    touches = Array.from(e.touches);
    if (touches.length === 0 && scale < minScale * 1.05) {
      resetTransform(true);
    }
    if (touches.length === 1) {
      panStartX = touches[0].clientX; panStartY = touches[0].clientY;
      panTx = tx; panTy = ty;
    }
  }, { passive: false });

  /* ── Delegación: click en cualquier img dentro de .map-container ── */
  document.getElementById('detail').addEventListener('click', e => {
    const img = e.target.closest('.map-container img');
    if (img && img.complete && img.naturalWidth > 0) {
      openLightbox(img.src);
    }
  });

})();
