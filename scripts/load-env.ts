import fs from 'node:fs'
import path from 'node:path'

import { parse } from 'dotenv'

const initialEnv = new Set(Object.keys(process.env))

function loadFile(filePath: string) {
  if (!fs.existsSync(filePath)) return

  const parsed = parse(fs.readFileSync(filePath))

  for (const [key, value] of Object.entries(parsed)) {
    if (initialEnv.has(key)) continue
    process.env[key] = value
  }
}

loadFile(path.resolve(process.cwd(), '.env'))
loadFile(path.resolve(process.cwd(), '.env.local'))

