// ============================================================
// VULNEX - Renderer Process
// ============================================================

// ---------- Startup sanity check ----------
console.log('[VULNEX] Renderer starting...');
window.addEventListener('DOMContentLoaded', () => {
  console.log('[VULNEX] DOMContentLoaded');
  console.log('[VULNEX] window.vulnex present?', !!window.vulnex);
  if (window.vulnex) {
    console.log('[VULNEX] Available methods:', Object.keys(window.vulnex));
  }
});

// ---------- Matrix Rain ----------
const canvas = document.getElementById('matrix');
const ctx = canvas.getContext('2d');

function resizeCanvas() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const chars = 'アイウエオカキクケコサシスセソABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789<>/{}[]()*&^%$#@!';
const fontSize = 14;
let columns = Math.floor(canvas.width / fontSize);
let drops = Array(columns).fill(1);

function drawMatrix() {
  ctx.fillStyle = 'rgba(0, 0, 0, 0.06)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#00ff41';
  ctx.font = `${fontSize}px monospace`;

  for (let i = 0; i < drops.length; i++) {
    const text = chars[Math.floor(Math.random() * chars.length)];
    ctx.fillText(text, i * fontSize, drops[i] * fontSize);
    if (drops[i] * fontSize > canvas.height && Math.random() > 0.975) drops[i] = 0;
    drops[i]++;
  }
}
setInterval(drawMatrix, 50);

// ---------- State machine ----------
const states = {
  idle: document.getElementById('idle'),
  live: document.getElementById('live'),
  scanning: document.getElementById('scanning'),
  results: document.getElementById('results')
};

function showState(name) {
  Object.values(states).forEach(el => { if (el) el.classList.add('hidden'); });
  if (states[name]) states[name].classList.remove('hidden');
  const stage = document.querySelector('.stage');
  if (stage) stage.scrollTop = 0;
}

let lastResults = null;
let ollamaStatus = { running: false, hasModel: false };

(async () => {
  try {
    if (window.vulnex && window.vulnex.aiCheck) {
      ollamaStatus = await window.vulnex.aiCheck();
      console.log('[VULNEX] Ollama status:', ollamaStatus);
    }
  } catch (e) {
    console.log('[VULNEX] Ollama not available:', e.message);
  }
})();

// ============================================================
// NAVIGATION — Idle <-> Live
// ============================================================

const liveToggleBtn = document.getElementById('liveToggle');
let currentView = 'idle';

liveToggleBtn.addEventListener('click', () => {
  if (currentView === 'live') {
    currentView = 'idle';
    liveToggleBtn.classList.remove('active');
    showState('idle');
  } else {
    currentView = 'live';
    liveToggleBtn.classList.add('active');
    showState('live');
    setTimeout(() => {
      const ed = document.getElementById('liveEditor');
      if (ed) ed.focus();
    }, 100);
  }
});

// ============================================================
// SCAN RUNNER (folder / zip / github)
// ============================================================

async function runScan(scanPromise) {
  showState('scanning');

  const statsBar = document.getElementById('statsBar');
  if (statsBar) statsBar.classList.remove('hidden');

  const statStatus = document.getElementById('statStatus');
  const statFile = document.getElementById('statFile');
  const statProgress = document.getElementById('statProgress');
  const statFound = document.getElementById('statFound');
  if (statStatus) statStatus.textContent = 'scanning';
  if (statFile) statFile.textContent = '-';
  if (statProgress) statProgress.textContent = '0/0';
  if (statFound) statFound.textContent = '0';

  const log = document.getElementById('scanLog');
  const fill = document.getElementById('progressFill');
  const text = document.getElementById('progressText');
  const radarPct = document.getElementById('radarPercent');
  if (log) log.textContent = '';
  if (radarPct) radarPct.textContent = '0%';

  if (window.vulnex && window.vulnex.onProgress) {
    window.vulnex.onProgress((p) => {
      if (fill) fill.style.width = p.percent + '%';
      if (text) text.textContent = `Scanning ${p.current}/${p.total} - ${p.percent}%`;
      if (statFile) statFile.textContent = (p.currentFile || '').split('/').pop();
      if (statProgress) statProgress.textContent = `${p.current}/${p.total}`;
      if (statFound) statFound.textContent = p.issuesFound;
      if (radarPct) radarPct.textContent = p.percent + '%';
      if (log) {
        log.textContent += `> ${p.currentFile}\n`;
        log.scrollTop = log.scrollHeight;
      }
    });
  }

  const results = await scanPromise;
  lastResults = results;

  if (statStatus) statStatus.textContent = 'complete';
  if (statFile) statFile.textContent = '-';
  if (statFound) statFound.textContent = results.totalIssues;

  renderResults(results);

  if (!document.getElementById('historyDrawer').classList.contains('hidden')) {
    loadHistory();
  }
}

