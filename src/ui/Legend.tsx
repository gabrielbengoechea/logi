import { FAMILIES } from '../sim/catalog'
import { ABC_COLORS } from '../scene/Racks'
import { dayOf, useStore } from '../store'
import { SectionTitle, Segmented } from './controls'
import { int } from './format'

const ABC_LABEL = { A: 'A · mucha rotación', B: 'B · rotación media', C: 'C · poca rotación' }

/** Qué hay en la nave: pallets por familia o por clase ABC, con el color que tienen en la escena. */
export default function Legend() {
  const run = useStore((s) => s.run)
  const day = useStore((s) => dayOf(s.t))
  const mode = useStore((s) => s.colorMode)
  const setMode = useStore((s) => s.setColorMode)
  const pallets = run.days[day].palletsBySku
  const rows =
    mode === 'familia'
      ? FAMILIES.map((f) => ({ key: f.key, label: f.label, color: f.color, n: run.products.filter((p) => p.family === f.key).reduce((s, p) => s + pallets[p.id], 0) }))
      : (['A', 'B', 'C'] as const).map((c) => ({
          key: c,
          label: `${ABC_LABEL[c]} (${run.products.filter((p) => p.abc === c).length})`,
          color: ABC_COLORS[c],
          n: run.products.filter((p) => p.abc === c).reduce((s, p) => s + pallets[p.id], 0),
        }))
  return (
    <div>
      <SectionTitle>Mercadería</SectionTitle>
      <div className="mb-2">
        <Segmented items={['familia', 'abc'] as const} value={mode} onChange={setMode} label={(m) => (m === 'familia' ? 'Por familia' : 'Por clase ABC')} size="sm" />
      </div>
      <div className="inset-list">
        {rows.map((r) => (
          <div key={r.key} className="flex items-center gap-3 px-3 py-2 text-[14px]">
            <span className="h-3.5 w-3.5 shrink-0 rounded-[4px]" style={{ background: r.color }} />
            <span className="flex-1">{r.label}</span>
            <span className="tabular-nums text-[var(--ink-2)]">{int(r.n)} pallets</span>
          </div>
        ))}
      </div>
      <p className="mt-2 px-1 text-[12.5px] leading-snug text-[var(--ink-3)]">Tocá un pallet para ver su producto.</p>
    </div>
  )
}
