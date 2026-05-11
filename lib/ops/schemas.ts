import 'server-only'

import { z } from 'zod'

export const customerCreateSchema = z.object({
  phone: z.string().min(6),
  display_name: z.string().min(2),
  razon_social: z.string().trim().optional().nullable(),
  hubspot_contact_id: z.string().trim().optional().nullable(),
  status: z.enum(['new', 'active', 'inactive']).optional(),
})

export const customerUpdateSchema = z.object({
  phone: z.string().min(6).optional(),
  display_name: z.string().min(2).optional(),
  razon_social: z.string().trim().optional().nullable(),
  hubspot_contact_id: z.string().trim().optional().nullable(),
  status: z.enum(['new', 'active', 'inactive']).optional(),
})

export const syncBodySchema = z.object({
  threadLimit: z.number().int().positive().max(50).optional(),
  messageLimit: z.number().int().positive().max(100).optional(),
})

export const createOrderSchema = z.object({
  customerId: z.string().uuid(),
  sourceGroupKey: z.string().min(3),
  deliveryDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  approvedBy: z.string().min(2),
  notes: z.string().trim().optional().nullable(),
})

export const updateOrderStatusSchema = z.object({
  status: z.enum([
    'pendiente_aprobacion',
    'aprobado',
    'pendiente_portal',
    'ingresado_portal',
    'error_portal',
  ]),
})
