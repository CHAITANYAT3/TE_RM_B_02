const { scanSecrets } = require('./secrets');
const { scanAuth } = require('./auth');
const { scanPractices } = require('./practices');
const { scanDeps } = require('./deps');

async function scanProject(files, onProgress) {
  const allIssues = [];
  let processed = 0;

  for (const file of files) {
    const fileIssues = [
      ...scanSecrets(file),
      ...scanAuth(file),
      ...scanPractices(file),
      ...scanDeps(file)
    ];

    fileIssues.forEach(issue => {
      issue.file = file.path;
      issue.details = getIssueDetails(issue);
      allIssues.push(issue);
    });

    processed++;
    if (onProgress) {
      onProgress({
        current: processed,
        total: files.length,
        currentFile: file.path,
        issuesFound: allIssues.length,
        percent: Math.round((processed / files.length) * 100)
      });
    }
  }

  return {
    totalFiles: files.length,
    totalIssues: allIssues.length,
    score: calculateScore(allIssues),
    issues: allIssues,
    bySeverity: groupBySeverity(allIssues)
  };
}

function calculateScore(issues) {
  let penalty = 0;
  issues.forEach(i => {
    if (i.severity === 'critical') penalty += 15;
    else if (i.severity === 'high') penalty += 8;
    else if (i.severity === 'medium') penalty += 4;
    else penalty += 1;
  });
  return Math.max(0, Math.min(100, 100 - penalty));
}

function groupBySeverity(issues) {
  return {
    critical: issues.filter(i => i.severity === 'critical').length,
    high: issues.filter(i => i.severity === 'high').length,
    medium: issues.filter(i => i.severity === 'medium').length,
    low: issues.filter(i => i.severity === 'low').length
  };
}

