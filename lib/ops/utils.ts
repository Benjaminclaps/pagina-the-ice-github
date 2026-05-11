import 'server-only'

const GROUP_WINDOW_MS = 2 * 60 * 1000

export function normalizePhone(value: string | null | undefined) {
  if (!value) return null

  const trimmed = value.trim()
  if (!trimmed) return null

  const hasPlus = trimmed.startsWith('+')
  const digits = trimmed.replace(/\D/g, '')

  if (!digits) return null

  return hasPlus ? `+${digits}` : `+${digits}`
}

export function makePlaceholderName(phone: string, fallback?: string | null) {
  const cleanedFallback = fallback?.trim()
  if (cleanedFallback) return cleanedFallback
  return `Cliente ${phone}`
}

export function addMinutes(isoTimestamp: string, minutes: number) {
  const base = new Date(isoTimestamp)
  return new Date(base.getTime() + minutes * 60 * 1000).toISOString()
}

export function groupWindowMs() {
  return GROUP_WINDOW_MS
}

export function makeGroupKey(threadId: string, startedAt: string) {
  return `thread_${threadId}__${startedAt.replaceAll(':', '-').replaceAll('.', '-')}`
}

export function joinGroupedText(lines: Array<string | null | undefined>) {
  return lines
    .map(line => (typeof line === 'string' ? line.trim() : ''))
    .filter(Boolean)
    .join('\n')
}

export function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

export function isGroupClosed(bufferedUntil: string) {
  return new Date(bufferedUntil).getTime() <= Date.now()
}

export function formatTimestamp(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString()
}
