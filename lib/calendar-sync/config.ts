import { z } from 'zod'

const sheetsEnvSchema = z.object({
  GOOGLE_SERVICE_ACCOUNT_EMAIL: z.string().trim().min(1),
  GOOGLE_PRIVATE_KEY: z.string().trim().min(1),
  GOOGLE_SHEET_ID: z.string().trim().min(1),
  GOOGLE_SHEET_TAB: z.string().trim().min(1),
  TIMEZONE: z.string().trim().min(1).optional(),
})

const calendarSyncEnvSchema = sheetsEnvSchema.extend({
  HUBSPOT_ACCESS_TOKEN: z.string().trim().min(1),
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

export type SheetsConfig = {
  googleServiceAccountEmail: string
  googlePrivateKey: string
  googleSheetId: string
  googleSheetTab: string
  timezone: string
}

export type CalendarSyncConfig = {
  googleServiceAccountEmail: string
  googlePrivateKey: string
  googleSheetId: string
  googleSheetTab: string
  timezone: string
  hubspotAccessToken: string
  syncIntervalSeconds: number
}

function buildSheetsConfig(env: z.infer<typeof sheetsEnvSchema>): SheetsConfig {
  return {
    googleServiceAccountEmail: env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    googlePrivateKey: env.GOOGLE_PRIVATE_KEY.replaceAll('\\n', '\n'),
    googleSheetId: env.GOOGLE_SHEET_ID,
    googleSheetTab: env.GOOGLE_SHEET_TAB,
    timezone: env.TIMEZONE ?? 'America/Santiago',
  }
}

export function loadSheetsConfig(): SheetsConfig {
  return buildSheetsConfig(sheetsEnvSchema.parse(process.env))
}

export function loadCalendarSyncConfig(): CalendarSyncConfig {
  const env = calendarSyncEnvSchema.parse(process.env)

  return {
    ...buildSheetsConfig(env),
    hubspotAccessToken: env.HUBSPOT_ACCESS_TOKEN,
    syncIntervalSeconds: env.SYNC_INTERVAL_SECONDS,
  }
}
