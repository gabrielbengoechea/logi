import { totalCost } from '../sim/engine'
import { dayOf, useStore } from '../store'
import { SectionTitle } from './controls'
import { int, pct, usd } from './format'
import { IconTile } from './icons'

function Bar({ value, alert }: { value: number; alert: boolean }) {
  return (
    <span className="block h-1 rounded-full bg-[rgba(120,120,128,0.2)]">
      <span className="block h-1 rounded-full" style={{ width: `${Math.min(100, Math.round(value * 100))}%`, background: alert ? 'var(--alert)' : 'var(--accent)' }} />
    </span>
  )
}

/** "Hoy": ocupación, servicio de la última semana, camiones y costo del día. */
export default function Today() {
  const run = useStore((s) => s.run)
  const scenario = useStore((s) => s.scenario)
  const day = useStore((s) => dayOf(s.t))
  const d = run.days[day]
  const week = run.days.slice(Math.max(0, day - 6), day + 1)
  const requested = week.reduce((s, x) => s + x.requested, 0)
  const service = requested ? week.reduce((s, x) => s + x.shipped, 0) / requested : 1
  const due = week.reduce((s, x) => s + x.ordersDue, 0)
  const onTime = due ? week.reduce((s, x) => s + x.ordersOnTime, 0) / due : 1
  const occupancy = d.pallets / scenario.positions
  const trucksOut = d.shipments.reduce((s, x) => s + x.trucks, 0)
  const trucksIn = Math.ceil(d.palletsIn / 22)
  const closed = d.weekday >= 5
  return (
    <div>
      <SectionTitle>Hoy</SectionTitle>
      <div className="inset-list">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <IconTile name="pallet" slot={1} alert={occupancy > 0.95} />
          <div className="flex flex-1 flex-col gap-1.5">
            <span className="text-[15px]">Ocupación de la nave</span>
            <Bar value={occupancy} alert={occupancy > 0.95} />
          </div>
          <span className="w-14 text-right text-[15px] font-semibold tabular-nums">{pct(occupancy)}</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <IconTile name="check" slot={2} alert={service < 0.95} />
          <span className="flex flex-1 flex-col">
            <span className="text-[15px]">Nivel de servicio</span>
            <span className="text-[12.5px] text-[var(--ink-2)]">7 días · a tiempo {pct(onTime)}</span>
          </span>
          <span className="text-[15px] font-semibold tabular-nums" style={{ color: service < 0.95 ? 'var(--alert)' : undefined }}>
            {pct(service)}
          </span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <IconTile name="camion" slot={3} />
          <span className="flex-1 text-[15px]">Camiones</span>
          <span className="text-[15px] font-semibold tabular-nums">{closed ? 'cerrado' : `${trucksIn} entran · ${trucksOut} salen`}</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <IconTile name="persona" slot={4} alert={d.backlog > 0} />
          <span className="flex flex-1 flex-col">
            <span className="text-[15px]">Uso del personal</span>
            {d.backlog > 0 && <span className="text-[12.5px] text-[var(--alert)]">{d.backlog === 1 ? '1 pedido atrasado' : `${d.backlog} pedidos atrasados`}</span>}
          </span>
          <span className="text-[15px] font-semibold tabular-nums">{closed ? '—' : pct(d.hoursAvailable ? d.hoursNeeded / d.hoursAvailable : 0)}</span>
        </div>
        <div className="flex items-center gap-3 px-3 py-2.5">
          <IconTile name="dinero" slot={1} />
          <span className="flex flex-1 flex-col">
            <span className="text-[15px]">Costo logístico del día</span>
            <span className="text-[12.5px] text-[var(--ink-2)]">stock: {usd(d.stockValue)} · {int(d.pallets)} pallets</span>
          </span>
          <span className="text-[15px] font-semibold tabular-nums">{usd(totalCost(d.costs))}</span>
        </div>
      </div>
    </div>
  )
}
