import { CLIENTS } from '../sim/clients'
import { dayOf, useStore } from '../store'
import { SectionTitle } from './controls'
import { int, usd } from './format'

const FREQ = { 1: '1 vez', 2: '2 veces', 3: '3 veces', 5: 'todos los días' } as const

/** Entregas del día por cliente: camiones propios y fletes, pallets y kilómetros; y la frecuencia semanal. */
export default function Deliveries() {
  const run = useStore((s) => s.run)
  const decisions = useStore((s) => s.decisions)
  const day = useStore((s) => dayOf(s.t))
  const d = run.days[day]
  const own = d.shipments.reduce((s, x) => s + x.own, 0)
  const total = d.shipments.reduce((s, x) => s + x.trucks, 0)
  const byClient = new Map(d.shipments.map((s) => [s.client, s]))
  return (
    <div className="space-y-4">
      <div>
        <SectionTitle>Hoy</SectionTitle>
        <div className="inset-list">
          <div className="flex justify-between px-3 py-2.5 text-[15px]">
            <span>Camiones despachados</span>
            <span className="font-semibold tabular-nums">{d.weekday >= 5 ? 'cerrado' : `${total} (${own} propios)`}</span>
          </div>
          <div className="flex justify-between px-3 py-2.5 text-[15px]">
            <span>Kilómetros</span>
            <span className="font-semibold tabular-nums">{int(d.km)} km</span>
          </div>
          <div className="flex justify-between px-3 py-2.5 text-[15px]">
            <span>Costo de transporte</span>
            <span className="font-semibold tabular-nums">{usd(d.costs.fleet + d.costs.fuel + d.costs.hired)}</span>
          </div>
          <div className="flex justify-between px-3 py-2.5 text-[15px]">
            <span>Llenado de los camiones</span>
            <span className="font-semibold tabular-nums">{Math.round(d.truckFill * 100)} %</span>
          </div>
        </div>
      </div>
      <div>
        <SectionTitle>Clientes</SectionTitle>
        <div className="inset-list">
          {CLIENTS.map((c, i) => {
            const s = byClient.get(i)
            return (
              <div key={c.key} className="flex items-center gap-3 px-3 py-2 text-[14px]">
                <span className="flex flex-1 flex-col">
                  <span>{c.name}</span>
                  <span className="text-[12px] text-[var(--ink-2)]">
                    {c.km} km · {FREQ[decisions.frequency[i]]} por semana
                  </span>
                </span>
                <span className="text-right text-[13px] tabular-nums text-[var(--ink-2)]">
                  {s ? (
                    <>
                      <span className="font-semibold text-[var(--ink)]">{s.pallets} pallets</span>
                      <br />
                      {s.trucks} {s.trucks === 1 ? 'camión' : 'camiones'}
                      {s.trucks - s.own > 0 ? ` · ${s.trucks - s.own} flete${s.trucks - s.own > 1 ? 's' : ''}` : ''}
                    </>
                  ) : (
                    'sin entrega'
                  )}
                </span>
              </div>
            )
          })}
        </div>
        <p className="mt-2 px-1 text-[12px] leading-snug text-[var(--ink-3)]">
          En el mapa: azul marino, camiones propios; naranja, fletes. Distancias por la red vial (Overture / OpenStreetMap).
        </p>
      </div>
    </div>
  )
}
