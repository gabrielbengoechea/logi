import { useState, type ReactNode } from 'react'
import {
  G,
  canOrderLevels,
  canOrderQuantities,
  continuousReview,
  ctEoq,
  eoq,
  periodicReview,
  perPeriod,
  sensitivityQ,
  trc,
  type Criterion,
} from '../sim/course'
import { SectionTitle, Segmented } from './controls'

type Tab = 'eoq' | 'continua' | 'periodica' | 'canorder'
const TAB_LABEL: Record<Tab, string> = { eoq: 'EOQ', continua: 'Continua', periodica: 'Periódica', canorder: 'Can-order' }

const n2 = (v: number, d = 2) => (Number.isFinite(v) ? v.toLocaleString('es-UY', { minimumFractionDigits: d, maximumFractionDigits: d }) : '—')
const money = (v: number) => `$ ${n2(v)}`

/** Campo numérico que acepta coma decimal. */
function Field({ label, value, onChange, unit }: { label: string; value: number; onChange: (v: number) => void; unit?: string }) {
  const [text, setText] = useState(String(value).replace('.', ','))
  return (
    <label className="flex items-center justify-between gap-3 px-3 py-1.5">
      <span className="text-[14px]">{label}</span>
      <span className="flex items-center gap-1.5">
        <input
          inputMode="decimal"
          value={text}
          onChange={(e) => {
            setText(e.target.value)
            const raw = e.target.value.trim()
            const v = Number(raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw)
            if (Number.isFinite(v)) onChange(v)
          }}
          className="w-[86px] rounded-[8px] bg-[var(--fill)] px-2 py-1 text-right text-[14px] tabular-nums outline-none focus:ring-2 focus:ring-[var(--accent)]"
        />
        {unit && <span className="w-9 text-[12px] text-[var(--ink-2)]">{unit}</span>}
      </span>
    </label>
  )
}

function Out({ rows }: { rows: [string, string, string?][] }) {
  return (
    <div className="inset-list">
      {rows.map(([k, v, f]) => (
        <div key={k} className="px-3 py-1.5">
          <div className="flex justify-between gap-3 text-[14px]">
            <span>{k}</span>
            <span className="font-semibold tabular-nums">{v}</span>
          </div>
          {f && <div className="text-[11.5px] leading-snug text-[var(--ink-2)]">{f}</div>}
        </div>
      ))}
    </div>
  )
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <SectionTitle>{title}</SectionTitle>
      {children}
    </div>
  )
}

/** Criterio para k, como en el curso. */
function CriterionField({ value, onChange }: { value: Criterion; onChange: (c: Criterion) => void }) {
  const v = value.kind === 'nsc' ? value.nsc : value.kind === 'fr' ? value.fr : value.kind === 'cup' ? value.cup : value.b
  return (
    <div className="space-y-1 px-3 py-1.5">
      <Segmented
        items={['nsc', 'fr', 'cup', 'b'] as const}
        value={value.kind}
        onChange={(k) => onChange(k === 'nsc' ? { kind: k, nsc: 0.95 } : k === 'fr' ? { kind: k, fr: 0.98 } : k === 'cup' ? { kind: k, cup: 20 } : { kind: k, b: 100 })}
        label={(k) => ({ nsc: 'NSC', fr: 'FR', cup: 'c_up', b: 'B' })[k]}
        size="sm"
      />
      <Field
        key={value.kind}
        label={value.kind === 'nsc' ? 'NSC' : value.kind === 'fr' ? 'Fill rate' : value.kind === 'cup' ? 'c_up ($/u)' : 'B ($/faltante)'}
        value={v}
        onChange={(x) =>
          onChange(value.kind === 'nsc' ? { kind: 'nsc', nsc: x } : value.kind === 'fr' ? { kind: 'fr', fr: x } : value.kind === 'cup' ? { kind: 'cup', cup: x } : { kind: 'b', b: x })
        }
      />
    </div>
  )
}

