import { google } from 'googleapis'

import type { CalendarSyncConfig } from './config'

function quoteSheetName(sheetName: string) {
  if (/^[A-Za-z0-9_]+$/.test(sheetName)) return sheetName
  return `'${sheetName.replaceAll("'", "''")}'`
}

export function createSheetsClient(config: CalendarSyncConfig) {
  const auth = new google.auth.JWT({
    email: config.googleServiceAccountEmail,
    key: config.googlePrivateKey,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })

  const sheets = google.sheets({ version: 'v4', auth })
  const sheetName = quoteSheetName(config.googleSheetTab)
  const readRange = `${sheetName}!A2:F`

  return {
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
      const updateRange = `${sheetName}!A${rowNumber}:F${rowNumber}`

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
  }
}
