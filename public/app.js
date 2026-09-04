import { createZip } from './zip.js';

const MAX_BACKGROUNDS = 6;
const LAYERS = ['object', 'name', 'brand', 'partNumber'];
const TEXT_LAYERS = ['name', 'brand', 'partNumber'];
const LABELS = { object: 'object', name: 'item name', brand: 'jenis motor', partNumber: 'part number' };
const FALLBACK_STACK = '"Arial Narrow", Arial, Helvetica, sans-serif';

const el = (id) => document.getElementById(id);
const ui = {
  sku: el('sku'), name: el('name'), brandName: el('brandName'), partNumber: el('partNumber'),
  objectDrop: el('objectDrop'), objectInput: el('objectInput'),
  objectThumb: el('objectThumb'), clearObject: el('clearObject'),
  bgDrop: el('bgDrop'), bgInput: el('bgInput'), bgList: el('bgList'), bgCount: el('bgCount'),
  detailDrop: el('detailDrop'), detailInput: el('detailInput'),
  detailList: el('detailList'), detailCount: el('detailCount'),
  preview: el('preview'), status: el('status'), download: el('download'),
  layerTabs: el('layerTabs'), typography: el('typography'),
  fontFamily: el('fontFamily'), bold: el('bold'), italic: el('italic'),
  color: el('color'), shadow: el('shadow'), alignRow: el('alignRow'), preset: el('preset'),
  fontDrop: el('fontDrop'), fontInput: el('fontInput'),
  fontList: el('fontList'), fontCount: el('fontCount'),
  scale: el('scale'), posX: el('posX'), posY: el('posY'),
  scaleValue: el('scaleValue'), xValue: el('xValue'), yValue: el('yValue'),
  reset: el('reset'), applyAll: el('applyAll'), allLayers: el('allLayers'),
  editingLabel: el('editingLabel'),
  outputSize: el('outputSize'), showText: el('showText'),
};

// Placement is per background, per layer. x/y run -100..100 across the canvas.
const DEFAULTS = {
  object: { scale: 100, x: 0, y: 0 },
  brand: { scale: 100, x: 0, y: -78, font: '', bold: true, italic: false, color: '#ffffff', align: 'center', shadow: true },
  name: { scale: 100, x: 0, y: 58, font: '', bold: true, italic: false, color: '#ffffff', align: 'center', shadow: true },
  partNumber: { scale: 100, x: 0, y: 74, font: '', bold: false, italic: false, color: '#ffffff', align: 'center', shadow: true },
};

// Font pairings the six storefronts use. '' means the system fallback stack.
const PRESETS = {
  scarletparts: { name: { font: 'Anton', italic: true }, secondary: { font: 'Calps', italic: false } },
  motoparts: { name: { font: 'Antonio', italic: false }, secondary: { font: 'Calps', italic: false } },
  precisionbike: { name: { font: 'Antonio', italic: true }, secondary: { font: 'Calps', italic: false } },
  omega: { name: { font: 'Antonio', italic: false }, secondary: { font: 'Calps', italic: false } },
  partzilla: { name: { font: 'Antonio', italic: true }, secondary: { font: 'Calps', italic: false } },
  origin: { name: { font: 'Antonio', italic: false }, secondary: { font: 'Calps', italic: false } },
};

const newTransform = () => Object.fromEntries(LAYERS.map((key) => [key, { ...DEFAULTS[key] }]));

const state = {
  object: null,           // { img, url }
  backgrounds: [],        // { img, url, transform }
  details: [],            // { file, url } — copied into the zip untouched
  active: 0,
  layer: 'object',
  fonts: new Set(),
};

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

/* ---------- fonts ---------- */

const WEIGHTS = {
  thin: 100, extralight: 200, ultralight: 200, light: 300, regular: 400, normal: 400,
  book: 400, medium: 500, semibold: 600, demibold: 600, bold: 700, extrabold: 800,
  ultrabold: 800, black: 900, heavy: 900,
};

