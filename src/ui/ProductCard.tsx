import { familyOf } from '../sim/catalog'
import { dayOf, useStore } from '../store'
import { int, money2 } from './format'
import { Icon } from './icons'

/** Pallets del producto a lo largo del período, con una marca en el día actual. */
function Spark({ values, at }: { values: number[]; at: number }) {
  const w = 300
  const h = 64
  const max = Math.max(1, ...values)
  const x = (i: number) => (i / (values.length - 1)) * w
  const y = (v: number) => h - 4 - (v / max) * (h - 10)
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="mt-1 h-16 w-full" aria-label="Pallets en stock a lo largo del año">
      <path d={`${line}L${w},${h}L0,${h}Z`} fill="var(--accent)" opacity={0.12} />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth={1.6} />
      <line x1={x(at)} x2={x(at)} y1={0} y2={h} stroke="var(--ink)" strokeWidth={1} strokeDasharray="3 3" />
      <circle cx={x(at)} cy={y(values[at])} r={3.5} fill="var(--ink)" />
    </svg>
  )
}

export default function ProductCard({ id }: { id: number }) {
  const run = useStore((s) => s.run)
  const day = useStore((s) => dayOf(s.t))
  const select = useStore((s) => s.select)
  const p = run.products[id]
  const fam = familyOf(p.family)
  const series = run.days.map((d) => d.palletsBySku[id])
  const rows: [string, string][] = [
    ['Código', p.code],
    ['Clase ABC', p.abc],
    ['Origen', p.imported ? `Importado · ${p.leadDays} días de demora` : `Proveedor local · ${p.leadDays} días`],
    ['Demanda media', `${int(p.dailyDemand)} u/día (${(p.dailyDemand / p.unitsPerPallet).toFixed(1).replace('.', ',')} pallets)`],
    ['Unidades por pallet', `${p.unitsPerPallet} (${p.casesPerPallet} cajas de ${p.unitsPerCase})`],
    ['Costo y precio', `${money2(p.cost)} · ${money2(p.price)}`],
    ['Pallets hoy', int(series[day])],
  ]
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold" style={{ color: fam.color }}>
            {fam.label}
          </div>
          <div className="text-[22px] leading-tight font-bold tracking-tight">{p.name}</div>
        </div>
        <button className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--fill)] text-[var(--ink-2)]" onClick={() => select(null)} aria-label="Cerrar">
          <Icon name="cerrar" size={13} stroke={3} />
        </button>
      </div>
      <div className="mt-3 rounded-[12px] bg-white px-3 pt-2 pb-1">
        <div className="text-[13px] font-semibold text-[var(--ink-2)]">Pallets en stock durante el año</div>
        <Spark values={series} at={day} />
      </div>
      <dl className="inset-list mt-3">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 px-3 py-2 text-[14px]">
            <dt className="text-[var(--ink-2)]">{k}</dt>
            <dd className="text-right font-medium tabular-nums">{v}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-3 rounded-xl bg-[#fff4e0] px-3 py-2.5 text-[13px] leading-snug text-[#7a4a00]">
        Producto genérico del catálogo simulado. En la nave se ven resaltados todos sus pallets.
      </p>
    </div>
  )
}
