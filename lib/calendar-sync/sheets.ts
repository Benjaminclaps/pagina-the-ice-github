import { google } from 'googleapis'

import type { SheetsConfig } from './config'

function quoteSheetName(sheetName: string) {
  if (/^[A-Za-z0-9_]+$/.test(sheetName)) return sheetName
  return `'${sheetName.replaceAll("'", "''")}'`
}

export type CalendarSheetRow = {
  rowNumber: number
  timestamp: string
  cliente: string
  encargado: string
  mensaje: string
  notas: string
  entregar_el_dia: string
  producto_pendiente_de_entrega: string
  cargado_en_hub: string
}

function isEmptyRow(row: unknown[]) {
  return row.every(cell => !String(cell ?? '').trim())
}

export function createSheetsClient(config: SheetsConfig) {
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const sheetName = quoteSheetName(config.googleSheetTab)
  const readRange = `${sheetName}!A2:H`
  let sheetIdPromise: Promise<number> | null = null

  const getSheetId = async () => {
    if (!sheetIdPromise) {
      sheetIdPromise = sheets.spreadsheets
        .get({
          spreadsheetId: config.googleSheetId,
          fields: 'sheets(properties(sheetId,title))',
        })
        .then(response => {
          const sheet = response.data.sheets?.find(
            item => item.properties?.title === config.googleSheetTab,
          )

          const sheetId = sheet?.properties?.sheetId
          if (typeof sheetId !== 'number') {
            throw new Error(`No se encontró la pestaña "${config.googleSheetTab}" para borrar filas`)
          }

          return sheetId
        })
    }

    return sheetIdPromise
  }

  return {
    async listCalendarRows() {
      const response = await sheets.spreadsheets.values.get({
        spreadsheetId: config.googleSheetId,
        range: readRange,
      })

      const rows = response.data.values ?? []

      return rows
        .map((row, index) => ({
          rowNumber: index + 2,
          timestamp: String(row?.[0] ?? '').trim(),
          cliente: String(row?.[1] ?? '').trim(),
          encargado: String(row?.[2] ?? '').trim(),
          mensaje: String(row?.[3] ?? '').trim(),
          notas: String(row?.[4] ?? '').trim(),
          entregar_el_dia: String(row?.[5] ?? '').trim(),
          producto_pendiente_de_entrega: String(row?.[6] ?? '').trim(),
          cargado_en_hub: String(row?.[7] ?? '').trim(),
        }))
        .filter((_, index) => !isEmptyRow(rows[index] ?? []))
    },

    async writeCalendarRow(values: string[]) {
      const existing = await sheets.spreadsheets.values.get({
        spreadsheetId: config.googleSheetId,
        range: readRange,
      })

      const rows = existing.data.values ?? []
      let targetRow = rows.findIndex(row => row.every(cell => !String(cell ?? '').trim()))

      if (targetRow === -1) {
        targetRow = rows.length
      }

      const rowNumber = targetRow + 2
      const updateRange = `${sheetName}!A${rowNumber}:H${rowNumber}`

      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetId,
        range: updateRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      })

      return response.data
    },

    async appendCalendarRow(values: string[]) {
      const response = await sheets.spreadsheets.values.append({
        spreadsheetId: config.googleSheetId,
        range: `${sheetName}!A:H`,
        valueInputOption: 'USER_ENTERED',
        insertDataOption: 'INSERT_ROWS',
        requestBody: {
          values: [values],
        },
      })

      return response.data
    },

    async updateCalendarRow(rowNumber: number, values: string[]) {
      const response = await sheets.spreadsheets.values.update({
        spreadsheetId: config.googleSheetId,
        range: `${sheetName}!A${rowNumber}:H${rowNumber}`,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
          values: [values],
        },
      })

      return response.data
    },

    async deleteCalendarRow(rowNumber: number) {
      const sheetId = await getSheetId()

      const response = await sheets.spreadsheets.batchUpdate({
        spreadsheetId: config.googleSheetId,
        requestBody: {
          requests: [
            {
              deleteDimension: {
                range: {
                  sheetId,
                  dimension: 'ROWS',
                  startIndex: rowNumber - 1,
                  endIndex: rowNumber,
                },
              },
            },
          ],
        },
      })

      return response.data
    },
  }
}
