/* =====================================================
   TITUS TALENT TOOLS — Shared App Logic
   Webhook form handling, file uploads, overlays
   ===================================================== */

// ── Overlay helpers ──────────────────────────────────
function showOverlay(id) {
  document.getElementById(id).classList.add('active');
}
function closeOverlay(id) {
  document.getElementById(id).classList.remove('active');
}
function showError(msg) {
  const el = document.getElementById('errorMessage');
  if (el) el.textContent = msg;
  showOverlay('errorOverlay');
}

// ── Email validation ─────────────────────────────────
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── URL validation ────────────────────────────────────
function isValidUrl(str) {
  try {
    const normalized = /^https?:\/\//i.test(str) ? str : 'https://' + str;
    const url = new URL(normalized);
    return url.hostname.includes('.');
  } catch { return false; }
}

// Normalize a URL string (prepend https:// if no protocol)
function normalizeUrl(str) {
  if (!str) return str;
  return /^https?:\/\//i.test(str) ? str : 'https://' + str;
}

// ── File upload zone setup ───────────────────────────
function setupUploadZone(zoneId, inputId, listId, multiple) {
  const zone  = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const list  = document.getElementById(listId);
  if (!zone || !input || !list) return;

  // Drag & drop events
  zone.addEventListener('dragover', e => {
    e.preventDefault();
    zone.classList.add('dragover');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.classList.remove('dragover');
    const files = e.dataTransfer.files;
    if (files.length) renderFiles(list, files, multiple);
  });

  input.addEventListener('change', () => {
    if (input.files.length) renderFiles(list, input.files, multiple);
  });
}

function renderFiles(listEl, files, multiple) {
  if (!multiple) listEl.innerHTML = ''; // replace for single
  Array.from(files).forEach(file => {
    const item = document.createElement('div');
    item.className = 'file-item';
    item._file = file; // store File reference for later retrieval
    item.innerHTML = `
      <span>📄</span>
      <span class="file-name" title="${file.name}">${file.name}</span>
      <span style="color:var(--gray-mid);font-size:0.72rem;">${formatBytes(file.size)}</span>
      <button type="button" class="remove-file" title="Remove">✕</button>
    `;
    item.querySelector('.remove-file').addEventListener('click', () => item.remove());
    listEl.appendChild(item);
  });
}

// ── Retrieve File objects from a rendered file list ───
function getFilesFromList(listId) {
  return Array.from(document.getElementById(listId).querySelectorAll('.file-item'))
    .map(item => item._file)
    .filter(Boolean);
}

// ── Fetch with a timeout ─────────────────────────────
function fetchWithTimeout(url, opts, ms = 12000) {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), ms);
  return fetch(url, { ...opts, signal: ctrl.signal }).finally(() => clearTimeout(id));
}

// ── Upload a single File to a public host ────────────
// Returns { name, url } on success, or null if every service fails.
// Tries cheapest (no-preflight) services first, then falls back.
async function uploadFileForUrl(file) {

  // 1. litterbox.catbox.moe — multipart/form-data, no CORS preflight, 72 h
  try {
    const fd = new FormData();
    fd.append('reqtype', 'fileupload');
    fd.append('time', '72h');
    fd.append('fileToUpload', file, file.name);
    const r = await fetchWithTimeout(
      'https://litterbox.catbox.moe/resources/internals/api.php',
      { method: 'POST', body: fd }
    );
    if (r.ok) {
      const url = (await r.text()).trim();
      if (url.startsWith('http')) return { name: file.name, url };
    }
  } catch (_) {}

  // 2. uguu.se — multipart/form-data, no CORS preflight, 48 h
  try {
    const fd = new FormData();
    fd.append('files[]', file, file.name);
    const r = await fetchWithTimeout('https://uguu.se/upload', { method: 'POST', body: fd });
    if (r.ok) {
      const data = await r.json();
      const url  = data?.files?.[0]?.url;
      if (url) return { name: file.name, url };
    }
  } catch (_) {}

  // 3. filebin.net — confirmed Access-Control-Allow-Origin: * (triggers preflight)
  try {
    const bin  = 'titus-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8);
    const safe = encodeURIComponent(file.name);
    const r = await fetchWithTimeout(`https://filebin.net/${bin}/${safe}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/octet-stream' },
      body:    file
    }, 20000);
    if (r.ok) return { name: file.name, url: `https://filebin.net/${bin}/${safe}` };
  } catch (_) {}

  // 4. file.io — multipart/form-data, no CORS preflight, 1 d
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('expires', '1d');
    const r = await fetchWithTimeout('https://file.io', { method: 'POST', body: fd });
    if (r.ok) {
      const j = await r.json();
      if (j.success && j.link) return { name: file.name, url: j.link };
    }
  } catch (_) {}

  console.warn('[Titus] All URL upload services unreachable for:', file.name);
  return null; // caller will fall back to direct multipart
}

// ── Upload all files in a list zone ──────────────────
// Returns array of { name, url } — entries may be null if upload failed.
async function uploadListFiles(listId) {
  const files = getFilesFromList(listId);
  if (!files.length) return [];
  return Promise.all(files.map(uploadFileForUrl));
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── Append files to FormData ─────────────────────────
function appendFiles(formData, inputId, fieldName) {
  const input = document.getElementById(inputId);
  if (!input || !input.files) return;
  Array.from(input.files).forEach((file, i) => {
    formData.append(fieldName + (input.multiple ? `_${i}` : ''), file);
  });
}
