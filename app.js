// ── State ───────────────────────────────────────────────────
const state = {
  filter: 'ALL',
  search: '',
  selected: null,
  favs: new Set(JSON.parse(localStorage.getItem('favs') || '[]')),
  visited: new Set(JSON.parse(localStorage.getItem('visited') || '[]')),
  filterFav: false,
  filterVis: false,
};

// ── Helpers ─────────────────────────────────────────────────
function saveFavs() { localStorage.setItem('favs', JSON.stringify([...state.favs])); }
function saveVisited() { localStorage.setItem('visited', JSON.stringify([...state.visited])); }

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

function getFiltered() {
  let list = DATA;
  if (state.search.trim()) {
    const q = state.search.trim().toLowerCase();
    list = list.filter(d =>
      (d.nombre||'').toLowerCase().includes(q) ||
      (d.prov||'').toLowerCase().includes(q) ||
      (d.tipo||'').toLowerCase().includes(q) ||
      (d.obs||'').toLowerCase().includes(q)
    );
  } else {
    if (state.filter !== 'ALL') list = list.filter(d => d.tipo === state.filter);
    if (state.filterFav) list = list.filter(d => state.favs.has(d.nombre));
    if (state.filterVis) list = list.filter(d => state.visited.has(d.nombre));
  }
  return list;
}

function tipoColor(tipo) { return TIPO_COLORS[tipo] || '#333'; }
function tipoLabel(tipo) {
  const map = { 'RUTA ESCÉNICA':'Rutas Escénicas', 'QUEBRADA':'Quebradas', 'CUESTA':'Cuestas', 'ABRA':'Abras' };
  return map[tipo] || tipo;
}

// ── Render list ──────────────────────────────────────────────
function renderList() {
  const list = getFiltered();
  const panel = document.querySelector('.list-panel');
  const countEl = panel.querySelector('.list-count');
  const scrollEl = panel.querySelector('.list-scroll');

  countEl.textContent = `${list.length} resultado${list.length !== 1 ? 's' : ''}`;
  scrollEl.innerHTML = list.map(d => {
    const isFav = state.favs.has(d.nombre);
    const isVis = state.visited.has(d.nombre);
    const isSel = state.selected === d.nombre;
    const col = tipoColor(d.tipo);
    return `<div class="list-item${isSel?' selected':''}" data-nombre="${esc(d.nombre)}" data-tipo="${esc(d.tipo)}">
      <div class="list-item-tipo" style="color:${col}80">${d.tipo}</div>
      <div class="list-item-nombre">${esc(d.nombre)}</div>
      <div class="list-item-sub">${esc(d.prov||'')}${d.alt ? ' · ' + d.alt + ' msnm' : ''}</div>
      <div class="list-item-badges">
        ${isFav ? '<span class="badge">⭐</span>' : ''}
        ${isVis ? '<span class="badge">✓</span>' : ''}
      </div>
    </div>`;
  }).join('');

  scrollEl.querySelectorAll('.list-item').forEach(el => {
    el.addEventListener('click', () => {
      const nombre = el.dataset.nombre;
      const tipo = el.dataset.tipo;
      const d = DATA.find(x => x.nombre === nombre && x.tipo === tipo);
      if (!d) return;
      state.selected = d.nombre;
      renderList();
      renderDetail(d);
      el.scrollIntoView({ block: 'nearest' });
    });
  });
}

