'use client'
import { useState } from 'react'

const MAIN_PRODUCTS = ['The original pack 12kg', 'The minis pack 12kg', 'Tubo solido 12.5kg'] as const

const CUSTOM_PRODUCTS = [
  'Hielo Nugget bolsa zipper (pack 12 kg)',
  'Hielo Tradicional bolsa zipper (pack 12 kg)',
  'Hielo tubo sólido – pack 12,5 kg',
  'The Cubes (15 cubos de 5x5cm)',
  'The Spheres (15 esferas de 65mm)',
  'The Sticks (15 collins de 4x12)',
  'The Big Tall (15 cubos largos de 4.5x7)',
  'The Big Tube (24 collins redondos)',
  'The Hexagon (15 unidades)',
  'The Golf Balls (15 unidades)',
  'The Tangerines (24 mandarinas)',
  'The Tennis Balls (20 bolas de 55mm)',
  'The Balls (24 esferas de 50mm)',
  'Arriendo Freezer Horizontal 600lt',
  'The Mix Coctelería',
  'Arriendo Freezer Horizontal 350lt',
  'The Diamonds (20 unidades)',
  'Saco hielo escama 5 kg',
  'Arriendo camión refrigerado para evento',
  'Transporte',
  'The Sticks (24 collins de 4x12)',
  'The Skulls (20 unidades)',
  'Saco hielo escama 25 kg',
  'The XMAS cube (15 unidades)',
  'The Cubes (24 cubos de 4x4cm)',
  'Hielo Tradicional Retail (pack 12 kg)',
]

type CustomLine = { product: string; qty: number }
type Summary = Record<string, number>

function QtyControl({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(Math.max(0, value - 1))}
        className="w-10 h-10 rounded-full bg-white/10 text-white text-xl font-light hover:bg-white/20 active:scale-95 transition-all flex items-center justify-center select-none"
      >
        −
      </button>
      <span className="text-white text-lg font-bold w-8 text-center tabular-nums">{value}</span>
      <button
        onClick={() => onChange(value + 1)}
        className="w-10 h-10 rounded-full bg-purple-600 text-white text-xl font-light hover:bg-purple-500 active:scale-95 transition-all flex items-center justify-center select-none"
      >
        +
      </button>
    </div>
  )
}

const emptyMain = () => Object.fromEntries(MAIN_PRODUCTS.map(p => [p, 0]))