/** Lote Económico de Compra, con el ejemplo del curso (D = 2.000, S = $500, h = 25 %, c = $50). */
function Eoq() {
  const [x, set] = useState({ D: 2000, S: 500, h: 0.25, c: 50 })
  const H = x.h * x.c
  const Q = eoq(x.D, x.S, H)
  return (
    <div className="space-y-4">
      <Block title="Datos">
        <div className="inset-list">
          <Field label="Demanda anual (D)" value={x.D} onChange={(D) => set({ ...x, D })} unit="u/año" />
          <Field label="Costo de pedir (S)" value={x.S} onChange={(S) => set({ ...x, S })} unit="$" />
          <Field label="Tasa de mantener (h)" value={x.h} onChange={(h) => set({ ...x, h })} unit="/año" />
          <Field label="Costo unitario (c)" value={x.c} onChange={(c) => set({ ...x, c })} unit="$" />
        </div>
      </Block>
      <Block title="Resultado">
        <Out
          rows={[
            ['H = h·c', money(H)],
            ['Q*', `${n2(Q, 0)} u`, 'Q* = √(2·D·S / H)'],
            ['Pedidos por año', n2(x.D / Q, 1), 'D / Q*'],
            ['Período entre pedidos (T)', `${n2(Q / x.D, 3)} años`, 'T = Q* / D'],
            ['Costo de pedir', money((x.S * x.D) / Q), 'S·D / Q'],
            ['Costo de mantener', money((H * Q) / 2), 'H·Q / 2'],
            ['CT', money(ctEoq(Q, x.D, x.S, H, x.c)), 'CT = c·D + S·D/Q + H·Q/2'],
          ]}
        />
      </Block>
      <Block title="Sensibilidad: pedir otra cantidad">
        <Out rows={[0.5, 0.75, 1.25, 1.5, 2].map((f) => [`Q = ${n2(Q * f, 0)} (${Math.round(f * 100)} %)`, `+${n2((sensitivityQ(Q * f, Q) - 1) * 100, 1)} %`, `TRC = ${money(trc(Q * f, x.D, x.S, H))}`] as [string, string, string])} />
      </Block>
    </div>
  )
}

/** Revisión continua: datos diarios (como el LT). */
function Continua() {
  const [x, set] = useState({ d: 42.64 / 7, sigmaD: 10.48 / Math.sqrt(7), LT: 36.27, sigmaLT: 3.63, D: 42.64 * 52, S: 500, h: 0.25, c: 50, cup: 20 })
  const [crit, setCrit] = useState<Criterion>({ kind: 'nsc', nsc: 0.95 })
  const r = continuousReview({ ...x, H: x.h * x.c, criterion: crit, cup: x.cup })
  return (
    <div className="space-y-4">
      <Block title="Datos (demanda en la unidad del LT)">
        <div className="inset-list">
          <Field label="Demanda media (d)" value={Math.round(x.d * 100) / 100} onChange={(d) => set({ ...x, d })} unit="u/día" />
          <Field label="Desvío de la demanda (σd)" value={Math.round(x.sigmaD * 100) / 100} onChange={(sigmaD) => set({ ...x, sigmaD })} unit="u/día" />
          <Field label="Lead time (LT)" value={x.LT} onChange={(LT) => set({ ...x, LT })} unit="días" />
          <Field label="Desvío del LT (σLT)" value={x.sigmaLT} onChange={(sigmaLT) => set({ ...x, sigmaLT })} unit="días" />
          <Field label="Demanda anual (D)" value={Math.round(x.D)} onChange={(D) => set({ ...x, D })} unit="u/año" />
          <Field label="Costo de pedir (S)" value={x.S} onChange={(S) => set({ ...x, S })} unit="$" />
          <Field label="Tasa de mantener (h)" value={x.h} onChange={(h) => set({ ...x, h })} unit="/año" />
          <Field label="Costo unitario (c)" value={x.c} onChange={(c) => set({ ...x, c })} unit="$" />
          <Field label="Costo por unidad perdida (c_up)" value={x.cup} onChange={(cup) => set({ ...x, cup })} unit="$" />
          <CriterionField value={crit} onChange={setCrit} />
        </div>
      </Block>
      <Block title="Política (s, Q)">
        <Out
          rows={[
            ['Q* (EOQ)', `${n2(r.Q, 0)} u`, 'Q* = √(2·D·S / H)'],
            ['σc', n2(r.sigmaC), 'σc = √(σd²·LT + d²·σLT²)'],
            ['k', n2(r.k, 4)],
            ['Stock de seguridad', `${n2(r.SS, 1)} u`, 'SS = k·σc'],
            ['ROP', `${n2(r.ROP, 1)} u`, 'ROP = d·LT + k·σc'],
            ['NSC resultante', `${n2(r.NSC * 100, 2)} %`, 'NSC = Φ(k)'],
            ['Fill rate resultante', `${n2(r.FR * 100, 2)} %`, `FR = 1 − G(k)·σc / Q; G(k) = ${n2(G(r.k), 4)}`],
            ['Costo total anual', money(r.TC), 'c·D + S·D/Q + H·(Q/2 + SS + D_LT) + c_up·σc·G(k)·D/Q'],
          ]}
        />
      </Block>
    </div>
  )
}