// ── Render detail ────────────────────────────────────────────
function renderDetail(d) {
  const panel = document.querySelector('.detail-panel');
  if (!d) { panel.innerHTML = '<div class="detail-empty">Seleccioná una ruta para ver sus detalles</div>'; return; }

  const isFav = state.favs.has(d.nombre);
  const isVis = state.visited.has(d.nombre);
  const col = tipoColor(d.tipo);
  const desc = TIPO_DESCS[d.tipo] || '';
  const tLabel = tipoLabel(d.tipo);

  // Build content sections
  let html = `<div class="detail-inner">`;

  // Header
  html += `<div class="detail-tipo-badge" style="background:${col}22;color:${col}cc">${d.tipo}</div>`;
  html += `<div class="detail-nombre">${esc(d.nombre)}</div>`;
  if (d.prov) html += `<div class="detail-prov">${esc(d.prov)}</div>`;

  // Fav / Visited
  html += `<div class="fav-vis-row">
    <button class="fav-btn${isFav?' active':''}" onclick="toggleFav('${esc(d.nombre)}')">
      ${isFav?'⭐ Favorito':'☆ Agregar a favoritos'}
    </button>
    <button class="vis-btn${isVis?' active':''}" onclick="toggleVis('${esc(d.nombre)}')">
      ${isVis?'✓ Visitado':'○ Marcar como visitado'}
    </button>
  </div>`;

  // Stats
  html += `<div class="stats-grid">`;
  if (d.alt) html += `<div class="stat-box"><div class="stat-label">Altitud</div><div class="stat-val">${d.alt}</div><div class="stat-sub">msnm</div></div>`;
  if (d.ruta) html += `<div class="stat-box"><div class="stat-label">Ruta</div><div class="stat-val" style="font-size:11px">${esc(d.ruta)}</div></div>`;
  if (d.sup) html += `<div class="stat-box"><div class="stat-label">Superficie</div><div class="stat-val" style="font-size:11px">${esc(d.sup)}</div></div>`;
  if (d.dif) html += `<div class="stat-box"><div class="stat-label">Dificultad</div><div class="stat-val" style="font-size:11px">${esc(d.dif)}</div></div>`;
  html += `</div>`;

  // Maps buttons
  const mapSrcJs = d.mapSrc ? `'${d.mapSrc.replace(/'/g,"\\\'")}'` : 'null';
  html += `<div class="map-btns-row">`;
  if (d.mapNoDisp) {
    html += `<div class="gmaps-btn gmaps-nodisp">📍 Ruta no disponible en Google Maps</div>`;
  } else {
    html += `<button class="gmaps-btn" onclick="openMaps('${esc(d.nombre)}','${esc(d.prov||'')}','${esc(d.tipo)}',${mapSrcJs})">` +
      `<svg width="15" height="15" viewBox="0 0 48 48"><path d="M24 4C16.27 4 10 10.27 10 18c0 10.5 14 26 14 26s14-15.5 14-26c0-7.73-6.27-14-14-14z" fill="#EA4335"/><circle cx="24" cy="18" r="5" fill="#fff"/></svg>` +
      `Ver en Google Maps</button>`;
    if (d.wazeSrc) {
      html += `<a class="waze-btn" href="${d.wazeSrc}" target="_blank" rel="noopener">` +
        `<svg width="15" height="15" viewBox="0 0 64 64"><circle cx="32" cy="32" r="30" fill="#33ccff" opacity="0.3"/><ellipse cx="32" cy="36" rx="18" ry="14" fill="#33ccff"/><circle cx="24" cy="46" r="4" fill="#0a0a0a"/><circle cx="40" cy="46" r="4" fill="#0a0a0a"/><path d="M24 28 Q32 20 40 28" stroke="#0a0a0a" stroke-width="2.5" fill="none" stroke-linecap="round"/><circle cx="26" cy="30" r="2" fill="#0a0a0a"/><circle cx="38" cy="30" r="2" fill="#0a0a0a"/></svg>` +
        `Ver en Waze</a>`;
    }
  }
  html += `</div>`;

  // Observaciones
  if (d.obs) {
    html += `<div class="obs-block"><div class="sec-title">Recorrido</div><div class="obs-text">${esc(d.obs)}</div></div>`;
  }

  // Fotos
  if (!d.noPhotos && (d.foto1 || d.foto2)) {
    const onecol = !d.foto2 || !d.foto1;
    html += `<div class="foto-grid${onecol?' one-col':''}">`;
    if (d.foto1) html += `<img class="foto-img" src="fotos/${d.foto1}" alt="" onclick="openLightbox('fotos/${d.foto1}')">`;
    if (d.foto2) html += `<img class="foto-img" src="fotos/${d.foto2}" alt="" onclick="openLightbox('fotos/${d.foto2}')">`;
    html += `</div>`;
  }

  // Mejor época — TASK 1: icon on label, not in description text
  if (d.epoca) {
    html += `<div class="info-box">
      <div class="info-box-label"><span class="lbl-icon">📅</span>MEJOR ÉPOCA</div>
      <div class="info-box-text">${esc(d.epoca)}</div>
    </div>`;
  }

  // Precauciones — TASK 2: icon on label, not in description text
  if (d.prec) {
    html += `<div class="info-box">
      <div class="info-box-label"><span class="lbl-icon">⚠️</span>PRECAUCIONES</div>
      <div class="info-box-text">${esc(d.prec)}</div>
    </div>`;
  }

  // Iconos de advertencia
  const iconos = [d.icono, d.icono2, d.icono3, d.icono4].filter(Boolean);
  if (iconos.length) {
    html += `<div class="iconos-row">`;
    iconos.forEach(ic => { html += `<img class="icono-img" src="iconos/${ic}" alt="" title="${ic}">` });
    html += `</div>`;
  }

  // Mapa imagen
  if (d.mapImg) {
    html += `<div class="map-img-block"><div class="sec-title">Mapa</div>
      <img class="map-img" src="mapas/${d.mapImg}" alt="Mapa" onclick="openLightbox('mapas/${d.mapImg}')">
    </div>`;
  }
  if (d.mapImg2) {
    html += `<div class="map-img-block">
      <img class="map-img" src="mapas/${d.mapImg2}" alt="Mapa" onclick="openLightbox('mapas/${d.mapImg2}')">
    </div>`;
  }

  // Parque Nacional
  if (d.iconopn || d.pnDesc) {
    html += `<div class="pn-block">`;
    if (d.iconopn) html += `<img class="pn-icon" src="iconos/${d.iconopn}" alt="Parque Nacional">`;
    if (d.pnDesc) html += `<p class="pn-desc">${esc(d.pnDesc)}</p>`;
    html += `</div>`;
  }

  // PN Actividades (iconos 1-4)
  const pnIcos = [d.iconoPn1, d.iconoPn2, d.iconoPn3, d.iconoPn4].filter(Boolean);
  if (pnIcos.length) {
    html += `<div class="pn-icons-section"><div class="sec-title pn-section-title">Actividades en el Parque</div>`;
    html += `<div class="stats-grid pn-icons-grid">`;
    pnIcos.forEach(ic => { html += `<div class="stat-box icon-stat"><img src="iconos/${ic}" class="stat-ruta-icon" alt=""></div>`; });
    html += `</div></div>`;
  }

  // PN Seguridad (iconos 5-8)
  const pnSec = [d.iconoPn5, d.iconoPn6, d.iconoPn7, d.iconoPn8].filter(Boolean);
  if (pnSec.length) {
    html += `<div class="pn-icons-section"><div class="sec-title pn-section-title">Recomendaciones de Seguridad</div>`;
    html += `<div class="stats-grid pn-icons-grid">`;
    pnSec.forEach(ic => { html += `<div class="stat-box icon-stat"><img src="iconos/${ic}" class="stat-ruta-icon" alt=""></div>`; });
    html += `</div></div>`;
  }

  // PN Contacto
  if (d.telPn || d.mailPn) {
    html += `<div class="pn-contact-row">`;
    if (d.telPn) html += `<a class="pn-contact-btn" href="tel:${d.telPn}">📞 ${d.telPn}</a>`;
    if (d.mailPn) html += `<a class="pn-contact-btn" href="mailto:${d.mailPn}">✉ ${d.mailPn}</a>`;
    html += `</div>`;
  }

  // Lugares de interés
  const lugares = [
    {f: d.liF1, t: d.liT1}, {f: d.liF2, t: d.liT2}, {f: d.liF3, t: d.liT3}
  ].filter(l => l.f || l.t);
  if (lugares.length) {
    html += `<div class="lugares-section"><div class="sec-title">Lugares de Interés</div>`;
    lugares.forEach(l => {
      html += `<div class="lugar-item">`;
      if (l.f) html += `<img class="lugar-img" src="fotos/${l.f}" alt="" onclick="openLightbox('fotos/${l.f}')">`;
      if (l.t) html += `<div class="lugar-caption">${esc(l.t)}</div>`;
      html += `</div>`;
    });
    html += `</div>`;
  }

  // Ícono master (ruta)
  if (d.iconoMaster) {
    html += `<div class="icono-master-block"><img class="icono-master-img" src="iconos/${d.iconoMaster}" alt="Ruta"></div>`;
  }

  // Fiestas y Eventos — TASK 3: font-size +1pt
  if (d.fiestas) {
    html += `<div class="fiestas-box">
      <div class="fiestas-label">🎉 FIESTAS Y EVENTOS</div>
      <div class="fiestas-text">${esc(d.fiestas)}</div>
    </div>`;
  }

  // Google Maps embed
  if (d.mapSrc) {
    html += `<div class="maps-embed-block"><div class="sec-title">Mapa Interactivo</div>
      <iframe src="${d.mapSrc}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>
    </div>`;
  }

  // Weather
  const weathers = [
    {url: d.weatherUrl, label: d.weatherLabel},
    {url: d.weatherUrl2, label: d.weatherLabel2},
    {url: d.weatherUrl3, label: d.weatherLabel3},
  ].filter(w => w.url);
  if (weathers.length) {
    html += `<div class="weather-row"><div class="sec-title" style="width:100%;margin-bottom:2px">Clima</div>`;
    weathers.forEach(w => {
      html += `<a class="weather-btn" href="${w.url}" target="_blank" rel="noopener">🌤 ${esc(w.label||'Ver clima')}</a>`;
    });
    html += `</div>`;
    if (d.iconoPf) {
      html += `<div style="text-align:center;margin-bottom:8px"><img src="iconos/${d.iconoPf}" style="height:28px;object-fit:contain" alt=""></div>`;
    }
  }

  // Paso fronterizo
  if (d.pasoPf) {
    html += `<div class="paso-block">
      <div class="paso-title">Paso Fronterizo Cercano</div>
      <div class="paso-nombre">${esc(d.pasoPf)}</div>
      ${d.horarioPf ? `<div class="paso-horario">${esc(d.horarioPf)}</div>` : ''}
      ${d.urlPf ? `<a class="paso-link" href="${esc(d.urlPf)}" target="_blank" rel="noopener">Estado actual del paso ↗</a>` : ''}
    </div>`;
  }

  // Acerca de
  if (desc) {
    html += `<div class="desc-block"><div class="sec-title">Acerca de las ${tLabel}</div><p class="desc-txt">${esc(desc)}</p></div>`;
  }

  html += `</div>`;
  panel.innerHTML = html;
  panel.scrollTop = 0;
}