// "Calps-BoldItalic.otf" -> family "Calps", weight 700, italic.
function describeFont(filename) {
  const variable = /\[[^\]]*\]/.test(filename);
  const stem = filename.replace(/\.[^.]+$/, '').replace(/\[[^\]]*\]/g, '');
  const tokens = stem.split(/[-_\s]+/).filter(Boolean);

  let weight = variable ? '1 1000' : 400;
  let style = 'normal';
  while (tokens.length > 1) {
    const token = tokens[tokens.length - 1].toLowerCase();
    const withoutItalic = token.replace(/italic|oblique/g, '');
    if (!/italic|oblique/.test(token) && !(token in WEIGHTS)) break;
    if (/italic|oblique/.test(token)) style = 'italic';
    if (withoutItalic in WEIGHTS) weight = WEIGHTS[withoutItalic];
    tokens.pop();
  }
  return { family: tokens.join(' '), weight: String(weight), style };
}

async function loadFonts() {
  let filenames = [];
  try {
    filenames = await (await fetch('api/fonts')).json();
  } catch {
    setStatus('Could not list public/fonts — using system fonts only.');
  }

  const families = new Set();
  await Promise.all(filenames.map(async (filename) => {
    const { family, weight, style } = describeFont(filename);
    try {
      const face = new FontFace(family, `url("fonts/${encodeURIComponent(filename)}")`, { weight, style });
      document.fonts.add(await face.load());
      families.add(family);
    } catch (error) {
      console.warn(`Could not load font ${filename}`, error);
    }
  }));

  // Preset families with no file on disk still appear, greyed, so the choice is visible.
  const referenced = new Set(Object.values(PRESETS).flatMap((p) => [p.name.font, p.secondary.font]));
  const options = [new Option('System sans-serif', '')];
  for (const family of [...families].sort()) options.push(new Option(family, family));
  for (const family of [...referenced].sort()) {
    if (!families.has(family)) {
      const option = new Option(`${family} (file missing)`, family);
      option.dataset.missing = 'true';
      options.push(option);
    }
  }
  ui.fontFamily.replaceChildren(...options);
  state.fonts = families;

  ui.fontCount.textContent = families.size;
  const missing = [...referenced].filter((family) => !families.has(family)).sort();
  ui.fontList.replaceChildren();
  ui.fontList.append([...families].sort().join(', ') || 'No font files yet.');
  if (missing.length) {
    const note = document.createElement('span');
    note.className = 'missing';
    note.textContent = ` — still missing: ${missing.join(', ')}`;
    ui.fontList.append(note);
  }

  syncControls();
  render();
}

const FONT_PATTERN = /\.(ttf|otf|woff2?)$/i;

async function uploadFonts(files) {
  const fonts = files.filter((file) => FONT_PATTERN.test(file.name));
  if (!fonts.length) {
    setStatus('Fonts must be .ttf, .otf, .woff or .woff2 files.');
    return;
  }

  for (const file of fonts) {
    setStatus(`Saving ${file.name}…`);
    const response = await fetch(`api/fonts/${encodeURIComponent(file.name)}`, {
      method: 'PUT',
      body: file,
    });
    if (!response.ok) {
      const { error } = await response.json().catch(() => ({}));
      throw new Error(error || `Could not save ${file.name}`);
    }
  }

  await loadFonts();
  setStatus(`Added ${fonts.map((f) => f.name).join(', ')}.`);
}

/* ---------- loading images ---------- */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error(`Could not read ${file.name}`)); };
    img.src = url;
  });
}

const imageFiles = (list) => Array.from(list).filter((f) => f.type.startsWith('image/'));

async function setObject(file) {
  const loaded = await loadImage(file);
  if (state.object) URL.revokeObjectURL(state.object.url);
  state.object = loaded;
  ui.objectThumb.src = loaded.url;
  ui.objectThumb.hidden = false;
  ui.objectDrop.classList.add('has-image');
  ui.clearObject.hidden = false;
  render();
}

async function addBackgrounds(files) {
  const room = MAX_BACKGROUNDS - state.backgrounds.length;
  if (room <= 0) {
    setStatus(`Already at ${MAX_BACKGROUNDS} backgrounds — remove one first.`);
    return;
  }
  for (const file of files.slice(0, room)) {
    const loaded = await loadImage(file);
    state.backgrounds.push({ ...loaded, transform: newTransform() });
  }
  if (files.length > room) setStatus(`Added ${room} — the ${MAX_BACKGROUNDS} slot limit is full.`);
  state.active = Math.min(state.active, state.backgrounds.length - 1);
  syncBackgrounds();
}