export default function TheIceCounter() {
  const [mainCounts, setMainCounts] = useState<Record<string, number>>(emptyMain())
  const [customLines, setCustomLines] = useState<CustomLine[]>([])
  const [summary, setSummary] = useState<Summary>({})

  const updateMain = (product: string, qty: number) =>
    setMainCounts(prev => ({ ...prev, [product]: qty }))

  const addCustomLine = () =>
    setCustomLines(prev => [...prev, { product: '', qty: 0 }])

  const updateCustomLine = (index: number, field: keyof CustomLine, value: string | number) =>
    setCustomLines(prev => prev.map((line, i) => i === index ? { ...line, [field]: value } : line))

  const removeCustomLine = (index: number) =>
    setCustomLines(prev => prev.filter((_, i) => i !== index))

  const hasInput = Object.values(mainCounts).some(v => v > 0) || customLines.some(l => l.qty > 0)
  const hasSummary = Object.keys(summary).length > 0

  const handleAddInvoice = () => {
    const next = { ...summary }
    Object.entries(mainCounts).forEach(([p, q]) => { if (q > 0) next[p] = (next[p] || 0) + q })
    customLines.forEach(({ product, qty }) => {
      if (product && qty > 0) next[product] = (next[product] || 0) + qty
    })
    setSummary(next)
    setMainCounts(emptyMain())
    setCustomLines([])
  }

  const handleClearAll = () => {
    setMainCounts(emptyMain())
    setCustomLines([])
    setSummary({})
  }

  const totalUnits = Object.values(summary).reduce((a, b) => a + b, 0)

  const extractKg = (productName: string): number | null => {
    const match = productName.match(/(\d+(?:[.,]\d+)?)\s*kg/i)
    if (match) {
      return parseFloat(match[1].replace(',', '.'))
    }
    return null
  }

  const totalKg = Object.entries(summary).reduce((acc, [product, qty]) => {
    const kg = extractKg(product)
    return acc + (kg ? kg * qty : 0)
  }, 0)

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_#3b0764_0%,_#0f0f1a_60%)] px-4 py-10">
      <div className="max-w-md mx-auto space-y-4">

        {/* Header */}
        <div className="text-center mb-8">
          <p className="text-purple-400 text-xs uppercase tracking-[0.3em] mb-2">Despachos</p>
          <h1 className="text-4xl font-black text-white tracking-tight">The Ice Counter</h1>
          <p className="text-white/30 text-sm mt-1">Contador de facturas</p>
        </div>

        {/* Form card */}
        <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/10 p-6">
          <p className="text-purple-400 text-xs uppercase tracking-widest font-semibold mb-5">
            Factura actual
          </p>

          {/* Main products */}
          <div className="space-y-5">
            {MAIN_PRODUCTS.map(product => (
              <div key={product} className="flex items-center justify-between gap-4">
                <span className="text-white text-sm font-medium leading-tight flex-1">{product}</span>
                <QtyControl value={mainCounts[product]} onChange={v => updateMain(product, v)} />
              </div>
            ))}
          </div>

          {/* Divider */}
          <div className="border-t border-white/10 my-6" />

          {/* Custom lines */}
          {customLines.length > 0 && (
            <div className="space-y-5 mb-5">
              {customLines.map((line, index) => (
                <div key={index} className="space-y-3">
                  <div className="flex gap-2 items-center">
                    <select
                      value={line.product}
                      onChange={e => updateCustomLine(index, 'product', e.target.value)}
                      className="flex-1 bg-white/10 text-white text-sm rounded-xl px-3 py-2.5 border border-white/10 focus:outline-none focus:border-purple-500 appearance-none"
                    >
                      <option value="" className="bg-slate-900">Seleccionar producto...</option>
                      {CUSTOM_PRODUCTS.map(p => (
                        <option key={p} value={p} className="bg-slate-900">{p}</option>
                      ))}
                    </select>
                    <button
                      onClick={() => removeCustomLine(index)}
                      className="w-8 h-8 flex items-center justify-center text-white/30 hover:text-red-400 transition-colors text-xl leading-none"
                    >
                      ×
                    </button>
                  </div>
                  <div className="flex justify-end">
                    <QtyControl value={line.qty} onChange={v => updateCustomLine(index, 'qty', v)} />
                  </div>
                  {index < customLines.length - 1 && (
                    <div className="border-t border-white/5" />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Add custom line */}
          <button
            onClick={addCustomLine}
            className="w-full py-3 rounded-xl border border-dashed border-white/15 text-white/40 hover:text-white/70 hover:border-white/30 transition-all text-sm mb-6"
          >
            + Agregar otro producto
          </button>

          {/* Add invoice button */}
          <button
            onClick={handleAddInvoice}
            disabled={!hasInput}
            className="w-full py-4 rounded-xl bg-gradient-to-r from-purple-600 to-violet-600 text-white font-bold text-sm tracking-widest uppercase hover:from-purple-500 hover:to-violet-500 active:scale-[0.98] transition-all disabled:opacity-25 disabled:cursor-not-allowed shadow-lg shadow-purple-900/50"
          >
            Agregar Factura
          </button>
        </div>

        {/* Clear all */}
        {(hasInput || hasSummary) && (
          <button
            onClick={handleClearAll}
            className="w-full py-3 rounded-xl bg-transparent border border-red-500/20 text-red-400/70 text-sm hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/40 transition-all"
          >
            Borrar todo y empezar de cero
          </button>
        )}

        {/* Summary */}
        {hasSummary && (
          <div className="bg-white/[0.05] backdrop-blur-xl rounded-2xl border border-white/10 p-6">
            <div className="flex justify-between items-baseline mb-5">
              <p className="text-purple-400 text-xs uppercase tracking-widest font-semibold">
                Resumen total
              </p>
              <span className="text-white/30 text-xs">{Object.keys(summary).length} productos</span>
            </div>

            <div className="space-y-3">
              {Object.entries(summary).map(([product, qty]) => (
                <div key={product} className="flex justify-between items-center gap-4">
                  <span className="text-white/70 text-sm leading-tight flex-1">{product}</span>
                  <span className="text-white font-black text-xl tabular-nums">{qty}</span>
                </div>
              ))}
            </div>

            <div className="border-t border-white/10 mt-5 pt-4 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-purple-300 font-semibold text-xs uppercase tracking-widest">Total unidades</span>
                <span className="text-white font-black text-3xl tabular-nums">{totalUnits}</span>
              </div>
              {totalKg > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-purple-300 font-semibold text-xs uppercase tracking-widest">Total kilos</span>
                  <span className="text-white font-black text-2xl tabular-nums">{totalKg.toFixed(1)} kg</span>
                </div>
              )}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