document.getElementById('folderBtn').addEventListener('click', async () => {
  const p = await window.vulnex.selectFolder();
  if (!p) return;
  try { await runScan(window.vulnex.scanFolder(p)); }
  catch (err) { alert('Scan failed: ' + err.message); showState('idle'); }
});

document.getElementById('zipBtn').addEventListener('click', async () => {
  const p = await window.vulnex.selectZip();
  if (!p) return;
  try { await runScan(window.vulnex.scanZip(p)); }
  catch (err) { alert('Scan failed: ' + err.message); showState('idle'); }
});

// ---------- GitHub Modal ----------
const githubModal = document.getElementById('githubModal');
const githubUrl = document.getElementById('githubUrl');
const githubError = document.getElementById('githubError');
const githubScanBtn = document.getElementById('githubScan');

document.getElementById('githubBtn').addEventListener('click', () => {
  githubModal.classList.remove('hidden');
  githubUrl.value = '';
  githubError.classList.add('hidden');
  setTimeout(() => githubUrl.focus(), 100);
});

document.getElementById('githubClose').addEventListener('click', () => {
  githubModal.classList.add('hidden');
});

githubModal.addEventListener('click', (e) => {
  if (e.target === githubModal) githubModal.classList.add('hidden');
});

githubUrl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') githubScanBtn.click();
});

githubScanBtn.addEventListener('click', async () => {
  const url = githubUrl.value.trim();
  if (!url) {
    githubError.textContent = 'Please enter a GitHub URL.';
    githubError.classList.remove('hidden');
    return;
  }
  githubError.classList.add('hidden');
  githubModal.classList.add('hidden');
  try { await runScan(window.vulnex.scanGithub(url)); }
  catch (err) {
    githubModal.classList.remove('hidden');
    githubError.textContent = err.message || 'Failed to scan repo.';
    githubError.classList.remove('hidden');
    showState('idle');
  }
});

// ============================================================
// LIVE CODING EDITOR
// ============================================================

const liveEditor = document.getElementById('liveEditor');
const lineNumbers = document.getElementById('lineNumbers');
const highlightLayer = document.getElementById('highlightLayer');
const editorStatus = document.getElementById('editorStatus');
const editorChars = document.getElementById('editorChars');

let liveScanTimeout = null;
let liveIssues = [];

const SAMPLE_CODE = `const express = require('express');
const jwt = require('jsonwebtoken');

const API_KEY = "sk_live_51H8xYzK2eZvKYlo2Cxxx";
const JWT_SECRET = "myHardcodedSecret";

function login(req, res) {
  const query = "SELECT * FROM users WHERE name = '" + req.body.user + "'";
  const token = jwt.sign({ id: req.body.user }, JWT_SECRET);
  res.cookie('token', token);
  return res.json({ token });
}

function calculate(x) {
  return eval(x);
}

app.use(cors({ origin: '*' }));`;

// ---------- Line numbers ----------
function updateLineNumbers() {
  const lines = liveEditor.value.split('\n').length;
  let html = '';
  for (let i = 1; i <= lines; i++) html += i + '\n';
  lineNumbers.textContent = html;
  lineNumbers.scrollTop = liveEditor.scrollTop;
}

function updateEditorMeta() {
  const len = liveEditor.value.length;
  editorChars.textContent = len + ' char' + (len === 1 ? '' : 's');
}

// ---------- Scroll sync ----------
liveEditor.addEventListener('scroll', () => {
  lineNumbers.scrollTop = liveEditor.scrollTop;
  highlightLayer.scrollTop = liveEditor.scrollTop;
  highlightLayer.scrollLeft = liveEditor.scrollLeft;
});