async function addDetails(files) {
  for (const file of files) {
    state.details.push({ file, url: URL.createObjectURL(file) });
  }
  syncDetails();
}

function syncDetails() {
  ui.detailCount.textContent = state.details.length;
  ui.detailList.replaceChildren(...state.details.map((detail, i) => {
    const item = document.createElement('div');
    item.className = 'thumb';
    item.innerHTML = `<img alt=""><span class="index">${i + 1}</span><button class="remove" title="Remove">\u00d7</button>`;
    item.querySelector('img').src = detail.url;
    item.title = detail.file.name;
    item.querySelector('.remove').addEventListener('click', (e) => {
      e.stopPropagation();
      URL.revokeObjectURL(detail.url);
      state.details.splice(i, 1);
      syncDetails();
    });
    return item;
  }));
}

/* ---------- drop zones ---------- */

function wireDrop(zone, input, onFiles, { images = true } = {}) {
  const accept = (list) => (images ? imageFiles(list) : Array.from(list));
  zone.addEventListener('click', () => input.click());
  input.addEventListener('change', () => {
    if (input.files.length) onFiles(accept(input.files));
    input.value = '';
  });
  ['dragenter', 'dragover'].forEach((type) =>
    zone.addEventListener(type, (e) => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((type) =>
    zone.addEventListener(type, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', (e) => {
    const files = accept(e.dataTransfer.files);
    if (files.length) onFiles(files);
  });
}

wireDrop(ui.objectDrop, ui.objectInput, (files) => setObject(files[0]).catch(fail));
wireDrop(ui.bgDrop, ui.bgInput, (files) => addBackgrounds(files).catch(fail));
wireDrop(ui.detailDrop, ui.detailInput, (files) => addDetails(files).catch(fail));
wireDrop(ui.fontDrop, ui.fontInput, (files) => uploadFonts(files).catch(fail), { images: false });

ui.clearObject.addEventListener('click', (e) => {
  e.stopPropagation();
  URL.revokeObjectURL(state.object.url);
  state.object = null;
  ui.objectThumb.hidden = true;
  ui.objectThumb.removeAttribute('src');
  ui.objectDrop.classList.remove('has-image');
  ui.clearObject.hidden = true;
  render();
});

/* ---------- background list ---------- */

function syncBackgrounds() {
  ui.bgCount.textContent = state.backgrounds.length;
  ui.bgList.replaceChildren(...state.backgrounds.map((bg, i) => {
    const item = document.createElement('div');
    item.className = 'thumb' + (i === state.active ? ' active' : '');
    item.innerHTML = `<img alt=""><span class="index">${i + 1}</span><button class="remove" title="Remove">×</button>`;
    item.querySelector('img').src = bg.url;
    item.addEventListener('click', () => { state.active = i; syncBackgrounds(); });
    item.querySelector('.remove').addEventListener('click', (e) => {
      e.stopPropagation();
      URL.revokeObjectURL(bg.url);
      state.backgrounds.splice(i, 1);
      state.active = Math.max(0, Math.min(state.active, state.backgrounds.length - 1));
      syncBackgrounds();
    });
    return item;
  }));
  syncControls();
  render();
}

/* ---------- placement controls ---------- */

const activeBackground = () => state.backgrounds[state.active] ?? null;
const activeLayer = () => activeBackground()?.transform[state.layer] ?? null;

ui.layerTabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.seg');
  if (!tab) return;
  state.layer = tab.dataset.layer;
  syncControls();
});

