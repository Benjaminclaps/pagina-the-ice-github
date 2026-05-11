export function formatTimestamp(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat('es-CL', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const values = Object.fromEntries(
    parts
      .filter(part => part.type !== 'literal')
      .map(part => [part.type, part.value]),
  )

  return `${values.day}/${values.month}/${values.year} ${values.hour}:${values.minute}`
}

export function isValidHubSpotDate(value: string | null | undefined) {
  if (!value) return false
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false

  const [year, month, day] = value.split('-').map(part => Number(part))
  const date = new Date(Date.UTC(year, month - 1, day))

  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

export function formatValidationError(message: string) {
  return message.trim().replace(/\s+/g, ' ')
}