// ── Actions ──────────────────────────────────────────────────
function toggleFav(nombre) {
  if (state.favs.has(nombre)) state.favs.delete(nombre);
  else state.favs.add(nombre);
  saveFavs();
  const d = DATA.find(x => x.nombre === nombre);
  if (d) renderDetail(d);
  renderList();
}
function toggleVis(nombre) {
  if (state.visited.has(nombre)) state.visited.delete(nombre);
  else state.visited.add(nombre);
  saveVisited();
  const d = DATA.find(x => x.nombre === nombre);
  if (d) renderDetail(d);
  renderList();
}

function openLightbox(src) {
  const lb = document.createElement('div');
  lb.className = 'lightbox';
  lb.innerHTML = `<img src="${src}" alt="">`;
  lb.addEventListener('click', () => lb.remove());
  document.body.appendChild(lb);
}

function openMaps(nombre, prov, tipo, mapSrc) {
  const modal = document.createElement('div');
  modal.className = 'maps-modal';
  const iframeHtml = mapSrc
    ? `<iframe class="maps-modal-iframe" src="${mapSrc}" allowfullscreen loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe>`
    : `<p style="opacity:0.5;font-size:13px;text-align:center;padding:30px">Mapa no disponible</p>`;
  modal.innerHTML = `<div class="maps-modal-inner">
    <div class="maps-modal-title">
      <span>${nombre}</span>
      <button class="maps-modal-close" onclick="this.closest('.maps-modal').remove()">✕</button>
    </div>
    ${iframeHtml}
  </div>`;
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

// ── Render app ────────────────────────────────────────────────
function renderApp() {
  const tipos = ['ALL', 'RUTA ESCÉNICA', 'QUEBRADA', 'CUESTA', 'ABRA'];
  const tipoNames = { ALL:'Todas', 'RUTA ESCÉNICA':'Rutas', QUEBRADA:'Quebradas', CUESTA:'Cuestas', ABRA:'Abras' };

  document.getElementById('app').innerHTML = `
    <div class="app-header">
      <div class="app-title">De Cuestas, Valles y Quebradas</div>
      <div class="search-bar">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <input id="search-input" type="text" placeholder="Buscar ruta, provincia…" autocomplete="off">
      </div>
    </div>
    <div class="toolbar">
      ${tipos.map(t => `<button class="tb-btn${state.filter===t&&!state.filterFav&&!state.filterVis?' active':''}" data-tipo="${t}">${tipoNames[t]}</button>`).join('')}
      <button class="tb-btn${state.filterFav?' fav-active':''}" id="btn-fav">⭐ Favoritos</button>
      <button class="tb-btn${state.filterVis?' vis-active':''}" id="btn-vis">✓ Visitados</button>
    </div>
    <div class="main-layout">
      <div class="list-panel">
        <div class="list-count"></div>
        <div class="list-scroll"></div>
      </div>
      <div class="detail-panel">
        <div class="detail-empty">Seleccioná una ruta para ver sus detalles</div>
      </div>
    </div>
  `;

  // Toolbar tipo buttons
  document.querySelectorAll('.tb-btn[data-tipo]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.filter = btn.dataset.tipo;
      state.filterFav = false;
      state.filterVis = false;
      state.search = '';
      document.getElementById('search-input').value = '';
      renderList();
      document.querySelectorAll('.tb-btn[data-tipo]').forEach(b => b.classList.toggle('active', b.dataset.tipo === state.filter));
      document.getElementById('btn-fav').classList.remove('fav-active');
      document.getElementById('btn-vis').classList.remove('vis-active');
    });
  });

  document.getElementById('btn-fav').addEventListener('click', () => {
    state.filterFav = !state.filterFav;
    state.filterVis = false;
    state.search = '';
    document.getElementById('search-input').value = '';
    renderList();
    document.getElementById('btn-fav').classList.toggle('fav-active', state.filterFav);
    document.getElementById('btn-vis').classList.remove('vis-active');
  });

  document.getElementById('btn-vis').addEventListener('click', () => {
    state.filterVis = !state.filterVis;
    state.filterFav = false;
    state.search = '';
    document.getElementById('search-input').value = '';
    renderList();
    document.getElementById('btn-vis').classList.toggle('vis-active', state.filterVis);
    document.getElementById('btn-fav').classList.remove('fav-active');
  });

  document.getElementById('search-input').addEventListener('input', e => {
    state.search = e.target.value;
    renderList();
  });

  renderList();
}

renderApp();
