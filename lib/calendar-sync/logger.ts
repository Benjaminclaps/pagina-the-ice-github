type LogLevel = 'info' | 'warn' | 'error'

function serializeError(error: unknown) {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return error
}

function write(level: LogLevel, message: string, meta: Record<string, unknown> = {}) {
  const payload = {
    level,
    message,
    time: new Date().toISOString(),
    ...Object.fromEntries(
      Object.entries(meta).map(([key, value]) => [key, key === 'error' ? serializeError(value) : value]),
    ),
  }

  const line = JSON.stringify(payload)

  if (level === 'error') {
    console.error(line)
    return
  }

  if (level === 'warn') {
    console.warn(line)
    return
  }

  console.info(line)
}

export const logger = {
  info(message: string, meta?: Record<string, unknown>) {
    write('info', message, meta)
  },
  warn(message: string, meta?: Record<string, unknown>) {
    write('warn', message, meta)
  },
  error(message: string, meta?: Record<string, unknown>) {
    write('error', message, meta)
  },
}

