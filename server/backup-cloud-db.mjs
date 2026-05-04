import { existsSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import dotenv from 'dotenv'
import { clampNumber, quoteSqlString } from './shared/utils.mjs'

dotenv.config({ path: '.env.local' })
dotenv.config()

const databasePath = resolve(process.env.YURI_NEST_DB_PATH || './data/yuri-nest.sqlite')
const backupDir = resolve(process.env.YURI_NEST_BACKUP_DIR || './data/backups')
const maxBackups = clampNumber(process.env.YURI_NEST_MAX_BACKUPS, 3, 120, 24)

if (!existsSync(databasePath)) {
  console.log(`No database found at ${databasePath}`)
  process.exit(0)
}

mkdirSync(dirname(databasePath), { recursive: true })
mkdirSync(backupDir, { recursive: true })

const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const backupPath = join(backupDir, `yuri-nest-scheduled-${stamp}.sqlite`)
const database = new DatabaseSync(databasePath)

database.exec(`VACUUM INTO ${quoteSqlString(backupPath)}`)
database.close()
pruneBackups()

console.log(`Created ${basename(backupPath)}`)

function pruneBackups() {
  readdirSync(backupDir)
    .filter((fileName) => fileName.startsWith('yuri-nest-') && fileName.endsWith('.sqlite'))
    .map((fileName) => {
      const path = join(backupDir, fileName)
      return { path, createdAt: statSync(path).mtime.toISOString() }
    })
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .slice(maxBackups)
    .forEach((backup) => rmSync(backup.path, { force: true }))
}
