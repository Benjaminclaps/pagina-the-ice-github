import './load-env'

import { loadCalendarSyncConfig } from '../lib/calendar-sync/config'
import { runCalendarSync } from '../lib/calendar-sync/run'

async function main() {
  const config = loadCalendarSyncConfig()
  const result = await runCalendarSync(config)

  console.info(
    JSON.stringify({
      level: 'info',
      message: 'calendar.sync.finished',
      time: new Date().toISOString(),
      ...result,
    }),
  )
}

main().catch(error => {
  console.error(
    JSON.stringify({
      level: 'error',
      message: 'calendar.sync.fatal',
      time: new Date().toISOString(),
      error: error instanceof Error
        ? {
            name: error.name,
            message: error.message,
            stack: error.stack,
          }
        : error,
    }),
  )
  process.exitCode = 1
})

