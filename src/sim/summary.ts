import { emptyCosts, totalCost, type Costs, type DayStats, type Scenario } from './engine'

/** Indicadores de un período simulado (por defecto, todo). */
export interface Summary {
  days: number
  /** Fill rate: unidades entregadas sobre pedidas, total y por clase A, B, C. */
  fill: number
  fillByClass: [number, number, number]
  /** Nivel de servicio de ciclo medido: ciclos de reposición sin faltantes, por clase. */
  nscByClass: [number, number, number]
  onTime: number
  occupancyAvg: number
  occupancyMax: number
  /** Días en que la nave no alcanzó y hubo que usar depósito externo. */
  overflowDays: number
  stockValueAvg: number
  costs: Costs
  logisticsCost: number
  revenue: number
  cogs: number
  grossMargin: number
  lostSales: number
  /** Resultado: margen bruto menos costos logísticos. */
  result: number
  purchaseOrders: number
  km: number
  trucks: number
  ownTrucks: number
  truckFill: number
}

export function summarize(days: DayStats[], scenario: Scenario, from = 0, to = days.length): Summary {
  const ds = days.slice(from, to)
  const sum = (f: (d: DayStats) => number) => ds.reduce((s, d) => s + f(d), 0)
  const ratio = (a: number, b: number, empty = 1) => (b > 0 ? a / b : empty)
  const costs = emptyCosts()
  for (const d of ds) for (const k of Object.keys(costs) as (keyof Costs)[]) costs[k] += d.costs[k]
  const work = ds.filter((d) => d.weekday < 5)
  const revenue = sum((d) => d.revenue)
  const cogs = sum((d) => d.cogs)
  const logisticsCost = totalCost(costs)
  const byClass = (f: (d: DayStats, i: number) => number, g: (d: DayStats, i: number) => number, inverse = false) =>
    [0, 1, 2].map((i) => {
      const r = ratio(sum((d) => f(d, i)), sum((d) => g(d, i)), inverse ? 0 : 1)
      return inverse ? 1 - r : r
    }) as [number, number, number]
  return {
    days: ds.length,
    fill: ratio(sum((d) => d.shipped), sum((d) => d.requested)),
    fillByClass: byClass((d, i) => d.shippedByClass[i], (d, i) => d.requestedByClass[i]),
    nscByClass: byClass((d, i) => d.cyclesShort[i], (d, i) => d.cycles[i], true),
    onTime: ratio(sum((d) => d.ordersOnTime), sum((d) => d.ordersDue)),
    occupancyAvg: sum((d) => d.pallets) / Math.max(1, ds.length) / scenario.positions,
    occupancyMax: Math.max(0, ...ds.map((d) => d.pallets)) / scenario.positions,
    overflowDays: ds.filter((d) => d.pallets > scenario.positions).length,
    stockValueAvg: sum((d) => d.stockValue) / Math.max(1, ds.length),
    costs,
    logisticsCost,
    revenue,
    cogs,
    grossMargin: revenue - cogs,
    lostSales: sum((d) => d.lostSales),
    result: revenue - cogs - logisticsCost,
    purchaseOrders: sum((d) => d.purchaseOrders),
    km: sum((d) => d.km),
    trucks: sum((d) => d.shipments.reduce((s, x) => s + x.trucks, 0)),
    ownTrucks: sum((d) => d.shipments.reduce((s, x) => s + x.own, 0)),
    truckFill: work.length ? work.reduce((s, d) => s + d.truckFill, 0) / work.length : 0,
  }
}
