export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type CustomerRow = {
  id: string
  phone: string
  display_name: string
  razon_social: string | null
  hubspot_contact_id: string | null
  status: 'new' | 'active' | 'inactive'
  created_at: string
  updated_at: string
}

export type MessageRow = {
  id: string
  customer_id: string | null
  hubspot_thread_id: string
  hubspot_message_id: string
  direction: 'inbound' | 'outbound' | 'internal'
  raw_text: string
  grouped_text: string | null
  group_key: string | null
  status: 'pending' | 'buffered' | 'grouped' | 'ignored' | 'error'
  received_at: string
  buffered_until: string | null
  processed_at: string | null
  resolved_at: string | null
  created_at: string
}

export type OrderRow = {
  id: string
  customer_id: string | null
  customer_name: string
  source_group_key: string | null
  source_thread_id: string
  original_text: string
  original_message: string
  delivery_date: string
  status: string
  approved_by: string | null
  source: string
  portal_loaded: boolean
  hub_ok: boolean
  sheet_row_number: number | null
  sheet_status: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

export type ProductRow = {
  id: string
  internal_code: string
  display_name: string
  portal_label: string | null
  active: boolean
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      customers: {
        Row: CustomerRow
        Insert: {
          id?: string
          phone: string
          display_name: string
          razon_social?: string | null
          hubspot_contact_id?: string | null
          status?: 'new' | 'active' | 'inactive'
          created_at?: string
          updated_at?: string
        }
        Update: Partial<CustomerRow>
        Relationships: []
      }
      messages: {
        Row: MessageRow
        Insert: {
          id?: string
          customer_id?: string | null
          hubspot_thread_id: string
          hubspot_message_id: string
          direction?: 'inbound' | 'outbound' | 'internal'
          raw_text: string
          grouped_text?: string | null
          group_key?: string | null
          status?: 'pending' | 'buffered' | 'grouped' | 'ignored' | 'error'
          received_at: string
          buffered_until?: string | null
          processed_at?: string | null
          resolved_at?: string | null
          created_at?: string
        }
        Update: Partial<MessageRow>
        Relationships: [
          {
            foreignKeyName: 'messages_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      orders: {
        Row: OrderRow
        Insert: {
          id?: string
          customer_id?: string | null
          customer_name: string
          source_group_key?: string | null
          source_thread_id: string
          original_text: string
          original_message: string
          delivery_date: string
          status?: string
          approved_by?: string | null
          source?: string
          portal_loaded?: boolean
          hub_ok?: boolean
          sheet_row_number?: number | null
          sheet_status?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: Partial<OrderRow>
        Relationships: [
          {
            foreignKeyName: 'orders_customer_id_fkey'
            columns: ['customer_id']
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: ProductRow
        Insert: {
          id?: string
          internal_code: string
          display_name: string
          portal_label?: string | null
          active?: boolean
          created_at?: string
        }
        Update: Partial<ProductRow>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