/** Revisión periódica con el ejemplo 1 de la unidad 2. */
function Periodica() {
  const [x, set] = useState({ Dm: 3400, Ds: 400, perYear: 52, LT: 1, sigmaLT: 0.07, R: 4, S: 550, h: 0.15, c: 75, cup: 20 })
  const [crit, setCrit] = useState<Criterion>({ kind: 'nsc', nsc: 0.95 })
  const { d, sigmaD } = perPeriod(x.Dm, x.Ds, x.perYear)
  const r = periodicReview({ d, sigmaD, LT: x.LT, sigmaLT: x.sigmaLT, R: x.R, D: x.Dm, S: x.S, H: x.h * x.c, c: x.c, criterion: crit, perYear: x.perYear, cup: x.cup })
  return (
    <div className="space-y-4">
      <Block title="Datos">
        <div className="inset-list">
          <Field label="Demanda anual, media" value={x.Dm} onChange={(Dm) => set({ ...x, Dm })} unit="u/año" />
          <Field label="Demanda anual, desvío" value={x.Ds} onChange={(Ds) => set({ ...x, Ds })} unit="u/año" />
          <Field label="Períodos por año" value={x.perYear} onChange={(perYear) => set({ ...x, perYear })} unit="sem" />
          <Field label="Lead time (LT)" value={x.LT} onChange={(LT) => set({ ...x, LT })} unit="sem" />
          <Field label="Desvío del LT (σLT)" value={x.sigmaLT} onChange={(sigmaLT) => set({ ...x, sigmaLT })} unit="sem" />
          <Field label="Período de revisión (R)" value={x.R} onChange={(R) => set({ ...x, R })} unit="sem" />
          <Field label="Costo de pedir (S)" value={x.S} onChange={(S) => set({ ...x, S })} unit="$" />
          <Field label="Tasa de mantener (h)" value={x.h} onChange={(h) => set({ ...x, h })} unit="/año" />
          <Field label="Costo unitario (c)" value={x.c} onChange={(c) => set({ ...x, c })} unit="$" />
          <CriterionField value={crit} onChange={setCrit} />
        </div>
      </Block>
      <Block title="Política (R, NOP)">
        <Out
          rows={[
            ['d y σd por semana', `${n2(d)} · ${n2(sigmaD)}`, 'media / períodos; desvío / √períodos'],
            ['σc', n2(r.sigmaC, 4), 'σc = √(σd²·(LT + R) + d²·σLT²)'],
            ['k', n2(r.k, 4)],
            ['Stock de seguridad', `${n2(r.SS, 1)} u`, 'SS = k·σc'],
            ['NOP', `${n2(r.NOP, 1)} u`, 'NOP = d·(LT + R) + k·σc'],
            ['D_R (pedido medio)', `${n2(r.DR, 1)} u`, 'D_R = d·R'],
            ['Costo de stock de ciclo', money(r.costs.cycleStock), 'H·D_R / 2'],
            ['Costo de stock de seguridad', money(r.costs.safetyStock), 'H·SS'],
            ['Costo de stock en tránsito', money(r.costs.transit), 'H·D_LT'],
            ['Costo de pedir', money(r.costs.ordering), 'S·D / D_R'],
            ['Fill rate resultante', `${n2(r.FR * 100, 2)} %`, 'FR = 1 − G(k)·σc / D_R'],
          ]}
        />
      </Block>
    </div>
  )
}