// ---------- Input handling ----------
liveEditor.addEventListener('input', () => {
  updateLineNumbers();
  updateEditorMeta();
  editorStatus.textContent = 'typing...';
  editorStatus.classList.remove('scanning');
  clearTimeout(liveScanTimeout);
  liveScanTimeout = setTimeout(runLiveScan, 400);
});

// Tab key inserts 2 spaces
liveEditor.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    const start = liveEditor.selectionStart;
    const end = liveEditor.selectionEnd;
    liveEditor.value = liveEditor.value.substring(0, start) + '  ' + liveEditor.value.substring(end);
    liveEditor.selectionStart = liveEditor.selectionEnd = start + 2;
    liveEditor.dispatchEvent(new Event('input'));
  }
});

// ---------- Live scan ----------
async function runLiveScan() {
  const code = liveEditor.value;

  if (!code.trim()) {
    clearLiveResults();
    editorStatus.textContent = 'Ready';
    return;
  }

  // Sanity check: is scanCode wired up?
  if (!window.vulnex || typeof window.vulnex.scanCode !== 'function') {
    console.error('[VULNEX] scanCode not available on window.vulnex!');
    console.log('[VULNEX] window.vulnex =', window.vulnex);
    editorStatus.textContent = '❌ scanCode missing - restart app';
    return;
  }

  editorStatus.textContent = 'scanning...';
  editorStatus.classList.add('scanning');

  try {
    console.log('[VULNEX] Requesting scan, code length:', code.length);
    const result = await window.vulnex.scanCode(code);
    console.log('[VULNEX] Scan result:', result);

    if (!result) {
      editorStatus.textContent = 'Scan returned nothing';
      editorStatus.classList.remove('scanning');
      return;
    }

    if (result.error) {
      console.error('[VULNEX] Scan error:', result.error);
      editorStatus.textContent = '❌ ' + result.error;
      editorStatus.classList.remove('scanning');
      return;
    }

    liveIssues = result.issues || [];
    renderLiveResults(result);
    editorStatus.textContent = `Scanned · ${result.totalIssues} issue${result.totalIssues === 1 ? '' : 's'} found`;
    editorStatus.classList.remove('scanning');
  } catch (err) {
    console.error('[VULNEX] Live scan failed:', err);
    editorStatus.textContent = '❌ ' + (err.message || 'Scan error');
    editorStatus.classList.remove('scanning');
  }
}

// ---------- Render live results ----------
function renderLiveResults(result) {
  // Score
  const scoreEl = document.getElementById('liveScore');
  scoreEl.textContent = result.score;

  let color = '#00ff41';
  if (result.score < 80) color = '#ffd700';
  if (result.score < 50) color = '#ff8c00';
  if (result.score < 20) color = '#ff2b2b';
  scoreEl.style.color = color;
  scoreEl.style.textShadow = `0 0 30px ${color}`;

  // Score bar
  const fill = document.getElementById('liveScoreFill');
  fill.style.width = result.score + '%';
  fill.style.background = color;
  fill.style.color = color;

  // Counts
  document.getElementById('liveCritCount').textContent = result.bySeverity.critical;
  document.getElementById('liveHighCount').textContent = result.bySeverity.high;
  document.getElementById('liveMedCount').textContent = result.bySeverity.medium;
  document.getElementById('liveLowCount').textContent = result.bySeverity.low;
  document.getElementById('liveIssueCount').textContent = result.totalIssues + ' found';

  // Highlight vulnerable lines
  renderHighlights(result.issues);

  // Issue list
  const list = document.getElementById('liveIssueList');
  list.innerHTML = '';

  if (result.issues.length === 0) {
    list.innerHTML = '<div class="live-empty">✅ No issues detected. Code looks clean.</div>';
    return;
  }

  // Sort: critical first
  const order = { critical: 0, high: 1, medium: 2, low: 3 };
  const sorted = [...result.issues].sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));

  sorted.forEach(issue => {
    const div = document.createElement('div');
    div.className = `live-issue ${issue.severity}`;
    div.innerHTML = `
      <div class="live-issue-head">
        <span class="live-issue-title">${escapeHtml(issue.message)}</span>
        <span class="live-issue-line">Line ${issue.line}</span>
      </div>
      <div class="live-issue-fix">💡 ${escapeHtml(issue.fix)}</div>
    `;
    div.addEventListener('click', () => jumpToLine(issue.line));
    list.appendChild(div);
  });
}

