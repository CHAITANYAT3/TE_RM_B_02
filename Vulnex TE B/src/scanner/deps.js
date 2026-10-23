const KNOWN_VULNERABLE = {
  'lodash':       { safe: '4.17.21', reason: 'Prototype pollution in older versions' },
  'axios':        { safe: '1.6.0',   reason: 'SSRF + ReDoS in older versions' },
  'express':      { safe: '4.19.2',  reason: 'Multiple CVEs in older versions' },
  'jsonwebtoken': { safe: '9.0.0',   reason: 'Algorithm confusion attack' },
  'minimist':     { safe: '1.2.6',   reason: 'Prototype pollution' },
  'node-fetch':   { safe: '2.6.7',   reason: 'SSRF vulnerability' },
  'django':       { safe: '4.2',     reason: 'Multiple CVEs' },
  'flask':        { safe: '3.0.0',   reason: 'Security patches' },
  'requests':     { safe: '2.31.0',  reason: 'CVE-2023-32681' }
};

function scanDeps(file) {
  const issues = [];

  if (file.path.endsWith('package.json')) {
    try {
      const pkg = JSON.parse(file.content);
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      Object.entries(deps || {}).forEach(([name, version]) => {
        const known = KNOWN_VULNERABLE[name.toLowerCase()];
        if (known) {
          issues.push({
            type: 'OUTDATED_DEP', subtype: name, severity: 'medium', line: 1,
            snippet: `"${name}": "${version}"`,
            message: `${name}@${version} - safe: ${known.safe}`,
            fix: `npm install ${name}@${known.safe} (${known.reason})`
          });
        }
      });
    } catch (e) { /* invalid json */ }
  }

  if (file.path.endsWith('requirements.txt')) {
    file.content.split('\n').forEach((line, idx) => {
      const m = line.match(/^([a-zA-Z0-9_-]+)\s*==\s*([\d.]+)/);
      if (m) {
        const known = KNOWN_VULNERABLE[m[1].toLowerCase()];
        if (known) {
          issues.push({
            type: 'OUTDATED_DEP', subtype: m[1], severity: 'medium', line: idx + 1,
            snippet: line.trim(),
            message: `${m[1]}==${m[2]} - safe: ${known.safe}`,
            fix: `Upgrade to ${m[1]}>=${known.safe}: ${known.reason}`
          });
        }
      }
    });
  }

  return issues;
}

module.exports = { scanDeps };