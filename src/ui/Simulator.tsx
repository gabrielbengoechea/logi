import { useState } from 'react'
import type { AbcClass } from '../sim/catalog'
import type { Decisions, Model, Policy, Scenario, ServiceCriterion } from '../sim/engine'
import { useStore } from '../store'
import { Row, SectionTitle, Segmented, Stepper, Toggle } from './controls'
import Results from './Results'

const MODEL_LABEL: Record<Model, string> = { continua: 'Continua', periodica: 'Periódica', canorder: 'Can-order' }
const CRIT_LABEL: Record<ServiceCriterion['kind'], string> = { nsc: 'NSC', fr: 'Fill rate', cup: 'c_up', b: 'B' }

/** Recordatorio de la política con la notación del curso. */
function formula(p: Policy) {
  const lot = p.lot === 'eoq' ? 'Q = Q* = √(2·D·S/H)' : `Q = d·${p.coverDays} días`
  if (p.model === 'periodica') return `Cada R = ${p.R} días, pedir NOP − posición. NOP = d·(LT + R) + k·σc, con σc = √(σd²·(LT + R) + d²·σLT²).`
  if (p.model === 'canorder') return `Si un producto del proveedor baja del ROP, se emite la orden y se suman los que están bajo su COP; cada uno pide hasta OBS. ROP = d·LT + k·σc, COP = ROP + d·S_ahorrado/(H_t·Q), OBS = ROP + Q, ${lot}.`
  return `Cuando la posición cae al ROP, pedir Q. ROP = d·LT + k·σc, σc = √(σd²·LT + d²·σLT²), ${lot}.`
}

function criterionDetail(c: ServiceCriterion) {
  if (c.kind === 'nsc') return 'k = DISTR.NORM.ESTAND.INV(NSC)'
  if (c.kind === 'fr') return 'G(k) = (1 − FR)·Q / σc'
  if (c.kind === 'cup') return 'k = DISTR.NORM.ESTAND.INV(1 − Q·H/(D·c_up)); c_up = margen + penalización'
  return 'k = √(2·ln(B·D / (H·Q·σc·√(2π))))'
}

/** Política de una clase ABC: modelo, criterio para k y lote o período de revisión. */
function PolicyEditor({ policy, onChange }: { policy: Policy; onChange: (p: Policy) => void }) {
  const c = policy.criterion
  const setCrit = (kind: ServiceCriterion['kind']) =>
    onChange({ ...policy, criterion: kind === 'nsc' ? { kind, nsc: 0.95 } : kind === 'fr' ? { kind, fr: 0.98 } : kind === 'b' ? { kind, b: 300 } : { kind: 'cup' } })
  return (
    <div className="space-y-2">
      <Segmented items={['continua', 'periodica', 'canorder'] as Model[]} value={policy.model} onChange={(model) => onChange({ ...policy, model })} label={(m) => MODEL_LABEL[m]} size="sm" />
      <div className="inset-list">
        <div className="space-y-2 px-3 py-2.5">
          <div className="flex items-center justify-between">
            <span className="text-[15px]">Criterio para k</span>
          </div>
          <Segmented items={['nsc', 'fr', 'cup', 'b'] as ServiceCriterion['kind'][]} value={c.kind} onChange={setCrit} label={(k) => CRIT_LABEL[k]} size="sm" />
          <p className="text-[12px] leading-snug text-[var(--ink-2)]">{criterionDetail(c)}</p>
        </div>
        {c.kind === 'nsc' && (
          <Row label="Nivel de servicio de ciclo">
            <Stepper label="NSC" value={c.nsc * 100} min={50} max={99.5} step={0.5} format={(v) => `${v.toString().replace('.', ',')} %`} onChange={(v) => onChange({ ...policy, criterion: { kind: 'nsc', nsc: v / 100 } })} />
          </Row>
        )}
        {c.kind === 'fr' && (
          <Row label="Fill rate objetivo">
            <Stepper label="fill rate" value={c.fr * 100} min={80} max={99.9} step={0.1} format={(v) => `${v.toFixed(1).replace('.', ',')} %`} onChange={(v) => onChange({ ...policy, criterion: { kind: 'fr', fr: v / 100 } })} />
          </Row>
        )}
        {c.kind === 'b' && (
          <Row label="Costo por faltante (B)" detail="Por cada vez que falta stock">
            <Stepper label="B" value={c.b} min={0} max={3000} step={50} format={(v) => `USD ${v}`} onChange={(v) => onChange({ ...policy, criterion: { kind: 'b', b: v } })} />
          </Row>
        )}
        {policy.model === 'periodica' ? (
          <Row label="Período de revisión (R)">
            <Stepper label="R" value={policy.R} min={1} max={60} format={(v) => `${v} días`} onChange={(R) => onChange({ ...policy, R })} />
          </Row>
        ) : (
          <>
            <Row label="Lote">
              <div className="w-[150px]">
                <Segmented items={['eoq', 'cover'] as const} value={policy.lot} onChange={(lot) => onChange({ ...policy, lot })} label={(l) => (l === 'eoq' ? 'Q*' : 'Cobertura')} size="sm" />
              </div>
            </Row>
            {policy.lot === 'cover' && (
              <Row label="Días de cobertura">
                <Stepper label="días de cobertura" value={policy.coverDays} min={1} max={120} format={(v) => `${v} días`} onChange={(coverDays) => onChange({ ...policy, coverDays })} />
              </Row>
            )}
          </>
        )}
      </div>
      <p className="px-1 text-[12px] leading-snug text-[var(--ink-2)]">{formula(policy)}</p>
    </div>
  )
}

