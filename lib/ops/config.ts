import 'server-only'

import { z } from 'zod'

const baseEnvSchema = z.object({
  DRY_RUN: z.string().optional(),
  TIMEZONE: z.string().min(1).optional(),
  PRIMARY_OPERATOR_NAME: z.string().min(1).optional(),
})

const supabaseEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
})

const hubspotEnvSchema = z.object({
  HUBSPOT_ACCESS_TOKEN: z.string().min(1),
})

function parseBoolean(value: string | undefined, fallback: boolean) {
  if (!value) return fallback
  return !['0', 'false', 'no', 'off'].includes(value.trim().toLowerCase())
}

export function getRuntimeConfig() {
  const env = baseEnvSchema.parse(process.env)

  return {
    dryRun: parseBoolean(env.DRY_RUN, true),
    timezone: env.TIMEZONE ?? 'America/Santiago',
    primaryOperatorName: env.PRIMARY_OPERATOR_NAME ?? 'Operador The Ice',
  }
}

export function getSupabaseConfig() {
  return supabaseEnvSchema.parse(process.env)
}

export function getHubSpotConfig() {
  return hubspotEnvSchema.parse(process.env)
}
