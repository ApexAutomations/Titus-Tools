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

// ── Upload a single File to file.io, return { name, url } ──
async function uploadFileForUrl(file) {
  const fd = new FormData();
  fd.append('file', file);
  fd.append('expires', '1d');      // keep for 1 day — enough for Make.com to download
  fd.append('maxDownloads', '10'); // allow multiple download attempts

  const res = await fetch('https://file.io', { method: 'POST', body: fd });
  if (!res.ok) throw new Error(`Upload failed for "${file.name}" (HTTP ${res.status})`);

  const json = await res.json();
  if (!json.success || !json.link) {
    throw new Error(`Upload rejected for "${file.name}": ${json.message || JSON.stringify(json)}`);
  }
  return { name: file.name, url: json.link };
}

// ── Upload all files in a list zone, return array of { name, url } ──
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