/** Can-order: niveles a partir de los datos y la regla de pedido con el ejemplo del curso. */
function CanOrder() {
  const [x, set] = useState({ d: 10, sigmaD: 4, LT: 7, sigmaLT: 1, D: 3650, S: 200, Ssaved: 180, h: 0.25, c: 20 })
  const lv = canOrderLevels({ ...x, H: x.h * x.c, perYear: 365, criterion: { kind: 'nsc', nsc: 0.95 } })
  const [items, setItems] = useState([
    { name: 'A', stock: 90, ROP: 100, COP: 160, OBS: 300 },
    { name: 'B', stock: 140, ROP: 100, COP: 180, OBS: 280 },
    { name: 'C', stock: 220, ROP: 120, COP: 190, OBS: 320 },
  ])
  const q = canOrderQuantities(items)
  return (
    <div className="space-y-4">
      <Block title="Regla de pedido (ejemplo del curso)">
        <div className="inset-list text-[13px]">
          <div className="flex px-3 py-1.5 font-semibold text-[var(--ink-2)]">
            <span className="w-8">Art.</span>
            <span className="flex-1 text-right">Stock</span>
            <span className="flex-1 text-right">ROP</span>
            <span className="flex-1 text-right">COP</span>
            <span className="flex-1 text-right">OBS</span>
            <span className="flex-1 text-right">Pedir</span>
          </div>
          {items.map((it, i) => (
            <div key={it.name} className="flex items-center px-3 py-1">
              <span className="w-8 font-semibold">{it.name}</span>
              {(['stock', 'ROP', 'COP', 'OBS'] as const).map((k) => (
                <input
                  key={k}
                  inputMode="numeric"
                  value={it[k]}
                  onChange={(e) => setItems(items.map((o, j) => (j === i ? { ...o, [k]: Number(e.target.value) || 0 } : o)))}
                  className="mx-0.5 w-0 flex-1 rounded-[6px] bg-[var(--fill)] px-1.5 py-0.5 text-right tabular-nums"
                />
              ))}
              <span className="flex-1 text-right font-semibold tabular-nums" style={{ color: q[i] ? 'var(--accent)' : 'var(--ink-3)' }}>
                {q[i]}
              </span>
            </div>
          ))}
        </div>
        <p className="mt-2 px-1 text-[12px] leading-snug text-[var(--ink-2)]">
          Si algún artículo está bajo su ROP se emite la orden; se suman los que están bajo su COP y cada uno pide hasta OBS.
        </p>
      </Block>
      <Block title="Niveles de un artículo">
        <div className="inset-list">
          <Field label="Demanda media (d)" value={x.d} onChange={(d) => set({ ...x, d })} unit="u/día" />
          <Field label="Desvío (σd)" value={x.sigmaD} onChange={(sigmaD) => set({ ...x, sigmaD })} unit="u/día" />
          <Field label="LT" value={x.LT} onChange={(LT) => set({ ...x, LT })} unit="días" />
          <Field label="σLT" value={x.sigmaLT} onChange={(sigmaLT) => set({ ...x, sigmaLT })} unit="días" />
          <Field label="Demanda anual (D)" value={x.D} onChange={(D) => set({ ...x, D })} unit="u/año" />
          <Field label="Costo de pedir (S)" value={x.S} onChange={(S) => set({ ...x, S })} unit="$" />
          <Field label="S ahorrado al sumarse" value={x.Ssaved} onChange={(Ssaved) => set({ ...x, Ssaved })} unit="$" />
          <Field label="Tasa de mantener (h)" value={x.h} onChange={(h) => set({ ...x, h })} unit="/año" />
          <Field label="Costo unitario (c)" value={x.c} onChange={(c) => set({ ...x, c })} unit="$" />
        </div>
        <div className="mt-3">
          <Out
            rows={[
              ['Q* (EOQ)', `${n2(lv.Q, 0)} u`],
              ['ROP (NSC 95 %)', `${n2(lv.ROP, 1)} u`, 'ROP = d·LT + k·σc'],
              ['Tiempo de aproximación', `${n2(lv.approach, 1)} días`, 'S_ahorrado / (H_t·Q), H_t = H / 365'],
              ['COP', `${n2(lv.COP, 1)} u`, 'COP = ROP + d·tiempo de aproximación'],
              ['OBS', `${n2(lv.OBS, 1)} u`, 'OBS = ROP + Q'],
            ]}
          />
        </div>
      </Block>
    </div>
  )
}

/** Calculadora con los modelos del curso y sus ejemplos cargados. */
export default function Calculator() {
  const [tab, setTab] = useState<Tab>('eoq')
  return (
    <div className="space-y-4">
      <Segmented items={['eoq', 'continua', 'periodica', 'canorder'] as Tab[]} value={tab} onChange={setTab} label={(t) => TAB_LABEL[t]} size="sm" />
      {tab === 'eoq' && <Eoq />}
      {tab === 'continua' && <Continua />}
      {tab === 'periodica' && <Periodica />}
      {tab === 'canorder' && <CanOrder />}
      <p className="px-1 text-[12px] leading-snug text-[var(--ink-3)]">
        Fórmulas y ejemplos de las unidades del curso. La demanda media y su desvío van en la unidad del lead time.
      </p>
    </div>
  )
}
