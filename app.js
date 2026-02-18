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

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

// ── Background canvas animation ───────────────────────
// Slow-drifting color waves (blue, yellow, white) rendered with
// additive blending, plus a static noise tile for grain texture.
// Result: primarily black, with barely-visible color washing through.
(function bgCanvas() {
  const canvas = document.getElementById('bg-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // ── Pre-generate a static noise tile (computed once) ──
  const TILE = 256;
  const nCvs = document.createElement('canvas');
  nCvs.width = nCvs.height = TILE;
  const nCtx = nCvs.getContext('2d');
  const nImg = nCtx.createImageData(TILE, TILE);
  for (let i = 0; i < nImg.data.length; i += 4) {
    const v = (Math.random() * 255) | 0;
    nImg.data[i] = nImg.data[i+1] = nImg.data[i+2] = v;
    nImg.data[i+3] = 255;
  }
  nCtx.putImageData(nImg, 0, 0);

  // ── Wave definitions ───────────────────────────────────
  // Each wave is a large radial gradient that drifts along
  // independent sine curves. The phase offsets keep them
  // spread across the screen and out of sync with each other.
  const WAVES = [
    //  r    g    b    xPhase  yPhase  xFreq   yFreq   alpha
    { r:157, g:196, b:243, px:0.00, py:0.00, fx:0.38, fy:0.27, a:0.28 }, // blue A
    { r:244, g:198, b:  3, px:2.09, py:1.26, fx:0.29, fy:0.47, a:0.20 }, // yellow A
    { r:255, g:255, b:255, px:4.19, py:2.72, fx:0.55, fy:0.38, a:0.10 }, // white
    { r:157, g:196, b:243, px:1.05, py:3.14, fx:0.47, fy:0.21, a:0.22 }, // blue B
    { r:244, g:198, b:  3, px:3.14, py:0.71, fx:0.21, fy:0.58, a:0.15 }, // yellow B
  ];

  let W, H, noisePattern, t = 0;

  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
    noisePattern = ctx.createPattern(nCvs, 'repeat');
  }

  // Sine normalized to 0..1
  const sinN = x => (Math.sin(x) + 1) * 0.5;

  function draw() {
    // ── Solid black base ────────────────────────────────
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0F0F0F';
    ctx.fillRect(0, 0, W, H);

    // ── Color waves (additive blend) ────────────────────
    // 'lighter' mode adds RGB values together — overlapping waves
    // create slightly brighter interference zones, stays dark
    // everywhere else, which is exactly the "waves washing through" feel.
    ctx.globalCompositeOperation = 'lighter';
    for (const w of WAVES) {
      const cx = W * (0.1 + 0.8 * sinN(t * w.fx + w.px));
      const cy = H * (0.1 + 0.8 * sinN(t * w.fy + w.py));
      const r  = Math.hypot(W, H) * 0.65;
      const g  = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      g.addColorStop(0,   `rgba(${w.r},${w.g},${w.b},${w.a})`);
      g.addColorStop(0.6, `rgba(${w.r},${w.g},${w.b},${+(w.a * 0.2).toFixed(3)})`);
      g.addColorStop(1,   `rgba(0,0,0,0)`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, W, H);
    }

    // ── Grain overlay ────────────────────────────────────
    // Static noise tile in 'screen' mode at ~3 % opacity.
    // Gives the background a fine-grained texture so the color
    // waves feel particulate rather than smooth.
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 0.055;
    ctx.fillStyle = noisePattern;
    ctx.fillRect(0, 0, W, H);

    // ── Reset composite state ────────────────────────────
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    t += 0.005; // ~18 min for a full 2π cycle — extremely slow drift
    requestAnimationFrame(draw);
  }

  window.addEventListener('resize', resize);
  resize();
  draw();
}());

// ── Append files to FormData ─────────────────────────
function appendFiles(formData, inputId, fieldName) {
  const input = document.getElementById(inputId);
  if (!input || !input.files) return;
  Array.from(input.files).forEach((file, i) => {
    formData.append(fieldName + (input.multiple ? `_${i}` : ''), file);
  });
}
