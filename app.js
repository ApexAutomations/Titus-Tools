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

// ── Convert a File to a base64 payload object ────────
// Returns { filename, extension, mimetype, data } where data is raw base64
// (no data-URI prefix). Used for the logo only.
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const data = reader.result.split(',')[1];
      resolve({
        filename:  file.name,
        extension: file.name.includes('.') ? file.name.split('.').pop().toLowerCase() : '',
        mimetype:  file.type || 'application/octet-stream',
        data
      });
    };
    reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`));
    reader.readAsDataURL(file);
  });
}

// ── Read a plain-text file as a UTF-8 string ─────────
function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload  = () => resolve(reader.result);
    reader.onerror = () => reject(new Error(`Could not read file: ${file.name}`));
    reader.readAsText(file, 'utf-8');
  });
}

// ── Extract and clean text from a transcript (.txt) ──
async function extractTranscriptText(file) {
  const raw = await readFileAsText(file);
  return raw
    .replace(/\d{1,2}:\d{2}:\d{2}[.,]\d*/g, '') // HH:MM:SS.mmm timestamps
    .replace(/\d{1,2}:\d{2}:\d{2}/g, '')         // HH:MM:SS timestamps
    .replace(/\d{1,2}:\d{2}/g, '')               // MM:SS timestamps
    .replace(/\(Speaker \d+\)/gi, '')             // (Speaker N) labels
    .replace(/Speaker\s*\d+\s*:/gi, '')           // Speaker N: labels
    .replace(/Transcribed with[^\n]*/gi, '')      // Transcription footers
    .replace(/\[BLANK_AUDIO\]/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000);
}

// ── Extract text from a PDF file using PDF.js ────────
async function extractPdfText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const pageTexts = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    pageTexts.push(content.items.map(item => item.str).join(' '));
  }
  return pageTexts
    .join('\n')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 8000);
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}