const pct = (v: number) => `${Math.round(v)} %`

/** Decisiones del centro logístico: política por clase, operación de la nave y transporte. */
export function DecisionsEditor({ dec, onChange, reference }: { dec: Decisions; onChange: (d: Decisions) => void; reference: Decisions }) {
  const [cls, setCls] = useState<AbcClass>('A')
  const freqShift = (dir: number) => onChange({ ...dec, frequency: reference.frequency.map((f) => ([1, 2, 3, 5] as const)[Math.min(3, Math.max(0, [1, 2, 3, 5].indexOf(f) + dir))]) })
  const freqValue = JSON.stringify(dec.frequency) === JSON.stringify(reference.frequency) ? 0 : dec.frequency[3] < reference.frequency[3] ? -1 : 1
  return (
    <>
      <div>
        <SectionTitle>Política de inventario por clase</SectionTitle>
        <div className="mb-2">
          <Segmented items={['A', 'B', 'C'] as AbcClass[]} value={cls} onChange={setCls} label={(c) => `Clase ${c}`} />
        </div>
        <PolicyEditor policy={dec.policy[cls]} onChange={(p) => onChange({ ...dec, policy: { ...dec.policy, [cls]: p } })} />
      </div>

      <div>
        <SectionTitle>Operación de la nave</SectionTitle>
        <div className="inset-list">
          <Row label="Turnos" detail={dec.shifts === 1 ? '6 a 14 h' : dec.shifts === 2 ? '6 a 22 h' : 'las 24 h'}>
            <div className="w-[120px]">
              <Segmented items={[1, 2, 3] as const} value={dec.shifts} onChange={(shifts) => onChange({ ...dec, shifts })} label={String} size="sm" />
            </div>
          </Row>
          <Row label="Operarios por turno">
            <Stepper label="operarios" value={dec.operatorsPerShift} min={2} max={40} onChange={(operatorsPerShift) => onChange({ ...dec, operatorsPerShift })} />
          </Row>
          <Row label="Autoelevadores">
            <Stepper label="autoelevadores" value={dec.forklifts} min={1} max={16} onChange={(forklifts) => onChange({ ...dec, forklifts })} />
          </Row>
          <Row label="Horas extra" detail="Hasta 2 h por operario, al doble">
            <Toggle on={dec.overtime} onChange={(overtime) => onChange({ ...dec, overtime })} label="Horas extra" />
          </Row>
        </div>
      </div>

      <div>
        <SectionTitle>Transporte</SectionTitle>
        <div className="inset-list">
          <Row label="Camiones propios" detail="El resto va con fletes">
            <Stepper label="camiones propios" value={dec.ownTrucks} min={0} max={30} onChange={(ownTrucks) => onChange({ ...dec, ownTrucks })} />
          </Row>
          <div className="space-y-2 px-3 py-2.5">
            <span className="text-[15px]">Frecuencia de entrega</span>
            <Segmented items={[-1, 0, 1] as const} value={freqValue} onChange={freqShift} label={(v) => (v < 0 ? 'Menos seguido' : v > 0 ? 'Más seguido' : 'Actual')} size="sm" />
          </div>
        </div>
      </div>
    </>
  )
}

/**
 * Modo simulador: se cambian las políticas, la operación, el transporte o el escenario, se simula el año y se compara
 * contra la base guardada.
 */