function getIssueDetails(issue) {
  const key = issue.subtype || issue.type;

  const library = {
    'AWS Access Key': {
      why: 'AWS access keys give full control over your cloud account. If leaked, attackers can spin up expensive servers, steal data, or delete everything.',
      attack: 'Bots scan GitHub and public repos 24/7 for AWS keys. A leaked key can be exploited in under 60 seconds.',
      fixed: 'const AWS_KEY = process.env.AWS_ACCESS_KEY;',
      tips: ['Never commit keys to git', 'Use .env files and add them to .gitignore', 'Rotate keys immediately if exposed']
    },
    'Stripe Key': {
      why: 'A live Stripe secret key can be used to charge cards, issue refunds, or drain your balance.',
      attack: 'Attackers use leaked Stripe keys to create fake charges, transfer funds, or scrape customer data.',
      fixed: 'const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);',
      tips: ['Live keys go in environment variables only', 'Use restricted keys for limited access', 'Monitor Stripe dashboard for suspicious activity']
    },
    'DB Connection String': {
      why: 'Database URLs often include credentials. Anyone with this string can connect directly and read/write all data.',
      attack: 'Attackers connect with the exposed credentials and dump the entire database in minutes.',
      fixed: 'const DB_URL = process.env.DATABASE_URL;',
      tips: ['Store DB URLs in .env', 'Use IAM auth when possible', 'Restrict database firewall to known IPs']
    },
    'Weak Password Hash': {
      why: 'MD5 and SHA1 are broken - attackers can compute billions of hashes per second. Any leaked hash is effectively cracked.',
      attack: 'Rainbow tables and GPU cracking crack MD5 hashes in seconds. A stolen database = stolen passwords.',
      fixed: 'const bcrypt = require("bcrypt"); const hash = await bcrypt.hash(password, 12);',
      tips: ['Use bcrypt, scrypt, or argon2', 'Always use a salt (bcrypt does this)', 'Cost factor of 10-12 minimum']
    },
    'JWT hardcoded secret': {
      why: 'If the JWT signing secret is in source code, anyone reading it can forge valid tokens for any user.',
      attack: 'Attacker reads your repo, signs a token with admin:true, and logs in as admin.',
      fixed: 'jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "15m" });',
      tips: ['JWT secret must be 32+ random chars', 'Load from environment variable', 'Rotate if exposed']
    },
    'Plain Password Comparison': {
      why: 'Direct comparison leaks info and skips hashing entirely. Any timing difference reveals whether the password was close.',
      attack: 'Timing attacks can reconstruct passwords character by character. Direct comparison is also trivially broken by DB leaks.',
      fixed: 'const isValid = await bcrypt.compare(input, storedHash);',
      tips: ['Never store plain passwords', 'Always use bcrypt.compare', 'Use constant-time comparison']
    },
    'JWT no expiry': {
      why: 'Tokens without expiry are valid forever. If stolen, an attacker has permanent access.',
      attack: 'A leaked token from a compromised device lets attackers stay logged in indefinitely.',
      fixed: 'jwt.sign(payload, secret, { expiresIn: "15m" });',
      tips: ['Access tokens: 15m-1h', 'Refresh tokens: 7-30 days', 'Always validate on server']
    },
    'Cookie without httpOnly': {
      why: 'Cookies without httpOnly can be read by JavaScript, making them vulnerable to XSS attacks.',
      attack: 'An XSS vulnerability on your site steals the session cookie, hijacking the user account.',
      fixed: 'res.cookie("token", value, { httpOnly: true, secure: true, sameSite: "strict" });',
      tips: ['Always set httpOnly', 'Use secure: true (HTTPS only)', 'Use sameSite: "strict"']
    },
    'Password in URL': {
      why: 'URLs are logged everywhere - server logs, browser history, proxies. Passwords in URLs leak instantly.',
      attack: 'Anyone with access to server logs can read passwords in plain text.',
      fixed: 'Send credentials in POST body or headers, never in the URL.',
      tips: ['Use POST for credentials', 'Never log full URLs', 'Use Authorization headers']
    },
    'SQL query concatenation': {
      why: 'Concatenating user input into SQL allows attackers to inject arbitrary SQL commands.',
      attack: 'Input like "\' OR 1=1 --" bypasses login. Worse: "DROP TABLE users;" deletes everything.',
      fixed: 'db.query("SELECT * FROM users WHERE name = ?", [username]);',
      tips: ['Always use parameterized queries', 'Never trust user input', 'Use an ORM when possible']
    },
    'eval() usage': {
      why: 'eval() executes any string as code. If user input reaches it, attackers can run arbitrary JavaScript.',
      attack: 'eval(userInput) with input like "require(\'child_process\').exec(\'rm -rf /\')" destroys the server.',
      fixed: 'Use JSON.parse() for data, or a proper parser for expressions.',
      tips: ['Never use eval() on user input', 'Use JSON.parse for data', 'Use mathjs for math expressions']
    },
    'innerHTML assignment': {
      why: 'Assigning user input to innerHTML allows Cross-Site Scripting (XSS).',
      attack: 'Setting innerHTML to "<img src=x onerror=alert(document.cookie)>" steals session cookies.',
      fixed: 'element.textContent = msg;  // safe',
      tips: ['Use textContent for text', 'Sanitize with DOMPurify if HTML needed', 'Prefer createElement + appendChild']
    },
    'Disabled HTTPS': {
      why: 'Disabling TLS verification means attackers can intercept and modify traffic.',
      attack: 'Man-in-the-middle attacks read and modify all "secure" traffic without detection.',
      fixed: 'Remove rejectUnauthorized: false. Let Node verify certificates normally.',
      tips: ['Never disable TLS in production', 'Fix certificate issues, dont bypass them', 'Use proper CA-signed certs']
    },
    'CORS wildcard': {
      why: 'Allowing any origin means any website can make requests to your API on behalf of users.',
      attack: 'Malicious site silently makes authenticated requests to your API using user cookies.',
      fixed: 'app.use(cors({ origin: ["https://yourapp.com"] }));',
      tips: ['Whitelist specific origins', 'Never use "*" with credentials', 'Validate Origin header server-side']
    },
    'Log sensitive data': {
      why: 'Logs are often stored in plain text on disk or shipped to third-party services.',
      attack: 'Anyone with log access (ops, contractors, breaches) sees passwords/tokens in plain text.',
      fixed: 'console.log("Login attempt:", { user: user.id });',
      tips: ['Never log passwords/tokens', 'Use a redaction filter', 'Log IDs, not sensitive values']
    },
    'Commented credentials': {
      why: 'Commented code stays in git history forever. Anyone cloning the repo can read it.',
      attack: 'Attackers git-log your repo and extract commented-out secrets.',
      fixed: 'Delete the commented line. Change the exposed credential immediately.',
      tips: ['Never comment out secrets', 'Clean git history if leaked', 'Use git-secrets or pre-commit hooks']
    },
    'CSRF disabled': {
      why: 'Without CSRF protection, other sites can make authenticated requests on behalf of users.',
      attack: 'A malicious site triggers a money transfer or password change using the victim session.',
      fixed: 'app.use(csrf({ cookie: true }));',
      tips: ['Use CSRF tokens on all state changes', 'Use sameSite cookies', 'Verify Origin header']
    }
  };

  if (library[key]) return library[key];

  for (const libKey of Object.keys(library)) {
    if (key && key.toLowerCase().includes(libKey.toLowerCase())) {
      return library[libKey];
    }
  }

  return {
    why: issue.message + ' is a known security weakness that should be addressed.',
    attack: 'Attackers actively scan for this pattern in real-world projects.',
    fixed: issue.fix,
    tips: ['Review the fix suggestion', 'Test the change in a safe environment', 'Re-scan after fixing']
  };
}

module.exports = { scanProject };