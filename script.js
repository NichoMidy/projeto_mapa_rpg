let markers = [];

// ----------------------------------
// CONFIGURAÇÃO DO SEU MAPA
// ----------------------------------
const mapWidth = 7200;   // coloque a largura da sua imagem
const mapHeight = 3600;  // coloque a altura da sua imagem
const imageFile = "mapa.png"; // nome da imagem no repositório

const bounds = [[0,0], [mapHeight, mapWidth]];

const map = L.map('map', {
  crs: L.CRS.Simple,
  minZoom: -4
});

const image = L.imageOverlay(imageFile, bounds).addTo(map);
map.fitBounds(bounds);

// -----------------------
// Layers (overlay) system
// -----------------------
// List available layer files (edit this array if you add more layer images)
const AVAILABLE_LAYERS = [
  'layer1.png'
];

const overlays = {}; // name -> L.imageOverlay

function buildLayersUI(){
  const container = document.getElementById('layersList');
  if(!container) return;
  AVAILABLE_LAYERS.forEach((file, idx)=>{
    const name = file.replace(/\.[^/.]+$/, '');
    const id = `layer_chk_${idx}`;

    const row = document.createElement('div');
    row.className = 'layer-item';

    const chk = document.createElement('input');
    chk.type = 'checkbox';
    chk.id = id;
    chk.dataset.file = file;

    const lbl = document.createElement('label');
    lbl.htmlFor = id;
    lbl.textContent = name;

    // opacity control
    const op = document.createElement('input');
    op.type = 'range';
    op.min = 0; op.max = 100; op.value = 100;
    op.className = 'layer-opacity';
    op.title = 'Opacidade';

    row.appendChild(chk);
    row.appendChild(lbl);
    row.appendChild(op);
    container.appendChild(row);

    chk.addEventListener('change', ()=>{
      const file = chk.dataset.file;
      if(chk.checked){
        const overlay = L.imageOverlay(file, bounds, { opacity: op.value/100 }).addTo(map);
        overlays[file] = overlay;
      } else {
        if(overlays[file]){ map.removeLayer(overlays[file]); delete overlays[file]; }
      }
    });

    op.addEventListener('input', ()=>{
      const file = chk.dataset.file;
      if(overlays[file]) overlays[file].setOpacity(op.value/100);
    });
  });
}

// build layers UI after DOM ready
window.addEventListener('load', ()=> buildLayersUI());

// normalize a user-provided link to an absolute URL
function normalizeLink(link){
  if(!link) return "";
  link = String(link).trim();
  if(!link) return "";
  // if it already has a scheme like http:, https:, mailto:, tel:, return as-is
  if(/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(link)) return link;
  // protocol-relative (//example.com) -> assume https
  if(link.startsWith('//')) return 'https:' + link;
  // otherwise assume https
  return 'https://' + link;
}

// Helper to create consistent popup content
function makePopupContent(name, description, link) {
  const href = normalizeLink(link);
  // Structured popup: clickable title when link present, description below
  const title = href ? `<a class="popup-title" href="${href}" target="_blank" rel="noopener noreferrer">${name}</a>` : `<span class="popup-title">${name}</span>`;
  const desc = description ? `<div class="popup-desc">${description}</div>` : '';
  return `<div class="popup-content">${title}${desc}</div>`;
}

// Default pin color
const DEFAULT_PIN_COLOR = '#e74c3c';

