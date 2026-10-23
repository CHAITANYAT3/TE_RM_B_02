// ============================================================
// VULNEX - AI Integration (Ollama)
// Free, local, offline AI for vulnerability explanations
// ============================================================

const http = require('http');

const OLLAMA_URL = 'http://127.0.0.1:11434';
const MODEL = 'llama3.2';

// ---------- Check if Ollama is running ----------
function checkOllama() {
  return new Promise((resolve) => {
    const req = http.get(`${OLLAMA_URL}/api/tags`, { timeout: 2000 }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const hasModel = parsed.models?.some(m => m.name.includes(MODEL));
          resolve({ running: true, hasModel });
        } catch (e) {
          resolve({ running: false, hasModel: false });
        }
      });
    });
    req.on('error', () => resolve({ running: false, hasModel: false }));
    req.on('timeout', () => { req.destroy(); resolve({ running: false, hasModel: false }); });
  });
}

// ---------- Stream AI explanation ----------
function explainIssue(issue, onChunk, onDone, onError) {
  const prompt = buildPrompt(issue);

  const payload = JSON.stringify({
    model: MODEL,
    prompt: prompt,
    stream: true,
    options: {
      temperature: 0.4,
      num_predict: 400
    }
  });

  const req = http.request(`${OLLAMA_URL}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, (res) => {
    let buffer = '';

    res.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split('\n');
      buffer = lines.pop();

      lines.forEach(line => {
        if (!line.trim()) return;
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) onChunk(parsed.response);
          if (parsed.done) onDone();
        } catch (e) { /* skip malformed chunk */ }
      });
    });

    res.on('end', () => onDone());
  });

  req.on('error', (err) => onError(err.message));
  req.write(payload);
  req.end();
}

// ---------- Build the AI prompt ----------
function buildPrompt(issue) {
  return `You are a friendly cybersecurity teacher helping a beginner understand a security vulnerability found in their code.

VULNERABILITY: ${issue.message}
SEVERITY: ${issue.severity.toUpperCase()}
FILE: ${issue.file} (line ${issue.line})

VULNERABLE CODE:
${issue.snippet}

Respond in this exact format, keeping each section SHORT (2-3 sentences max):

EXPLANATION: [Explain what this vulnerability is in simple words, like explaining to a 9th grader]

REAL EXAMPLE: [Give one concrete real-world example of how this could be exploited]

FIX: [Show the corrected code snippet that fixes this]

Keep the total response under 200 words. Be direct, no fluff, no repeating the question.`;
}

module.exports = { checkOllama, explainIssue };