export default function Simulator() {
  const stored = useStore((s) => s.decisions)
  const storedScenario = useStore((s) => s.scenario)
  const running = useStore((s) => s.running)
  const inGame = useStore((s) => s.game !== null)
  const { apply, setBase, restoreBase } = useStore.getState()
  const [dec, setDec] = useState<Decisions>(stored)
  const [sc, setSc] = useState<Scenario>(storedScenario)
  const dirty = JSON.stringify(dec) !== JSON.stringify(stored) || JSON.stringify(sc) !== JSON.stringify(storedScenario)
  const tariff = (k: keyof Scenario['tariffs'], v: number | boolean) => setSc({ ...sc, tariffs: { ...sc.tariffs, [k]: v } })

  return (
    <div className="space-y-5">
      <DecisionsEditor dec={dec} onChange={setDec} reference={stored} />

      <div>
        <SectionTitle>Escenario</SectionTitle>
        <div className="inset-list">
          <Row label="Demanda">
            <Stepper label="demanda" value={sc.demandFactor * 100} min={50} max={160} step={10} format={pct} onChange={(v) => setSc({ ...sc, demandFactor: v / 100 })} />
          </Row>
          <Row label="Variabilidad de la demanda">
            <Stepper label="variabilidad" value={sc.variability * 100} min={25} max={250} step={25} format={pct} onChange={(v) => setSc({ ...sc, variability: v / 100 })} />
          </Row>
          <Row label="Estacionalidad" detail="Verano, Navidad, Reyes, Día del niño">
            <Toggle on={sc.seasonality} onChange={(seasonality) => setSc({ ...sc, seasonality })} label="Estacionalidad" />
          </Row>
          <Row label="Demora de los importados">
            <Stepper label="demora" value={sc.importDelay * 100} min={50} max={250} step={25} format={pct} onChange={(v) => setSc({ ...sc, importDelay: v / 100 })} />
          </Row>
          <Row label="Precio del gasoil">
            <Stepper label="gasoil" value={sc.fuel * 100} min={50} max={200} step={10} format={pct} onChange={(v) => setSc({ ...sc, fuel: v / 100 })} />
          </Row>
          <div className="space-y-2 px-3 py-2.5">
            <span className="text-[15px]">Si falta stock</span>
            <Segmented items={['lost', 'backorder'] as const} value={sc.shortage} onChange={(shortage) => setSc({ ...sc, shortage })} label={(v) => (v === 'lost' ? 'Venta perdida' : 'Queda pendiente')} size="sm" />
          </div>
        </div>
      </div>

      <div>
        <SectionTitle>Costos</SectionTitle>
        <div className="inset-list">
          <Row label="Tasa de mantener (h)" detail="H = h·c">
            <Stepper label="h" value={Math.round(sc.tariffs.holdingRate * 100)} min={5} max={50} format={pct} onChange={(v) => tariff('holdingRate', v / 100)} />
          </Row>
          <Row label="Sumar el espacio a H" detail="Alquiler de la posición de pallet">
            <Toggle on={sc.tariffs.spaceInH} onChange={(v) => tariff('spaceInH', v)} label="Espacio en H" />
          </Row>
          <Row label="Costo de pedir (S), local">
            <Stepper label="S local" value={sc.tariffs.orderLocal} min={10} max={500} step={10} format={(v) => `USD ${v}`} onChange={(v) => tariff('orderLocal', v)} />
          </Row>
          <Row label="Costo de pedir (S), importación">
            <Stepper label="S importación" value={sc.tariffs.orderImport} min={50} max={1500} step={50} format={(v) => `USD ${v}`} onChange={(v) => tariff('orderImport', v)} />
          </Row>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          disabled={!dirty || running || inGame}
          onClick={() => apply(dec, sc)}
          className="h-11 flex-1 rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {running ? 'Simulando…' : 'Simular el año'}
        </button>
      </div>
      {inGame && <p className="px-1 text-[12.5px] leading-snug text-[var(--alert)]">Hay una partida del modo juego en curso: cerrala para volver a simular el año.</p>}
      <div className="flex gap-2">
        <button disabled={dirty || running} onClick={setBase} className="h-9 flex-1 rounded-[10px] bg-[var(--fill)] text-[14px] font-semibold text-[var(--accent)] disabled:opacity-40">
          Fijar como base
        </button>
        <button
          disabled={running}
          onClick={() => {
            const b = useStore.getState().base
            setDec(b.decisions)
            setSc(b.scenario)
            restoreBase()
          }}
          className="h-9 flex-1 rounded-[10px] bg-[var(--fill)] text-[14px] font-semibold text-[var(--accent)] disabled:opacity-40"
        >
          Volver a la base
        </button>
      </div>
      <Results />
    </div>
  )
}
