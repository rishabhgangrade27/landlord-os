// Usage: node scripts/set-password.js "your-new-password"
// Hashes the password with bcrypt and writes ADMIN_PASSWORD_HASH into .env.local
const bcrypt = require('bcryptjs')
const fs = require('fs')
const path = require('path')

const password = process.argv[2]
if (!password || password.length < 8) {
  console.error('Usage: node scripts/set-password.js "your-new-password" (min 8 chars)')
  process.exit(1)
}

const hash = bcrypt.hashSync(password, 12)

// @next/env (Next.js's .env loader) treats "$name" as a variable reference to
// expand, and bcrypt hashes are full of "$" (e.g. "$2b$12$..."), so an
// unescaped hash gets silently mangled into garbage at runtime - login would
// never work no matter how correct the password is. Escaping "$" as "\$"
// makes @next/env load the literal character back out correctly (verified).
const escapedHash = hash.split('$').join('\\$')

const envPath = path.join(process.cwd(), '.env.local')
const lines = fs.readFileSync(envPath, 'utf8').split('\n')
const updated = lines.map((line) =>
  line.startsWith('ADMIN_PASSWORD_HASH=') ? `ADMIN_PASSWORD_HASH=${escapedHash}` : line
)
fs.writeFileSync(envPath, updated.join('\n'))
console.log('Password updated. Restart the dev server for it to take effect.')