// ---------- Highlight vulnerable lines ----------
function renderHighlights(issues) {
  const lines = liveEditor.value.split('\n');
  const lineSeverity = {};
  const sevRank = { critical: 4, high: 3, medium: 2, low: 1 };

  issues.forEach(issue => {
    const ln = issue.line;
    if (!ln) return;
    if (!lineSeverity[ln] || (sevRank[issue.severity] || 0) > (sevRank[lineSeverity[ln]] || 0)) {
      lineSeverity[ln] = issue.severity;
    }
  });

  let html = '';
  lines.forEach((line, idx) => {
    const ln = idx + 1;
    const sev = lineSeverity[ln];
    const cls = sev ? `hl-${sev}` : '';
    const content = line === '' ? '&nbsp;' : escapeHtml(line);
    html += `<span class="line ${cls}">${content}</span>`;
  });

  highlightLayer.innerHTML = html;
}

// ---------- Jump to line ----------
function jumpToLine(lineNum) {
  const lines = liveEditor.value.split('\n');
  if (lineNum < 1 || lineNum > lines.length) return;

  let offset = 0;
  for (let i = 0; i < lineNum - 1; i++) offset += lines[i].length + 1;
  const lineEnd = offset + (lines[lineNum - 1]?.length || 0);

  liveEditor.focus();
  liveEditor.setSelectionRange(offset, lineEnd);

  const lineHeight = 20.15;
  const targetScroll = (lineNum - 1) * lineHeight - 100;
  liveEditor.scrollTop = Math.max(0, targetScroll);
  lineNumbers.scrollTop = liveEditor.scrollTop;
  highlightLayer.scrollTop = liveEditor.scrollTop;
}

// ---------- Clear live results ----------
function clearLiveResults() {
  const scoreEl = document.getElementById('liveScore');
  scoreEl.textContent = '100';
  scoreEl.style.color = '#00ff41';
  scoreEl.style.textShadow = '0 0 30px #00ff41';

  const fill = document.getElementById('liveScoreFill');
  fill.style.width = '100%';
  fill.style.background = '#00ff41';

  document.getElementById('liveCritCount').textContent = '0';
  document.getElementById('liveHighCount').textContent = '0';
  document.getElementById('liveMedCount').textContent = '0';
  document.getElementById('liveLowCount').textContent = '0';
  document.getElementById('liveIssueCount').textContent = '0 found';
  document.getElementById('liveIssueList').innerHTML =
    '<div class="live-empty">Start typing to see live vulnerabilities...</div>';
  highlightLayer.innerHTML = '';
  liveIssues = [];
}

// ---------- Live editor buttons ----------
document.getElementById('liveClearBtn').addEventListener('click', () => {
  liveEditor.value = '';
  liveEditor.dispatchEvent(new Event('input'));
  clearLiveResults();
  editorStatus.textContent = 'Cleared';
  liveEditor.focus();
});

document.getElementById('liveExampleBtn').addEventListener('click', () => {
  liveEditor.value = SAMPLE_CODE;
  liveEditor.dispatchEvent(new Event('input'));
  liveEditor.focus();
});

// Initialize editor on load
updateLineNumbers();
updateEditorMeta();
clearLiveResults();

// ============================================================
// SCAN RESULTS (folder / zip / github)
// ============================================================

