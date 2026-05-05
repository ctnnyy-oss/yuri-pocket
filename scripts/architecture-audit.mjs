import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const root = process.cwd()
const watchRoots = ['src', 'server']
const ignoredDirs = new Set(['.git', 'dist', 'node_modules', '.playwright-cli'])
const codeExtensions = new Set(['.ts', '.tsx', '.mjs'])
const styleExtensions = new Set(['.css'])
const codeLineLimit = 500
const styleLineLimit = 900

const files = watchRoots.flatMap((dir) => collectFiles(join(root, dir)))
const oversized = files
  .map((filePath) => ({ filePath, lineCount: countLines(filePath), limit: getLineLimit(filePath) }))
  .filter((item) => item.limit && item.lineCount > item.limit)
  .sort((a, b) => b.lineCount - a.lineCount)

if (oversized.length === 0) {
  console.log('Architecture audit: no oversized modules in the current watchlist.')
} else {
  console.log('Architecture audit: oversized module watchlist')
  for (const item of oversized) {
    const pathLabel = relative(root, item.filePath).replaceAll('\\', '/')
    console.log(`- ${pathLabel}: ${item.lineCount} lines (watch limit ${item.limit})`)
  }
}

console.log(`Scanned ${files.length} source files. This command is advisory and does not fail the build.`)

function collectFiles(dir) {
  if (!existsAsDirectory(dir)) return []

  return readdirSync(dir).flatMap((name) => {
    const filePath = join(dir, name)
    const stats = statSync(filePath)
    if (stats.isDirectory()) {
      return ignoredDirs.has(name) ? [] : collectFiles(filePath)
    }
    return shouldWatch(filePath) ? [filePath] : []
  })
}

function existsAsDirectory(dir) {
  try {
    return statSync(dir).isDirectory()
  } catch {
    return false
  }
}

function shouldWatch(filePath) {
  return Boolean(getLineLimit(filePath))
}

function getLineLimit(filePath) {
  const extension = filePath.slice(filePath.lastIndexOf('.'))
  if (codeExtensions.has(extension)) return codeLineLimit
  if (styleExtensions.has(extension)) return styleLineLimit
  return 0
}

function countLines(filePath) {
  const content = readFileSync(filePath, 'utf8')
  return content.length === 0 ? 0 : content.split(/\r?\n/).length
}
