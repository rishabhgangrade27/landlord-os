// Applies prisma/views.sql against the local Postgres DB.
// Run with: node scripts/apply-views.js
const fs = require('fs')
const path = require('path')
const { Client } = require('pg')

const envPath = path.join(process.cwd(), '.env.local')
const line = fs.readFileSync(envPath, 'utf8').split('\n').find((l) => l.startsWith('DATABASE_URL='))
const DATABASE_URL = line.slice('DATABASE_URL='.length)

const sql = fs.readFileSync(path.join(process.cwd(), 'prisma', 'views.sql'), 'utf8')

const client = new Client({ connectionString: DATABASE_URL })

client.connect()
  .then(() => client.query(sql))
  .then(() => {
    console.log('Views applied successfully.')
    return client.end()
  })
  .catch((err) => {
    console.error('Failed to apply views:', err.message)
    client.end()
    process.exit(1)
  })
