var SHEET_NAME = 'Pedidos'
var HUB_COL = 8 // Columna H

function getSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet()
  var sheet = ss.getSheetByName(SHEET_NAME)

  if (!sheet) {
    throw new Error('No existe una hoja llamada "' + SHEET_NAME + '". Revisa el nombre de la pestaña.')
  }

  return sheet
}

function isHubOk(value) {
  if (value === true) return true
  if (value === false) return false
  if (value === 1) return true
  if (value === 0) return false

  var text = String(value || '').trim().toLowerCase()

  return (
    text === 'ok' ||
    text === 'true' ||
    text === '1' ||
    text === 'si' ||
    text === 'sí' ||
    text === 'yes'
  )
}

function isYesNo(value) {
  if (value === true) return 'si'
  if (value === false) return 'no'
  if (value === 1) return 'si'
  if (value === 0) return 'no'

  var text = String(value || '').trim().toLowerCase()

  return text === 'si' || text === 'sí' || text === 'yes' || text === 'true' || text === '1' ? 'si' : 'no'
}

function formatTimestamp(value) {
  return Utilities.formatDate(value, 'America/Santiago', 'dd/MM/yyyy HH:mm')
}

function formatDateValue(value) {
  if (Object.prototype.toString.call(value) === '[object Date]' && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, Session.getScriptTimeZone(), 'yyyy-MM-dd')
  }

  var text = String(value || '').trim()

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text
  }

  return ''
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}')
    var sheet = getSheet()

  if (body.action === 'update_hub_status') {
    var rowNumber = Number(body.rowNumber)

    if (!rowNumber || rowNumber < 2) {
      throw new Error('Falta rowNumber valido para actualizar cargado_en_hub.')
      }

      var hubValue = isHubOk(body.cargado_en_hub || body.hub_ok) ? 'OK' : ''

      sheet.getRange(rowNumber, HUB_COL).setValue(hubValue)

      return ContentService
        .createTextOutput(
          JSON.stringify({
            ok: true,
            message: 'Estado cargado_en_hub actualizado',
          }),
        )
        .setMimeType(ContentService.MimeType.JSON)
    }

    if (body.action === 'delete_row') {
      var deleteRowNumber = Number(body.rowNumber)

      if (!deleteRowNumber || deleteRowNumber < 2) {
        throw new Error('Falta rowNumber valido para eliminar el pedido.')
      }

      sheet.deleteRow(deleteRowNumber)

      return ContentService
        .createTextOutput(
          JSON.stringify({
            ok: true,
            message: 'Pedido eliminado',
          }),
        )
        .setMimeType(ContentService.MimeType.JSON)
    }

    sheet.appendRow([
      formatTimestamp(new Date()), // A timestamp
      body.cliente || '', // B cliente
      body.encargado || '', // C encargado
      body.mensaje || '', // D mensaje
      body.notas || '', // E notas
      body.entregar_el_dia || '', // F entregar_el_dia
      isYesNo(body.producto_pendiente_de_entrega || body.pendiente_de_entrega), // G producto_pendiente_de_entrega
      isHubOk(body.cargado_en_hub || body.hub_ok) ? 'OK' : '', // H cargado_en_hub
    ])

    return ContentService
      .createTextOutput(
        JSON.stringify({
          ok: true,
          message: 'Pedido guardado',
        }),
      )
      .setMimeType(ContentService.MimeType.JSON)
  } catch (error) {
    return ContentService
      .createTextOutput(
        JSON.stringify({
          ok: false,
          error: String(error),
        }),
      )
      .setMimeType(ContentService.MimeType.JSON)
  }
}

function doGet(e) {
  try {
    var date = ''

    if (e && e.parameter && e.parameter.date) {
      date = e.parameter.date
    }

    var sheet = getSheet()
    var values = sheet.getDataRange().getValues()
    var rows = []

    for (var i = 1; i < values.length; i++) {
      var row = values[i]
      var rowDate = formatDateValue(row[5])

      if (!date || rowDate === date) {
        rows.push({
          rowNumber: i + 1,
          timestamp: row[0],
          cliente: row[1],
          encargado: row[2],
          mensaje: row[3],
          notas: row[4],
          entregar_el_dia: rowDate || String(row[5] || ''),
          producto_pendiente_de_entrega: isYesNo(row[6]),
          pendiente_de_entrega: isYesNo(row[6]),
          cargado_en_hub: isHubOk(row[7]),
          hub_ok: isHubOk(row[7]),
        })
      }
    }

    return ContentService
      .createTextOutput(
        JSON.stringify({
          ok: true,
          date: date,
          items: rows,
        }),
      )
      .setMimeType(ContentService.MimeType.JSON)
  } catch (error) {
    return ContentService
      .createTextOutput(
        JSON.stringify({
          ok: false,
          error: String(error),
        }),
      )
      .setMimeType(ContentService.MimeType.JSON)
  }
}

function testDoPost() {
  var e = {
    postData: {
      contents: JSON.stringify({
        cliente: 'Cliente prueba',
        encargado: 'Benja',
        mensaje: 'Pedido de prueba',
        notas: 'Sin notas',
        entregar_el_dia: '2026-05-03',
        producto_pendiente_de_entrega: 'no',
        cargado_en_hub: false,
      }),
    },
  }

  var response = doPost(e)
  Logger.log(response.getContent())
}

function testDoGet() {
  var e = {
    parameter: {
      date: '2026-05-03',
    },
  }

  var response = doGet(e)
  Logger.log(response.getContent())
}