function renderResults(r) {
  showState('results');
  animateScore(r.score);
  animateRadar(r);

  document.getElementById('cCount').textContent = r.bySeverity.critical;
  document.getElementById('hCount').textContent = r.bySeverity.high;
  document.getElementById('mCount').textContent = r.bySeverity.medium;
  document.getElementById('lCount').textContent = r.bySeverity.low;

  const list = document.getElementById('issueList');
  list.innerHTML = '';

  if (r.issues.length === 0) {
    const div = document.createElement('div');
    div.className = 'issue';
    div.innerHTML = '<div class="issue-head"><span>No issues found - clean project</span></div>';
    list.appendChild(div);
    return;
  }

  const aiReady = ollamaStatus.running && ollamaStatus.hasModel;

  r.issues.slice(0, 100).forEach((issue, idx) => {
    const div = document.createElement('div');
    div.className = `issue ${issue.severity}`;

    const d = issue.details || {};
    const tips = (d.tips || []).map(t => `<li>${escapeHtml(t)}</li>`).join('');

    div.innerHTML = `
      <div class="issue-head">
        <span>${escapeHtml(issue.message)}</span>
        <span class="issue-file">${escapeHtml(issue.file)}:${issue.line}</span>
      </div>
      <div class="issue-code">${escapeHtml(issue.snippet)}</div>
      <div class="issue-fix">${escapeHtml(issue.fix)}</div>
      <div class="expand-hint">[ click to expand ]</div>

      <div class="issue-details">
        <div class="detail-section">
          <span class="detail-label">WHY IT'S DANGEROUS</span>
          <div class="detail-text">${escapeHtml(d.why || '')}</div>
        </div>
        <div class="detail-section">
          <span class="detail-label">HOW ATTACKERS EXPLOIT IT</span>
          <div class="detail-text">${escapeHtml(d.attack || '')}</div>
        </div>
        <div class="detail-section">
          <span class="detail-label">VULNERABLE CODE</span>
          <div class="detail-code bad">${escapeHtml(issue.snippet)}</div>
        </div>
        <div class="detail-section">
          <span class="detail-label">SAFE VERSION</span>
          <div class="detail-code good">${escapeHtml(d.fixed || issue.fix)}</div>
        </div>
        <div class="detail-section">
          <span class="detail-label">PREVENTION TIPS</span>
          <ul class="detail-tips">${tips}</ul>
        </div>
        <div class="detail-section ai-section">
          <button class="ai-btn" data-idx="${idx}" ${aiReady ? '' : 'disabled'}>
            🤖 ${aiReady ? 'ASK AI TO EXPLAIN' : 'AI UNAVAILABLE (install Ollama)'}
          </button>
          <div class="ai-output" id="ai-output-${idx}" style="display:none;">
            <span class="detail-label">AI EXPLANATION</span>
            <pre class="ai-text" id="ai-text-${idx}"></pre>
          </div>
        </div>
      </div>
    `;

    div.addEventListener('click', (e) => {
      if (e.target.closest('.ai-btn') || e.target.closest('.ai-output')) return;
      div.classList.toggle('expanded');
      const hint = div.querySelector('.expand-hint');
      if (hint) {
        hint.textContent = div.classList.contains('expanded')
          ? '[ click to collapse ]'
          : '[ click to expand ]';
      }
    });

    list.appendChild(div);
  });

  document.querySelectorAll('.ai-btn').forEach(btn => {
    if (btn.disabled) return;
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.idx);
      runAiExplanation(idx, r.issues[idx], btn);
    });
  });
}

function animateRadar(r) {
  const criticalArc = document.getElementById('radarCriticalArc');
  const highArc = document.getElementById('radarHighArc');
  const mediumArc = document.getElementById('radarMediumArc');
  const lowArc = document.getElementById('radarLowArc');

  const total = Math.max(1, r.totalIssues);
  const maxSweep = 1000;
  const criticalFill = (r.bySeverity.critical / total) * maxSweep;
  const highFill     = (r.bySeverity.high     / total) * maxSweep;
  const mediumFill   = (r.bySeverity.medium   / total) * maxSweep;
  const lowFill      = (r.bySeverity.low      / total) * maxSweep;

  [criticalArc, highArc, mediumArc, lowArc].forEach(a => a.setAttribute('stroke-dasharray', '0 1000'));
  setTimeout(() => criticalArc.setAttribute('stroke-dasharray', `${criticalFill} ${maxSweep}`), 100);
  setTimeout(() => highArc.setAttribute('stroke-dasharray', `${highFill} ${maxSweep}`), 400);
  setTimeout(() => mediumArc.setAttribute('stroke-dasharray', `${mediumFill} ${maxSweep}`), 700);
  setTimeout(() => lowArc.setAttribute('stroke-dasharray', `${lowFill} ${maxSweep}`), 1000);

  const dotsGroup = document.getElementById('threatDots');
  dotsGroup.innerHTML = '';
  const colors = { critical: '#ff2b2b', high: '#ff8c00', medium: '#ffd700', low: '#00aa2a' };

  r.issues.slice(0, 60).forEach((issue, i) => {
    const angle = (i / Math.min(60, r.totalIssues)) * Math.PI * 2 + Math.random() * 0.3;
    const radius = 40 + Math.random() * 90;
    const x = 150 + Math.cos(angle) * radius;
    const y = 150 + Math.sin(angle) * radius;
    const color = colors[issue.severity] || colors.low;
    const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
    dot.setAttribute('cx', x);
    dot.setAttribute('cy', y);
    dot.setAttribute('r', 0);
    dot.setAttribute('fill', color);
    dot.setAttribute('opacity', '0.9');
    dotsGroup.appendChild(dot);
    setTimeout(() => {
      dot.style.transition = 'r 0.3s ease-out';
      dot.setAttribute('r', 3);
    }, 1200 + i * 20);
  });

  const radarScore = document.getElementById('radarScore');
  let color = '#00ff41';
  if (r.score < 80) color = '#ffd700';
  if (r.score < 50) color = '#ff8c00';
  if (r.score < 20) color = '#ff2b2b';
  radarScore.style.color = color;
  radarScore.style.textShadow = `0 0 20px ${color}`;
  radarScore.textContent = r.score;
}

