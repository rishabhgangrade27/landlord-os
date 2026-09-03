import 'server-only'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { readdir, stat, mkdir, unlink } from 'fs/promises'
import path from 'path'
import fs from 'fs'

const execFileAsync = promisify(execFile)

export const BACKUP_DIR = path.join(process.cwd(), 'backups')
const DAILY_RETENTION_DAYS = 90

// Postgres ships pg_dump/pg_restore next to itself, but where that "next to
// itself" is depends entirely on how it was installed (version number in the
// path, custom install dir, etc.) — this app runs on whatever machine the landlord's
// PC turns out to have, so don't hardcode a version. Prefer PATH, then fall
// back to scanning the standard Windows install location for any version.
function resolvePgBinary(name: 'pg_dump' | 'pg_restore'): string {
  if (process.env.PG_BIN_DIR) {
    return path.join(process.env.PG_BIN_DIR, `${name}.exe`)
  }
  const pgRoot = 'C:\\Program Files\\PostgreSQL'
  if (fs.existsSync(pgRoot)) {
    const versions = fs.readdirSync(pgRoot)
      .filter((v) => /^\d+$/.test(v))
      .sort((a, b) => Number(b) - Number(a))
    for (const v of versions) {
      const candidate = path.join(pgRoot, v, 'bin', `${name}.exe`)
      if (fs.existsSync(candidate)) return candidate
    }
  }
  // Last resort: hope it's on PATH (e.g. non-Windows dev machines).
  return name
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL not set')
  return url
}

export type BackupKind = 'manual' | 'daily' | 'pre-op'

export type BackupFile = {
  filename: string
  kind: BackupKind
  createdAt: Date
  sizeBytes: number
}

function parseBackupFilename(filename: string): { kind: BackupKind; createdAt: Date } | null {
  const match = filename.match(/^(manual|daily|pre-op)-(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2})\.dump$/)
  if (!match) return null
  const iso = match[2].replace(/^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})$/, '$1T$2:$3:$4')
  return { kind: match[1] as BackupKind, createdAt: new Date(iso) }
}

function timestampForFilename(date: Date): string {
  return date.toISOString().replace(/:/g, '-').split('.')[0]
}

export async function createBackup(kind: BackupKind, label?: string): Promise<{ success: true; filename: string } | { success: false; error: string }> {
  try {
    await mkdir(BACKUP_DIR, { recursive: true })
    const filename = `${kind}-${timestampForFilename(new Date())}${label ? `_${label.replace(/[^a-z0-9_-]/gi, '')}` : ''}.dump`
    const filePath = path.join(BACKUP_DIR, filename)
    const pgDump = resolvePgBinary('pg_dump')

    await execFileAsync(pgDump, [getDatabaseUrl(), '-Fc', '-f', filePath], {
      maxBuffer: 1024 * 1024 * 50,
    })

    return { success: true, filename }
  } catch (error: any) {
    return { success: false, error: error.message || 'pg_dump failed' }
  }
}

export async function listBackups(): Promise<BackupFile[]> {
  try {
    await mkdir(BACKUP_DIR, { recursive: true })
    const files = await readdir(BACKUP_DIR)
    const results: BackupFile[] = []
    for (const filename of files) {
      const parsed = parseBackupFilename(filename)
      if (!parsed) continue
      const s = await stat(path.join(BACKUP_DIR, filename))
      results.push({ filename, kind: parsed.kind, createdAt: parsed.createdAt, sizeBytes: s.size })
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  } catch {
    return []
  }
}

// Deletes daily snapshots older than the retention window. Manual and
// pre-op snapshots are never auto-deleted — the admin decides when to clean
// those up himself (they're deliberate, not routine).
export async function pruneDailyBackups(): Promise<number> {
  const all = await listBackups()
  const cutoff = Date.now() - DAILY_RETENTION_DAYS * 24 * 60 * 60 * 1000
  let deleted = 0
  for (const b of all) {
    if (b.kind === 'daily' && b.createdAt.getTime() < cutoff) {
      await unlink(path.join(BACKUP_DIR, b.filename)).catch(() => {})
      deleted++
    }
  }
  return deleted
}

// Restores a snapshot over the current database. Always takes a fresh
// "pre-op" safety-net backup of the CURRENT state first — if the restore
// turns out to be the wrong choice, that's what undoes it.
export async function restoreBackup(filename: string): Promise<{ success: true; safetyBackup: string } | { success: false; error: string }> {
  if (!/^(manual|daily|pre-op)-[\d T:-]+(_[a-z0-9_-]+)?\.dump$/i.test(filename)) {
    return { success: false, error: 'Invalid backup filename' }
  }
  const filePath = path.join(BACKUP_DIR, filename)
  if (!fs.existsSync(filePath)) {
    return { success: false, error: 'Backup file not found' }
  }

  const safetyResult = await createBackup('pre-op', 'before_restore')
  if (!safetyResult.success) {
    return { success: false, error: `Refusing to restore — safety backup failed: ${safetyResult.error}` }
  }

  try {
    const pgRestore = resolvePgBinary('pg_restore')
    await execFileAsync(pgRestore, ['-d', getDatabaseUrl(), '--clean', '--if-exists', filePath], {
      maxBuffer: 1024 * 1024 * 50,
    })
    return { success: true, safetyBackup: safetyResult.filename }
  } catch (error: any) {
    // pg_restore exits non-zero on warnings even when it mostly succeeds
    // (e.g. "role does not exist" for ownership it can't reapply) — surface
    // the message but don't pretend this always means total failure.
    return { success: false, error: error.stderr || error.message || 'pg_restore failed' }
  }
}