// Normalize a color string (hex or name). Returns a CSS-valid color string.
function normalizeColor(c){
  if(!c) return DEFAULT_PIN_COLOR;
  c = String(c).trim();
  if(!c) return DEFAULT_PIN_COLOR;
  // hex like #fff or #ffffff or without #
  const hex = c.replace(/^#/, '');
  if(/^[0-9A-Fa-f]{3}$/.test(hex) || /^[0-9A-Fa-f]{6}$/.test(hex)) return '#' + hex;
  // otherwise return as-is (allow color names, rgb(), etc.)
  return c;
}

// Create an HTML-based icon colored with `color`.
function markerIcon(color){
  return L.divIcon({
    className: 'custom-pin',
    html: `<span class="pin" style="background:${color};"></span>`,
    iconSize: [24, 24],
    iconAnchor: [12, 24],
    popupAnchor: [0, -24]
  });
}

// Create a marker with structured data and handlers
function createMarker(latlng, {name='', description='', link='', color=DEFAULT_PIN_COLOR, draggable=false} = {}){
  const col = normalizeColor(color);
  const href = normalizeLink(link);
  const marker = L.marker(latlng, {draggable:draggable, icon: markerIcon(col)})
    .addTo(map)
    .bindPopup(makePopupContent(name, description, href));

  marker._data = { name, description, link: href, color: col };
  attachMarkerHandlers(marker);
  return marker;
}

// --- Color picker modal integration ---
function setupColorPicker(){
  const modal = document.getElementById('colorPickerModal');
  if(!modal) return;
  // ensure modal is attached to document.body to avoid being clipped by map stacking contexts
  if(modal.parentNode !== document.body) document.body.appendChild(modal);
  // make the modal a full-screen fixed container and force very high z-index
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.zIndex = '2147483646';
  const colorInput = document.getElementById('colorPicker_input_color');
  const hexInput = document.getElementById('colorPicker_input_hex');
  const confirmBtn = document.getElementById('colorPicker_confirm');
  const cancelBtn = document.getElementById('colorPicker_cancel');

  let resolver = null;

  function open(initial, options = {}){
    // options: { popup: boolean, coords: { clientX, clientY } }
    const popupMode = !!options.popup;
    const coords = options.coords || null;
    const init = normalizeColor(initial || DEFAULT_PIN_COLOR);
    colorInput.value = init;
    hexInput.value = init;

    const panel = modal.querySelector('.color-picker-panel');
    const bd = modal.querySelector('.color-picker-backdrop');

    if(popupMode){
      // position panel as fixed popup near coords
      panel.style.position = 'fixed';
      panel.style.zIndex = '2147483647';
      panel.style.transform = 'none';
      panel.style.willChange = 'auto';
      panel.style.pointerEvents = 'auto';
      modal.style.position = 'fixed';
      const cx = coords && (coords.clientX !== undefined) ? coords.clientX : (window.innerWidth / 2);
      const cy = coords && (coords.clientY !== undefined) ? coords.clientY : (window.innerHeight / 2);
      let left = cx + 8;
      let top = cy + 8;
      const rectW = panel.offsetWidth || 320;
      const rectH = panel.offsetHeight || 160;
      const maxLeft = window.innerWidth - rectW - 12;
      const maxTop = window.innerHeight - rectH - 12;
      if(left > maxLeft) left = Math.max(12, cx - rectW - 8);
      if(top > maxTop) top = Math.max(12, cy - rectH - 8);
      panel.style.left = left + 'px';
      panel.style.top = top + 'px';
      // hide backdrop
      if(bd) bd.style.display = 'none';
      modal.style.display = 'block';
      modal.setAttribute('aria-hidden','false');
      // attach outside click to close popup
      setTimeout(()=>{ document.addEventListener('pointerdown', outsideClick); }, 0);
    } else {
      // center modal
      panel.style.position = '';
      panel.style.zIndex = '2147483647';
      panel.style.transform = 'none';
      panel.style.willChange = 'auto';
      panel.style.pointerEvents = 'auto';
      if(bd) bd.style.display = '';
      modal.style.display = 'flex';
      modal.setAttribute('aria-hidden','false');
    }

    colorInput.focus();
    return new Promise((resolve)=>{ resolver = resolve; });
  }

  function close(value){
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
    const bd = modal.querySelector('.color-picker-backdrop'); if(bd) bd.style.display = '';
    if(resolver){ resolver(value); resolver = null; }
    document.removeEventListener('pointerdown', outsideClick);
  }

  function outsideClick(ev){
    if(!modal) return;
    const panel = modal.querySelector('.color-picker-panel');
    if(!panel) return;
    if(panel.contains(ev.target)) return; // click inside
    close(null);
  }

  // sync inputs
  colorInput.addEventListener('input', ()=>{ hexInput.value = colorInput.value; });
  hexInput.addEventListener('input', ()=>{
    const v = hexInput.value.trim();
    if(/^#?[0-9A-Fa-f]{3}$/.test(v) || /^#?[0-9A-Fa-f]{6}$/.test(v)){
      colorInput.value = v.startsWith('#') ? v : '#' + v;
    }
  });

  confirmBtn.addEventListener('click', ()=>{ close(normalizeColor(hexInput.value || colorInput.value)); });
  cancelBtn.addEventListener('click', ()=>{ close(null); });

  // close on backdrop click
  modal.querySelector('.color-picker-backdrop').addEventListener('click', ()=> close(null));

  // keyboard support
  modal.addEventListener('keydown', (ev)=>{
    if(ev.key === 'Escape') close(null);
    if(ev.key === 'Enter') { ev.preventDefault(); close(normalizeColor(hexInput.value || colorInput.value)); }
  });

  // expose
  return { open, close };
}

const ColorPicker = setupColorPicker();

// --- Edit modal integration ---
function setupEditModal(){
  const modal = document.getElementById('editModal');
  if(!modal) return;
  // attach to document.body to avoid being placed behind map due to stacking contexts
  if(modal.parentNode !== document.body) document.body.appendChild(modal);
  // make the modal a full-screen fixed container and force very high z-index
  modal.style.position = 'fixed';
  modal.style.top = '0';
  modal.style.left = '0';
  modal.style.width = '100%';
  modal.style.height = '100%';
  modal.style.zIndex = '2147483648';
  const backdrop = modal.querySelector('.color-picker-backdrop');
  const inputName = document.getElementById('edit_name');
  const inputLink = document.getElementById('edit_link');
  const inputDesc = document.getElementById('edit_description');
  const inputColor = document.getElementById('edit_color');
  const inputColorHex = document.getElementById('edit_color_hex');
  const btnSave = document.getElementById('edit_save');
  const btnDelete = document.getElementById('edit_delete');
  const btnCancel = document.getElementById('edit_cancel');

  let currentMarker = null;
  let createResolver = null;
  let createLatLng = null;

  function open(marker, coords){
    currentMarker = marker;
    const d = marker._data || { name:'', description:'', link:'', color:DEFAULT_PIN_COLOR };
    inputName.value = d.name || '';
    inputDesc.value = d.description || '';
    inputLink.value = d.link || '';
    const col = normalizeColor(d.color || DEFAULT_PIN_COLOR);
    inputColor.value = col;
    inputColorHex.value = col;

    // position panel as a fixed popup near coords (viewport-relative)
    const panel = modal.querySelector('.color-picker-panel');
    panel.style.position = 'fixed';
    panel.style.zIndex = '2147483649';
    panel.style.transform = 'none';
    panel.style.willChange = 'auto';
    panel.style.pointerEvents = 'auto';
    panel.style.maxWidth = '360px';
    // use client coordinates if provided
    const cx = coords && (coords.clientX !== undefined) ? coords.clientX : (window.innerWidth / 2);
    const cy = coords && (coords.clientY !== undefined) ? coords.clientY : (window.innerHeight / 2);

    let left = cx + 8;
    let top = cy + 8;

    // ensure panel stays inside viewport
    const rectW = panel.offsetWidth || 360;
    const rectH = panel.offsetHeight || 240;
    const maxLeft = window.innerWidth - rectW - 12;
    const maxTop = window.innerHeight - rectH - 12;
    if(left > maxLeft) left = Math.max(12, cx - rectW - 8);
    if(top > maxTop) top = Math.max(12, cy - rectH - 8);

    panel.style.left = left + 'px';
    panel.style.top = top + 'px';

    // hide backdrop for popup (we'll close on outside click)
    const bd = modal.querySelector('.color-picker-backdrop');
    if(bd) bd.style.display = 'none';

    modal.style.display = 'block';
    modal.setAttribute('aria-hidden','false');
    inputName.focus();

    // attach outside click listener while open
    setTimeout(()=>{ document.addEventListener('pointerdown', outsideClick); }, 0);
  }

  // open modal as a creation form, positioned near coords. Returns a Promise that resolves
  // to { name, description, link, color } or null if cancelled.
  function openForCreate(latlng, coords){
    createLatLng = latlng;
    // clear fields for creation
    inputName.value = '';
    inputDesc.value = '';
    inputLink.value = '';
    inputColor.value = DEFAULT_PIN_COLOR;
    inputColorHex.value = DEFAULT_PIN_COLOR;

    // hide delete button in create mode
    btnDelete.style.display = 'none';

    modal.style.display = 'block';
    modal.setAttribute('aria-hidden','false');

    // position like popup
    const panel = modal.querySelector('.color-picker-panel');
    panel.style.position = 'fixed';
    const cx = coords && (coords.clientX !== undefined) ? coords.clientX : (window.innerWidth / 2);
    const cy = coords && (coords.clientY !== undefined) ? coords.clientY : (window.innerHeight / 2);
    let left = cx + 8;
    let top = cy + 8;
    const rectW = panel.offsetWidth || 360;
    const rectH = panel.offsetHeight || 240;
    const maxLeft = window.innerWidth - rectW - 12;
    const maxTop = window.innerHeight - rectH - 12;
    if(left > maxLeft) left = Math.max(12, cx - rectW - 8);
    if(top > maxTop) top = Math.max(12, cy - rectH - 8);
    panel.style.left = left + 'px';
    panel.style.top = top + 'px';

    // no backdrop
    const bd = modal.querySelector('.color-picker-backdrop'); if(bd) bd.style.display = 'none';

    // attach outside click to close popup
    setTimeout(()=>{ document.addEventListener('pointerdown', outsideClick); }, 0);

    return new Promise((resolve)=>{ createResolver = resolve; });
  }

  function close(){
    modal.style.display = 'none';
    modal.setAttribute('aria-hidden','true');
    // restore backdrop display
    const bd = modal.querySelector('.color-picker-backdrop'); if(bd) bd.style.display = '';
    currentMarker = null;
    // if there was a pending createResolver, resolve it as cancelled
    if(createResolver){ const r = createResolver; createResolver = null; r(null); }
    document.removeEventListener('pointerdown', outsideClick);
  }

  function outsideClick(ev){
    if(!modal) return;
    const panel = modal.querySelector('.color-picker-panel');
    if(!panel) return;
    if(panel.contains(ev.target)) return; // click inside
    close();
  }

  // sync color inputs
  inputColor.addEventListener('input', ()=>{ inputColorHex.value = inputColor.value; });
  inputColorHex.addEventListener('input', ()=>{ const v = inputColorHex.value.trim(); if(/^#?[0-9A-Fa-f]{3}$/.test(v)||/^#?[0-9A-Fa-f]{6}$/.test(v)) inputColor.value = v.startsWith('#')? v : '#'+v; });

  // Save changes
  btnSave.addEventListener('click', ()=>{
    const name = inputName.value.trim() || 'Pin';
    const description = inputDesc.value.trim() || '';
    const link = inputLink.value.trim() ? normalizeLink(inputLink.value.trim()) : '';
    const color = inputColorHex.value.trim() ? normalizeColor(inputColorHex.value.trim()) : DEFAULT_PIN_COLOR;
    if(currentMarker){
      currentMarker._data = { name, description, link, color };
      currentMarker.setPopupContent(makePopupContent(name, description, link));
      currentMarker.setIcon(markerIcon(color));
      close();
    } else if(createResolver){
      // resolve creation data
      const data = { name, description, link, color, latlng: createLatLng };
      const r = createResolver;
      createResolver = null;
      close();
      r(data);
      // restore delete button visibility
      btnDelete.style.display = '';
    }
  });

  // Delete
  btnDelete.addEventListener('click', ()=>{
    if(currentMarker){
      if(!confirm('Excluir este pino?')) return;
      map.removeLayer(currentMarker);
      markers = markers.filter(m => m !== currentMarker);
      close();
    } else if(createResolver){
      // cancel creation
      const r = createResolver; createResolver = null; close(); r(null);
      btnDelete.style.display = '';
    }
  });

  btnCancel.addEventListener('click', ()=> close());
  backdrop.addEventListener('click', ()=> close());

  // keyboard
  modal.addEventListener('keydown', (ev)=>{ if(ev.key==='Escape') close(); if(ev.key==='Enter') btnSave.click(); });

  return { open, openForCreate };
}

const EditModal = setupEditModal();

function openEditModalForMarker(marker, coords){ if(EditModal) EditModal.open(marker, coords); }

// Attach common handlers to a marker: right-click to edit, keep structured data
function attachMarkerHandlers(marker){
  // right-click to open an edit popup (save, cancel, delete)
  marker.on('contextmenu', (e)=>{
    e.originalEvent.preventDefault();
    const evt = e.originalEvent || e;
    // use client coordinates for fixed positioning (viewport-relative)
    const cx = evt.clientX !== undefined ? evt.clientX : (evt.pageX - window.scrollX);
    const cy = evt.clientY !== undefined ? evt.clientY : (evt.pageY - window.scrollY);
    openEditModalForMarker(marker, { clientX: cx, clientY: cy });
  });

  // ensure marker._data exists after drag (position change)
  marker.on('dragend', ()=>{
    if(!marker._data) marker._data = { name: 'Pin', description: '', link: '' };
  });
}

// ----------------------------------
// BOTÕES
// ----------------------------------
const addPinBtn = document.getElementById("addPinBtn");
const movePinBtn = document.getElementById("movePinBtn");
const saveBtn = document.getElementById("saveBtn");
const toolbar = document.getElementById('toolbar');
const toolbarToggleBtn = document.getElementById('toolbarToggleBtn');
const toolbarControls = document.getElementById('toolbarControls');

let addMode = false;
let moveMode = false;

// Toolbar toggle: start collapsed (buttons hidden) and toggle on button click
if(toolbar){
  // ensure default collapsed state
  toolbar.classList.add('collapsed');
}
if(toolbarToggleBtn){
  toolbarToggleBtn.addEventListener('click', ()=>{
    if(!toolbar) return;
    toolbar.classList.toggle('collapsed');
    const expanded = !toolbar.classList.contains('collapsed');
    toolbarToggleBtn.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  });
}

// ----------------------------------
// CARREGAR PINS
// ----------------------------------
fetch("pins.json")
  .then(r=>r.json())
  .then(data=>{
    data.forEach(pin=>{
        const normalized = normalizeLink(pin.link || "");
        const col = normalizeColor(pin.color || DEFAULT_PIN_COLOR);
        const marker = createMarker([pin.y, pin.x], { name: pin.name, description: pin.description, link: normalized, color: col, draggable: false });
        markers.push(marker);
    });
  });

// delegated handler: ensure clicks on popup links open exact URL in a new tab
document.addEventListener('click', (ev)=>{
  const a = ev.target.closest && ev.target.closest('.leaflet-popup-content a');
  if(!a) return;
  ev.preventDefault();
  const href = a.getAttribute('href');
  if(!href) return;
  window.open(href, '_blank', 'noopener');
});

// ----------------------------------
// BOTÃO ADICIONAR
// ----------------------------------
addPinBtn.onclick = ()=>{
  addMode = !addMode;
  addPinBtn.classList.toggle("active");

  if(addMode){
    moveMode = false;
    movePinBtn.classList.remove("active");
  }
};

// ----------------------------------
// BOTÃO MOVER
// ----------------------------------
movePinBtn.onclick = ()=>{
  moveMode = !moveMode;
  movePinBtn.classList.toggle("active");

  if(moveMode){
    addMode = false;
    addPinBtn.classList.remove("active");
  }

  markers.forEach(m => moveMode ? m.dragging.enable() : m.dragging.disable());
};

// ----------------------------------
// ADICIONAR PIN AO CLICAR NO MAPA
// ----------------------------------
map.on("click", async (e)=>{
  if(!addMode) return;
  // open the edit popup as a creation form near the click (no prompts)
  const evt = e.originalEvent || e;
  const clientX = evt.clientX !== undefined ? evt.clientX : (evt.pageX - window.scrollX);
  const clientY = evt.clientY !== undefined ? evt.clientY : (evt.pageY - window.scrollY);

  const data = await EditModal.openForCreate(e.latlng, { clientX, clientY });
  if(!data) return; // cancelled

  const marker = createMarker(e.latlng, { name: data.name, description: data.description, link: data.link, color: data.color, draggable: moveMode });
  markers.push(marker);
});

// ----------------------------------
// SALVAR: EXPORTA pins.json
// ----------------------------------
saveBtn.onclick = ()=>{
  const data = markers.map(m=>{
    const pos = m.getLatLng();
    // prefer structured data stored on the marker to avoid fragile HTML parsing
    if(m._data){
        return {
          name: m._data.name,
          description: m._data.description,
          link: m._data.link || "",
          color: m._data.color || DEFAULT_PIN_COLOR,
          x: pos.lng,
          y: pos.lat
        };
    }

    // fallback: parse popup HTML if structured data is not available
    const popup = m.getPopup().getContent().split("<br>");
    return {
      name: popup[0].replace("<b>","").replace("</b>",""),
      description: popup[1] || "",
      link: popup[2]?.match(/href="(.*?)"/)?.[1] || "",
      x: pos.lng,
      y: pos.lat
    };
  });

  const blob = new Blob([JSON.stringify(data,null,2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = "pins.json";
  a.click();
};