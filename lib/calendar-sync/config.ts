import { z } from 'zod'

const configSchema = z.object({
  HUBSPOT_ACCESS_TOKEN: z.string().trim().min(1),
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().trim().min(1),
  GOOGLE_PRIVATE_KEY: z.string().trim().min(1),
  GOOGLE_SHEET_ID: z.string().trim().min(1),
  GOOGLE_SHEET_TAB: z.string().trim().min(1),
  SYNC_INTERVAL_SECONDS: z
    .string()
    .trim()
    .optional()
    .transform(value => {
      if (!value) return 60
      const parsed = Number(value)
      if (!Number.isFinite(parsed) || parsed <= 0) {
        throw new Error('SYNC_INTERVAL_SECONDS debe ser un número positivo')
      }
      return Math.floor(parsed)
    }),
  TIMEZONE: z.string().trim().min(1).optional(),
})

export type CalendarSyncConfig = {
  hubspotAccessToken: string
  googleServiceAccountEmail: string
  googlePrivateKey: string
  googleSheetId: string
  googleSheetTab: string
  syncIntervalSeconds: number
  timezone: string
}

export function loadCalendarSyncConfig(): CalendarSyncConfig {
  const env = configSchema.parse(process.env)

  return {
    hubspotAccessToken: env.HUBSPOT_ACCESS_TOKEN,
    googleServiceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    googlePrivateKey: env.GOOGLE_PRIVATE_KEY.replaceAll('\\n', '\n'),
    googleSheetId: env.GOOGLE_SHEET_ID,
    googleSheetTab: env.GOOGLE_SHEET_TAB,
    syncIntervalSeconds: env.SYNC_INTERVAL_SECONDS,
    timezone: env.TIMEZONE ?? 'America/Santiago',
  }
}

