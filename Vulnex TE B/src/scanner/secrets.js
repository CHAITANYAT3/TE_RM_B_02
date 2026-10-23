const PATTERNS = [
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g, severity: 'critical' },
  { name: 'Google API Key', regex: /AIza[0-9A-Za-z_-]{35}/g, severity: 'critical' },
  { name: 'Stripe Key', regex: /sk_live_[0-9a-zA-Z]{24,}/g, severity: 'critical' },
  { name: 'GitHub Token', regex: /gh[pousr]_[A-Za-z0-9_]{36,}/g, severity: 'critical' },
  { name: 'Private Key', regex: /-----BEGIN (RSA|EC|OPENSSH|DSA) PRIVATE KEY-----/g, severity: 'critical' },
  { name: 'JWT Token', regex: /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, severity: 'high' },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9a-zA-Z-]{10,}/g, severity: 'high' },
  { name: 'Generic Password', regex: /(password|passwd|pwd)\s*[:=]\s*['"][^'"]{4,}['"]/gi, severity: 'high' },
  { name: 'Generic API Key', regex: /(api[_-]?key|apikey|secret[_-]?key)\s*[:=]\s*['"][^'"]{8,}['"]/gi, severity: 'high' },
  { name: 'DB Connection String', regex: /(mongodb|postgres|mysql|redis):\/\/[^\s'"]+/gi, severity: 'high' }
];

function scanSecrets(file) {
  const issues = [];
  const lines = file.content.split('\n');

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('#')) return;

    PATTERNS.forEach(p => {
      p.regex.lastIndex = 0;
      const m = p.regex.exec(line);
      if (m) {
        issues.push({
          type: 'HARDCODED_SECRET',
          subtype: p.name,
          severity: p.severity,
          line: idx + 1,
          snippet: line.trim().slice(0, 120),
          message: `${p.name} detected hardcoded`,
          fix: 'Move to environment variables and load via process.env'
        });
      }
    });
  });

  return issues;
}

module.exports = { scanSecrets };