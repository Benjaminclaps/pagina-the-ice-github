import './load-env'

import { loadCalendarSyncConfig } from '../lib/calendar-sync/config'
import { runCalendarSync } from '../lib/calendar-sync/run'

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const config = loadCalendarSyncConfig()
  const intervalMs = config.syncIntervalSeconds * 1000

  let running = false
  let shouldStop = false

  const stop = () => {
    shouldStop = true
  }

  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)

  while (!shouldStop) {
    if (!running) {
      running = true
      try {
        await runCalendarSync(config)
      } catch (error) {
        console.error(
          JSON.stringify({
            level: 'error',
            message: 'calendar.sync.loop_error',
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
      } finally {
        running = false
      }
    }

    if (shouldStop) break
    await sleep(intervalMs)
  }
}

main().catch(error => {
  console.error(
    JSON.stringify({
      level: 'error',
      message: 'calendar.dev.fatal',
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

