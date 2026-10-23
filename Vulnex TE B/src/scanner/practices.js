const RULES = [
  { name: 'eval() usage', regex: /\beval\s*\(/g, severity: 'critical',
    fix: 'Never use eval(). Use JSON.parse() or a safe alternative' },
  { name: 'innerHTML assignment', regex: /\.innerHTML\s*=/g, severity: 'high',
    fix: 'Use textContent or sanitize with DOMPurify' },
  { name: 'document.write()', regex: /document\.write\s*\(/g, severity: 'medium',
    fix: 'Use DOM manipulation methods instead' },
  { name: 'SQL query concatenation', regex: /(SELECT|INSERT|UPDATE|DELETE).*\+\s*(req|input|user|params)/gi,
    severity: 'critical', fix: 'Use parameterized queries / prepared statements' },
  { name: 'Command injection', regex: /(exec|execSync|spawn|system)\s*\([^)]*\+/g, severity: 'critical',
    fix: 'Avoid string concat in shell commands. Use execFile with array args' },
  { name: 'Disabled HTTPS', regex: /rejectUnauthorized\s*:\s*false/g, severity: 'high',
    fix: 'Never disable TLS verification in production' },
  { name: 'CORS wildcard', regex: /origin\s*:\s*['"]\*['"]/g, severity: 'medium',
    fix: 'Restrict CORS to specific trusted origins' },
  { name: 'Log sensitive data', regex: /console\.log\s*\([^)]*(password|token|secret|key)/gi, severity: 'medium',
    fix: 'Never log sensitive data. Use a redaction filter' },
  { name: 'Commented credentials', regex: /\/\/.*(password|token|key)\s*[:=]\s*['"][^'"]+/gi, severity: 'high',
    fix: 'Delete commented credentials - they leak in git history' }
];

function scanPractices(file) {
  const issues = [];
  const lines = file.content.split('\n');

  lines.forEach((line, idx) => {
    RULES.forEach(r => {
      r.regex.lastIndex = 0;
      if (r.regex.test(line)) {
        issues.push({
          type: 'BAD_PRACTICE',
          subtype: r.name,
          severity: r.severity,
          line: idx + 1,
          snippet: line.trim().slice(0, 120),
          message: r.name,
          fix: r.fix
        });
      }
    });
  });

  return issues;
}

module.exports = { scanPractices };