function syncControls() {
  const layer = activeLayer();
  const disabled = !layer;
  [ui.scale, ui.posX, ui.posY, ui.reset, ui.applyAll, ui.allLayers].forEach((c) => { c.disabled = disabled; });

  for (const tab of ui.layerTabs.querySelectorAll('.seg')) {
    tab.classList.toggle('active', tab.dataset.layer === state.layer);
    tab.disabled = disabled;
  }

  ui.editingLabel.textContent = disabled
    ? 'Add a background to start placing.'
    : `Editing: background ${state.active + 1} of ${state.backgrounds.length}`;

  const value = layer ?? DEFAULTS[state.layer];
  ui.scale.value = value.scale;
  ui.posX.value = value.x;
  ui.posY.value = value.y;
  ui.scaleValue.textContent = `${Math.round(value.scale)}%`;
  ui.xValue.textContent = Math.round(value.x);
  ui.yValue.textContent = Math.round(value.y);

  // Typography belongs to the text layers only.
  const isText = TEXT_LAYERS.includes(state.layer);
  ui.typography.hidden = !isText;
  ui.preset.disabled = disabled;
  if (isText) {
    ui.fontFamily.value = value.font ?? '';
    ui.fontFamily.disabled = disabled;
    ui.bold.disabled = disabled;
    ui.italic.disabled = disabled;
    ui.bold.classList.toggle('on', Boolean(value.bold));
    ui.italic.classList.toggle('on', Boolean(value.italic));
    ui.shadow.classList.toggle('on', value.shadow !== false);
    ui.shadow.disabled = disabled;
    ui.color.value = value.color ?? '#ffffff';
    ui.color.disabled = disabled;
    for (const button of ui.alignRow.querySelectorAll('.align')) {
      button.classList.toggle('on', button.dataset.align === (value.align ?? 'center'));
      button.disabled = disabled;
    }
  }
}

function updateLayer(patch) {
  const layer = activeLayer();
  if (!layer) return;
  Object.assign(layer, patch);
  layer.scale = clamp(layer.scale, 5, 300);
  layer.x = clamp(layer.x, -100, 100);
  layer.y = clamp(layer.y, -100, 100);
  syncControls();
  render();
}

const targetLayers = () => (ui.allLayers.checked ? LAYERS : [state.layer]);

ui.fontFamily.addEventListener('change', () => updateLayer({ font: ui.fontFamily.value }));
ui.bold.addEventListener('click', () => updateLayer({ bold: !activeLayer()?.bold }));
ui.italic.addEventListener('click', () => updateLayer({ italic: !activeLayer()?.italic }));
ui.color.addEventListener('input', () => updateLayer({ color: ui.color.value }));
ui.shadow.addEventListener('click', () => updateLayer({ shadow: activeLayer()?.shadow === false }));
ui.alignRow.addEventListener('click', (e) => {
  const button = e.target.closest('.align');
  if (button) updateLayer({ align: button.dataset.align });
});

ui.preset.addEventListener('change', () => {
  const background = activeBackground();
  const preset = PRESETS[ui.preset.value];
  if (!background || !preset) return;
  Object.assign(background.transform.name, preset.name);
  Object.assign(background.transform.brand, preset.secondary);
  Object.assign(background.transform.partNumber, preset.secondary);
  ui.preset.value = '';
  syncControls();
  render();
  // After render(), which resets the status line.
  const missing = [preset.name.font, preset.secondary.font]
    .filter((family) => family && !state.fonts.has(family));
  setStatus(missing.length
    ? `Preset applied — ${[...new Set(missing)].join(', ')} not in public/fonts, falling back.`
    : `Preset applied to background ${state.active + 1}.`);
});

ui.scale.addEventListener('input', () => updateLayer({ scale: Number(ui.scale.value) }));
ui.posX.addEventListener('input', () => updateLayer({ x: Number(ui.posX.value) }));
ui.posY.addEventListener('input', () => updateLayer({ y: Number(ui.posY.value) }));

ui.reset.addEventListener('click', () => {
  const background = activeBackground();
  if (!background) return;
  for (const key of targetLayers()) background.transform[key] = { ...DEFAULTS[key] };
  syncControls();
  render();
  setStatus(ui.allLayers.checked ? 'All layers reset.' : `The ${LABELS[state.layer]} layer was reset.`);
});