function animateScore(target) {
  const el = document.getElementById('scoreValue');
  let current = 0;
  const step = Math.max(1, Math.ceil(target / 50));

  const interval = setInterval(() => {
    current += step;
    if (current >= target) { current = target; clearInterval(interval); }
    el.textContent = current;
    let color = '#00ff41';
    if (current < 80) color = '#ffd700';
    if (current < 50) color = '#ff8c00';
    if (current < 20) color = '#ff2b2b';
    el.style.color = color;
    el.style.textShadow = `0 0 40px ${color}`;
  }, 20);
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

document.getElementById('rescanBtn').addEventListener('click', () => {
  document.getElementById('statsBar').classList.add('hidden');
  ['radarCriticalArc', 'radarHighArc', 'radarMediumArc', 'radarLowArc'].forEach(id => {
    document.getElementById(id).setAttribute('stroke-dasharray', '0 1000');
  });
  document.getElementById('threatDots').innerHTML = '';
  showState('idle');
  liveToggleBtn.classList.remove('active');
  currentView = 'idle';
});

document.getElementById('exportBtn').addEventListener('click', async () => {
  if (!lastResults) return;
  const r = lastResults;
  const lines = [];
  const date = new Date().toISOString();
  lines.push('='.repeat(60));
  lines.push('  VULNEX SECURITY REPORT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Generated: ${date}`);
  lines.push(`Files Scanned: ${r.totalFiles}`);
  lines.push(`Total Issues:  ${r.totalIssues}`);
  lines.push(`Security Score: ${r.score}/100`);
  lines.push('');
  lines.push('SEVERITY BREAKDOWN');
  lines.push('-'.repeat(60));
  lines.push(`  CRITICAL: ${r.bySeverity.critical}`);
  lines.push(`  HIGH:     ${r.bySeverity.high}`);
  lines.push(`  MEDIUM:   ${r.bySeverity.medium}`);
  lines.push(`  LOW:      ${r.bySeverity.low}`);
  lines.push('');
  lines.push('='.repeat(60));
  lines.push('  DETAILED FINDINGS');
  lines.push('='.repeat(60));
  lines.push('');
  r.issues.forEach((issue, i) => {
    lines.push(`[${i + 1}] ${issue.message}`);
    lines.push(`    Severity: ${issue.severity.toUpperCase()}`);
    lines.push(`    Location: ${issue.file}:${issue.line}`);
    lines.push(`    Code:     ${issue.snippet}`);
    lines.push(`    Fix:      ${issue.fix}`);
    if (issue.details) {
      lines.push(`    Why:      ${issue.details.why}`);
      lines.push(`    Attack:   ${issue.details.attack}`);
    }
    lines.push('');
  });
  lines.push('='.repeat(60));
  lines.push('  END OF REPORT');
  lines.push('='.repeat(60));
  const path = await window.vulnex.saveReport(lines.join('\n'));
  if (path) alert('Report saved to:\n' + path);
});

// ============================================================
// AI
// ============================================================

async function runAiExplanation(idx, issue, btn) {
  const outputBox = document.getElementById(`ai-output-${idx}`);
  const textEl = document.getElementById(`ai-text-${idx}`);
  btn.disabled = true;
  btn.textContent = '🤖 AI THINKING...';
  outputBox.style.display = 'block';
  textEl.textContent = '';
  window.vulnex.onAiChunk((chunk) => {
    textEl.textContent += chunk;
    textEl.scrollTop = textEl.scrollHeight;
  });
  try {
    await window.vulnex.aiExplain({
      message: issue.message, severity: issue.severity,
      file: issue.file, line: issue.line, snippet: issue.snippet
    });
    btn.textContent = '✓ AI EXPLANATION READY';
  } catch (err) {
    textEl.textContent = 'AI error: ' + err.message;
    btn.textContent = '⚠ RETRY AI';
    btn.disabled = false;
  }
}

// ============================================================
// HISTORY
// ============================================================

const historyDrawer = document.getElementById('historyDrawer');
const historyOverlay = document.getElementById('historyOverlay');
const historyList = document.getElementById('historyList');
const historyEmpty = document.getElementById('historyEmpty');
const historyToggleBtn = document.getElementById('historyToggle');
const historyCloseBtn = document.getElementById('historyClose');
const historyClearBtn = document.getElementById('historyClear');
const historyEnabledToggle = document.getElementById('historyEnabledToggle');

function openHistory() {
  historyDrawer.classList.remove('hidden');
  historyOverlay.classList.remove('hidden');
  loadHistory();
}
function closeHistory() {
  historyDrawer.classList.add('hidden');
  historyOverlay.classList.add('hidden');
}

historyToggleBtn.addEventListener('click', openHistory);
historyCloseBtn.addEventListener('click', closeHistory);
historyOverlay.addEventListener('click', closeHistory);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeHistory();
    githubModal.classList.add('hidden');
  }
});

