import { useState } from 'react'
import { COST_LABELS, type Costs } from '../sim/engine'
import type { Summary } from '../sim/summary'
import { useStore } from '../store'
import { SectionTitle } from './controls'
import { int, pct1, usd } from './format'

interface Line {
  label: string
  value: (s: Summary) => number
  format: (v: number) => string
  /** Si subir es bueno (verde) o malo (rojo). */
  better: 'up' | 'down'
}

const pp = (v: number) => pct1(v)

const LINES: Line[] = [
  { label: 'Resultado (margen − costos)', value: (s) => s.result, format: usd, better: 'up' },
  { label: 'Fill rate total', value: (s) => s.fill, format: pp, better: 'up' },
  { label: 'Fill rate clase A', value: (s) => s.fillByClass[0], format: pp, better: 'up' },
  { label: 'Fill rate clase B', value: (s) => s.fillByClass[1], format: pp, better: 'up' },
  { label: 'Fill rate clase C', value: (s) => s.fillByClass[2], format: pp, better: 'up' },
  { label: 'NSC medido A', value: (s) => s.nscByClass[0], format: pp, better: 'up' },
  { label: 'NSC medido B', value: (s) => s.nscByClass[1], format: pp, better: 'up' },
  { label: 'NSC medido C', value: (s) => s.nscByClass[2], format: pp, better: 'up' },
  { label: 'Pedidos a tiempo', value: (s) => s.onTime, format: pp, better: 'up' },
  { label: 'Ventas perdidas', value: (s) => s.lostSales, format: usd, better: 'down' },
  { label: 'Stock promedio', value: (s) => s.stockValueAvg, format: usd, better: 'down' },
  { label: 'Ocupación media de la nave', value: (s) => s.occupancyAvg, format: pp, better: 'down' },
  { label: 'Días sin lugar en la nave', value: (s) => s.overflowDays, format: (v) => int(v), better: 'down' },
  { label: 'Órdenes de compra', value: (s) => s.purchaseOrders, format: (v) => int(v), better: 'down' },
  { label: 'Costo logístico total', value: (s) => s.logisticsCost, format: usd, better: 'down' },
]

function Delta({ now, base, line }: { now: number; base: number; line: Line }) {
  const d = now - base
  if (Math.abs(d) < 1e-9 || Math.abs(d) < Math.abs(base) * 1e-4) return <span className="text-[var(--ink-3)]">=</span>
  const good = (d > 0) === (line.better === 'up')
  const txt = line.format === pp ? `${d > 0 ? '+' : '−'}${(Math.abs(d) * 100).toFixed(1).replace('.', ',')} pp` : `${d > 0 ? '+' : '−'}${line.format(Math.abs(d)).replace('USD ', '')}`
  return <span style={{ color: good ? '#248a3d' : 'var(--alert)' }}>{txt}</span>
}

/** Resultados del año simulado, comparados con la base. */
export default function Results() {
  const now = useStore((s) => s.run.summary)
  const base = useStore((s) => s.base.summary)
  const [costs, setCosts] = useState(false)
  return (
    <div>
      <SectionTitle>Resultados del año</SectionTitle>
      <div className="inset-list text-[13.5px]">
        <div className="flex px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-2)]">
          <span className="flex-1" />
          <span className="w-[84px] text-right">Ahora</span>
          <span className="w-[72px] text-right">vs. base</span>
        </div>
        {LINES.map((l) => (
          <div key={l.label} className="flex items-center px-3 py-1.5">
            <span className="flex-1">{l.label}</span>
            <span className="w-[84px] text-right font-semibold tabular-nums">{l.format(l.value(now))}</span>
            <span className="w-[72px] text-right text-[12.5px] tabular-nums">
              <Delta now={l.value(now)} base={l.value(base)} line={l} />
            </span>
          </div>
        ))}
        <button onClick={() => setCosts(!costs)} className="flex w-full items-center px-3 py-2 text-left text-[var(--accent)]">
          {costs ? 'Ocultar' : 'Ver'} costos por rubro
        </button>
        {costs &&
          (Object.keys(COST_LABELS) as (keyof Costs)[]).map((k) => (
            <div key={k} className="flex items-center px-3 py-1.5 text-[13px]">
              <span className="flex-1 text-[var(--ink-2)]">{COST_LABELS[k]}</span>
              <span className="w-[84px] text-right tabular-nums">{usd(now.costs[k])}</span>
              <span className="w-[72px] text-right text-[12px] tabular-nums">
                <Delta now={now.costs[k]} base={base.costs[k]} line={{ label: k, value: () => 0, format: usd, better: 'down' }} />
              </span>
            </div>
          ))}
      </div>
      <p className="mt-2 px-1 text-[12px] leading-snug text-[var(--ink-3)]">
        Un año (52 semanas). NSC medido: ciclos de reposición sin ningún faltante. Costos estimados en USD.
      </p>
    </div>
  )
}