ui.applyAll.addEventListener('click', () => {
  const background = activeBackground();
  if (!background) return;
  const keys = targetLayers();
  for (const other of state.backgrounds) {
    if (other === background) continue;
    for (const key of keys) other.transform[key] = { ...background.transform[key] };
  }
  setStatus(`Applied ${keys.length === 1 ? `the ${LABELS[keys[0]]} layer` : 'all layers'} to all ${state.backgrounds.length} backgrounds.`);
});

/* ---------- drag to move on the preview ---------- */

let drag = null;

ui.preview.addEventListener('pointerdown', (e) => {
  const layer = activeLayer();
  if (!layer) return;
  ui.preview.setPointerCapture(e.pointerId);
  ui.preview.classList.add('dragging');
  drag = { startX: e.clientX, startY: e.clientY, originX: layer.x, originY: layer.y };
});

ui.preview.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const rect = ui.preview.getBoundingClientRect();
  // Slider units span -100..100 across the canvas, i.e. 200 units per width.
  updateLayer({
    x: drag.originX + ((e.clientX - drag.startX) / rect.width) * 200,
    y: drag.originY + ((e.clientY - drag.startY) / rect.height) * 200,
  });
});

['pointerup', 'pointercancel'].forEach((type) =>
  ui.preview.addEventListener(type, () => { drag = null; ui.preview.classList.remove('dragging'); }));

/* ---------- rendering ---------- */

const toCanvasX = (x, size) => size / 2 + (x / 100) * (size / 2);
const toCanvasY = (y, size) => size / 2 + (y / 100) * (size / 2);

function drawCover(ctx, img, size) {
  const scale = Math.max(size / img.width, size / img.height);
  const w = img.width * scale;
  const h = img.height * scale;
  ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
}

function drawObject(ctx, img, size, t) {
  // 100% == the object fits inside 70% of the canvas.
  const base = (size * 0.7) / Math.max(img.width, img.height);
  const w = img.width * base * (t.scale / 100);
  const h = img.height * base * (t.scale / 100);
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = size * 0.02;
  ctx.shadowOffsetY = size * 0.008;
  ctx.drawImage(img, toCanvasX(t.x, size) - w / 2, toCanvasY(t.y, size) - h / 2, w, h);
  ctx.restore();
}

function wrapText(ctx, text, maxWidth, maxLines) {
  const words = text.split(/\s+/).filter(Boolean);
  const lines = [];
  let line = '';
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
      if (lines.length === maxLines) break;
    } else {
      line = candidate;
    }
  }
  if (lines.length < maxLines && line) lines.push(line);
  // Ellipsize if the text ran past the line budget.
  if (lines.length === maxLines) {
    const consumed = lines.join(' ').split(/\s+/).length;
    if (consumed < words.length) {
      let last = lines[maxLines - 1];
      while (last && ctx.measureText(`${last}…`).width > maxWidth) last = last.slice(0, -1).trimEnd();
      lines[maxLines - 1] = `${last}…`;
    }
  }
  return lines;
}

const BASE_SIZE = { name: 0.055, brand: 0.032, partNumber: 0.030 };

function fontString(t, kind, pixels) {
  const family = t.font ? `"${t.font}", ${FALLBACK_STACK}` : FALLBACK_STACK;
  const weight = t.bold ? 700 : 400;
  return `${t.italic ? 'italic ' : ''}${weight} ${pixels}px ${family}`;
}

// How much room the text has before it runs off the canvas, given its anchor.
function availableWidth(size, cx, align) {
  const margin = size * 0.04;
  if (align === 'left') return Math.max(size * 0.1, size - cx - margin);
  if (align === 'right') return Math.max(size * 0.1, cx - margin);
  return Math.max(size * 0.1, Math.min(cx, size - cx) * 2 - margin);
}