historyEnabledToggle.addEventListener('change', async (e) => {
  await window.vulnex.settingsSet({ historyEnabled: e.target.checked });
});

historyClearBtn.addEventListener('click', async () => {
  if (!confirm('Delete ALL scan history? This cannot be undone.')) return;
  await window.vulnex.historyClear();
  loadHistory();
});

async function loadHistory() {
  try {
    const settings = await window.vulnex.settingsGet();
    historyEnabledToggle.checked = !!settings.historyEnabled;
  } catch (e) { /* ignore */ }

  const items = await window.vulnex.historyList();
  historyList.innerHTML = '';

  if (!items || items.length === 0) {
    historyEmpty.style.display = 'block';
    return;
  }
  historyEmpty.style.display = 'none';

  items.forEach(item => {
    const div = document.createElement('div');
    div.className = 'history-item';
    const scoreColor =
      item.score < 20 ? '#ff2b2b' :
      item.score < 50 ? '#ff8c00' :
      item.score < 80 ? '#ffd700' : '#00ff41';
    const date = new Date(item.date);
    const dateStr = date.toLocaleDateString() + ' ' +
                    date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const displayName = item.zipName || '(unknown)';

    div.innerHTML = `
      <button type="button" class="history-item-delete" data-id="${item.id}" title="Delete">✕</button>
      <div class="history-item-header">
        <span class="history-item-name">${escapeHtml(displayName)}</span>
        <span class="history-item-score" style="color:${scoreColor};text-shadow:0 0 10px ${scoreColor}">
          ${item.score}
        </span>
      </div>
      <div class="history-item-meta">
        <span>${dateStr}</span>
        <span>${item.totalIssues} issues / ${item.totalFiles} files</span>
      </div>
    `;

    div.addEventListener('click', (e) => {
      if (e.target.classList.contains('history-item-delete')) return;
      loadHistoryItem(item.id);
    });

    const delBtn = div.querySelector('.history-item-delete');
    delBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm(`Delete "${displayName}" from history?`)) return;
      await window.vulnex.historyDelete(item.id);
      loadHistory();
    });

    historyList.appendChild(div);
  });
}

async function loadHistoryItem(id) {
  const results = await window.vulnex.historyGet(id);
  if (!results) { alert('Scan not found.'); return; }
  lastResults = results;
  document.getElementById('statsBar').classList.add('hidden');
  renderResults(results);
  closeHistory();
}