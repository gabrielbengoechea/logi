import { describe, expect, it } from 'vitest'
import { generateCatalog } from './catalog'
import { BASE_DECISIONS, BASE_SCENARIO, Simulation, totalCost, zFor, type Decisions, type Scenario } from './engine'

const DAYS = 140

function run(sc: Partial<Scenario> = {}, dec: Partial<Decisions> = {}, days = DAYS) {
  const sim = new Simulation({ ...BASE_SCENARIO, ...sc }, { ...BASE_DECISIONS, ...dec })
  const out = sim.run(days)
  const sum = (f: (d: (typeof out)[number]) => number) => out.reduce((s, d) => s + f(d), 0)
  return {
    sim,
    fill: sum((d) => d.shipped) / sum((d) => d.requested),
    onTime: sum((d) => d.ordersOnTime) / sum((d) => d.ordersDue),
    lost: sum((d) => d.lostSales),
    stock: sum((d) => d.stockValue) / out.length,
    hired: sum((d) => d.costs.hired),
    cost: sum((d) => totalCost(d.costs)),
    out,
  }
}

describe('catálogo', () => {
  it('es el mismo para la misma semilla y cambia con otra', () => {
    expect(generateCatalog(3)).toEqual(generateCatalog(3))
    expect(generateCatalog(3)[0].name === generateCatalog(4)[0].name && generateCatalog(3)[5].cost === generateCatalog(4)[5].cost).toBe(false)
  })

  it('pocos productos concentran la mayor parte del valor (ABC)', () => {
    const cat = generateCatalog(1)
    const a = cat.filter((p) => p.abc === 'A').length / cat.length
    expect(a).toBeGreaterThan(0.1)
    expect(a).toBeLessThan(0.35)
    expect(cat.filter((p) => p.abc === 'C').length).toBeGreaterThan(cat.length * 0.35)
  })

  it('el volumen total coincide con los pallets por día pedidos', () => {
    const cat = generateCatalog(1, 240, 150)
    expect(cat.reduce((s, p) => s + p.dailyDemand / p.unitsPerPallet, 0)).toBeCloseTo(150, 6)
  })
})

describe('simulación', () => {
  it('es determinista', () => {
    const a = run({}, {}, 60)
    const b = run({}, {}, 60)
    expect(a.out.map((d) => d.shipped)).toEqual(b.out.map((d) => d.shipped))
  })

  it('la demanda no depende de las decisiones (competencia justa entre grupos)', () => {
    const a = run({}, {}, 30).sim
    const b = run({}, { operatorsPerShift: 3, frequency: BASE_DECISIONS.frequency.map(() => 1) }, 30).sim
    for (const [s, c, d] of [
      [0, 0, 5],
      [17, 3, 12],
      [200, 19, 29],
    ])
      expect(a.demand(s, c, d)).toBe(b.demand(s, c, d))
  })

  it('en condiciones normales atiende bien a los clientes', () => {
    const r = run()
    expect(r.fill).toBeGreaterThan(0.95)
    expect(r.onTime).toBeGreaterThan(0.97)
  })

  it('más nivel de servicio: menos faltantes y más stock', () => {
    const low = run({}, { policy: { A: { ...BASE_DECISIONS.policy.A, service: 0.8 }, B: { ...BASE_DECISIONS.policy.B, service: 0.8 }, C: { ...BASE_DECISIONS.policy.C, service: 0.8 } } })
    const high = run({}, { policy: { A: { ...BASE_DECISIONS.policy.A, service: 0.995 }, B: { ...BASE_DECISIONS.policy.B, service: 0.99 }, C: { ...BASE_DECISIONS.policy.C, service: 0.98 } } })
    expect(high.fill).toBeGreaterThan(low.fill)
    expect(high.stock).toBeGreaterThan(low.stock)
  })

  it('con poco personal, los pedidos salen tarde', () => {
    const r = run({}, { operatorsPerShift: 4, overtime: false })
    expect(r.onTime).toBeLessThan(0.9)
  })

  it('sin camiones propios, todo va con fletes', () => {
    const own = run({}, {}, 30)
    const none = run({}, { ownTrucks: 0 }, 30)
    expect(none.hired).toBeGreaterThan(own.hired)
    expect(none.out.every((d) => d.shipments.every((s) => s.own === 0))).toBe(true)
  })

  it('con pedidos pendientes no se pierden ventas', () => {
    const r = run({ shortage: 'backorder' }, {}, 60)
    expect(r.lost).toBe(0)
  })

  it('la revisión periódica también funciona', () => {
    const rs = { kind: 'RS' as const, service: 0.95, lot: 'eoq' as const, coverDays: 14, reviewDays: 7 }
    const r = run({}, { policy: { A: rs, B: rs, C: rs } })
    expect(r.fill).toBeGreaterThan(0.93)
  })
})

describe('fórmulas', () => {
  it('z del nivel de servicio', () => {
    expect(zFor(0.95)).toBeCloseTo(1.645, 2)
    expect(zFor(0.98)).toBeCloseTo(2.054, 2)
    expect(zFor(0.5)).toBeCloseTo(0, 2)
  })
})
