const RULES = [
  { name: 'Weak Password Hash', regex: /\b(md5|sha1)\s*\(/gi, severity: 'critical',
    fix: 'Use bcrypt, scrypt, or argon2 for password hashing' },
  { name: 'Plain Password Comparison', regex: /password\s*===?\s*['"][^'"]+['"]/gi, severity: 'critical',
    fix: 'Never compare passwords directly. Use hash.compare()' },
  { name: 'JWT no expiry', regex: /jwt\.sign\s*\([^)]*\)(?![\s\S]{0,100}expiresIn)/g, severity: 'high',
    fix: 'Set expiresIn: "15m" or similar in JWT options' },
  { name: 'JWT hardcoded secret', regex: /jwt\.sign\s*\([^,]+,\s*['"][^'"]+['"]/g, severity: 'critical',
    fix: 'Load JWT secret from environment variable' },
  { name: 'Cookie without httpOnly', regex: /res\.cookie\s*\([^)]*\)(?![\s\S]{0,80}httpOnly)/g, severity: 'high',
    fix: 'Set httpOnly: true, secure: true, sameSite: "strict"' },
  { name: 'CSRF disabled', regex: /csrf\s*[:=]\s*(false|0)/gi, severity: 'high',
    fix: 'Enable CSRF protection for state-changing endpoints' },
  { name: 'Password in URL', regex: /[?&](password|passwd|pwd)=[^&\s]+/gi, severity: 'high',
    fix: 'Never send credentials in URL query parameters' }
];

function scanAuth(file) {
  const issues = [];
  const lines = file.content.split('\n');

  lines.forEach((line, idx) => {
    RULES.forEach(r => {
      r.regex.lastIndex = 0;
      if (r.regex.test(line)) {
        issues.push({
          type: 'WEAK_AUTH',
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

module.exports = { scanAuth };