function drawTextLayer(ctx, size, text, t, kind) {
  if (!text) return;

  const fontSize = size * BASE_SIZE[kind] * (t.scale / 100);
  const align = t.align ?? 'center';
  const cx = toCanvasX(t.x, size);
  const cy = toCanvasY(t.y, size);

  ctx.save();
  ctx.font = fontString(t, kind, fontSize);
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.fillStyle = t.color ?? '#ffffff';
  if (t.shadow !== false) {
    // No band behind the text — a soft shadow keeps it legible over busy photos.
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = fontSize * 0.35;
    ctx.shadowOffsetY = fontSize * 0.06;
  }

  if (kind === 'name') {
    const lines = wrapText(ctx, text, availableWidth(size, cx, align), 2);
    const lineHeight = fontSize * 1.2;
    let y = cy - ((lines.length - 1) * lineHeight) / 2;
    for (const line of lines) {
      ctx.fillText(line, cx, y);
      y += lineHeight;
    }
  } else {
    // Jenis motor tracks like the item name; only the part number is spaced out.
    if (kind === 'partNumber') ctx.letterSpacing = `${fontSize * 0.08}px`;
    ctx.fillText(text.toUpperCase(), cx, cy);
  }
  ctx.restore();
}

function compose(canvas, background, size) {
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, size, size);
  ctx.imageSmoothingQuality = 'high';
  if (!background) return;

  drawCover(ctx, background.img, size);
  if (state.object) drawObject(ctx, state.object.img, size, background.transform.object);
  if (ui.showText.checked) {
    drawTextLayer(ctx, size, ui.brandName.value.trim(), background.transform.brand, 'brand');
    drawTextLayer(ctx, size, ui.name.value.trim(), background.transform.name, 'name');
    drawTextLayer(ctx, size, ui.partNumber.value.trim(), background.transform.partNumber, 'partNumber');
  }
}

function render() {
  compose(ui.preview, activeBackground(), Number(ui.outputSize.value));
  refreshDownload();
}

[ui.name, ui.brandName, ui.partNumber].forEach((input) => input.addEventListener('input', render));
[ui.showText, ui.outputSize].forEach((input) => input.addEventListener('change', render));

/* ---------- export ---------- */

function extensionOf(file) {
  const fromName = file.name.match(/\.[a-z0-9]+$/i);
  if (fromName) return fromName[0].toLowerCase();
  return file.type === 'image/jpeg' ? '.jpg' : '.png';
}

function safeSku(value) {
  return value.trim().replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-');
}

function missingPieces() {
  const missing = [];
  if (!safeSku(ui.sku.value)) missing.push('SKU');
  if (!state.object) missing.push('object photo');
  if (!state.backgrounds.length) missing.push('at least 1 background');
  return missing;
}

function refreshDownload() {
  const missing = missingPieces();
  ui.download.disabled = missing.length > 0;
  const sku = safeSku(ui.sku.value);
  ui.download.textContent = `Download ${sku ? `${sku}.zip` : 'sku.zip'}`;
  if (missing.length) setStatus(`Needs: ${missing.join(', ')}`);
  else setStatus(`Ready — ${state.backgrounds.length} image${state.backgrounds.length > 1 ? 's' : ''}`);
}

ui.sku.addEventListener('input', refreshDownload);

const toBlob = (canvas) => new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));

ui.download.addEventListener('click', async () => {
  const sku = safeSku(ui.sku.value);
  ui.download.disabled = true;
  setStatus('Rendering…');

  try {
    const size = Number(ui.outputSize.value);
    const canvas = document.createElement('canvas');
    const files = [];

    for (let i = 0; i < state.backgrounds.length; i++) {
      setStatus(`Rendering ${i + 1}/${state.backgrounds.length}…`);
      compose(canvas, state.backgrounds[i], size);
      const blob = await toBlob(canvas);
      files.push({
        name: `cover_shopee_${i + 1}.png`,
        data: new Uint8Array(await blob.arrayBuffer()),
      });
    }

    // Detail photos go in as uploaded — no compositing, no re-encoding.
    for (let i = 0; i < state.details.length; i++) {
      const { file } = state.details[i];
      files.push({
        name: `detail_${i + 1}${extensionOf(file)}`,
        data: new Uint8Array(await file.arrayBuffer()),
      });
    }

    const zip = createZip(files);
    const url = URL.createObjectURL(zip);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${sku}.zip`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    setStatus(`Downloaded ${sku}.zip (${files.length} images)`);
  } catch (error) {
    fail(error);
  } finally {
    render();
  }
});

function setStatus(message) { ui.status.textContent = message; }
function fail(error) { console.error(error); setStatus(error.message || String(error)); }

syncBackgrounds();
loadFonts();
