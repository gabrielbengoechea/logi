import { describe, expect, it } from 'vitest'
import {
  G,
  Phi,
  canOrderQuantities,
  continuousReview,
  eoq,
  invG,
  invPhi,
  leadTimeByStages,
  perPeriod,
  periodicReview,
  sensitivityQ,
  trc,
} from './course'

describe('tabla normal del curso (k, P[u<k], G(k))', () => {
  const rows: [number, number, number][] = [
    [0, 0.5, 0.3989],
    [0.5, 0.6915, 0.1978],
    [1, 0.8413, 0.0833],
    [1.28, 0.8997, 0.0475],
    [1.64, 0.9495, 0.0211],
    [1.65, 0.9505, 0.0206],
    [1.67, 0.9525, 0.0197],
    [1.96, 0.975, 0.0094],
    [2.33, 0.9901, 0.0034],
    [-1, 0.1587, 1.0833],
  ]
  it.each(rows)('k = %f', (k, p, g) => {
    expect(Phi(k)).toBeCloseTo(p, 4)
    expect(G(k)).toBeCloseTo(g, 4)
  })
  it('G(3,00) = 0,000382 y la inversa de G', () => {
    expect(G(3)).toBeCloseTo(0.000382, 6)
    expect(invG(0.0197)).toBeCloseTo(1.67, 2)
  })
  it('DISTR.NORM.ESTAND.INV', () => {
    expect(invPhi(0.9)).toBeCloseTo(1.2816, 4)
    expect(invPhi(0.95)).toBeCloseTo(1.6449, 4)
    expect(invPhi(0.99)).toBeCloseTo(2.3263, 4)
  })
})

describe('Lote Económico de Compra', () => {
  // D = 2.000 u/año, S = $500 por orden, H = 25 % de $50.
  const [D, S, H] = [2000, 500, 0.25 * 50]
  it('Q* = 400 y costo relevante de $5.000', () => {
    expect(eoq(D, S, H)).toBeCloseTo(400, 6)
    expect(trc(400, D, S, H)).toBeCloseTo(5000, 6)
    expect(trc(100, D, S, H)).toBeCloseTo(10625, 6)
  })
  it('sensibilidad: pedir 500 cuesta 2,5 % más', () => {
    expect(trc(500, D, S, H) / trc(400, D, S, H)).toBeCloseTo(sensitivityQ(500, 400), 10)
    expect(sensitivityQ(500, 400)).toBeCloseTo(1.025, 10)
  })
  it('tabla de costos: el óptimo está en Q = 4.000 con CT = 2.400', () => {
    // D·S = 4.800.000 y h = 0,6 reproducen la tabla del apunte.
    expect(eoq(48000, 100, 0.6)).toBeCloseTo(4000, 6)
    expect(trc(4000, 48000, 100, 0.6)).toBeCloseTo(2400, 6)
    expect(Math.round(trc(7000, 48000, 100, 0.6))).toBe(2786)
  })
})

describe('Revisión Periódica (ejemplos de la unidad 2)', () => {
  // Demanda anual N(3400; 400), LT N(1; 0,07) semanas, NSC 95 %, c = $75, h = 0,15, S = $550. Año de 52 semanas.
  const { d, sigmaD } = perPeriod(3400, 400, 52)
  const base = { d, sigmaD, sigmaLT: 0.07, D: 3400, S: 550, H: 0.15 * 75, c: 75, criterion: { kind: 'nsc' as const, nsc: 0.95 }, perYear: 52 }
  it('ejemplo 1: revisión mensual (4 semanas)', () => {
    const r = periodicReview({ ...base, LT: 1, R: 4 })
    expect(r.sigmaC).toBeCloseTo(124.1192, 3)
    expect(r.SS).toBeCloseTo(204.158, 2)
    expect(r.NOP).toBeCloseTo(531.08, 1)
    expect(r.cycles).toBeCloseTo(13, 6)
    expect(r.costs.cycleStock).toBeCloseTo(1471.15, 1)
    expect(r.costs.safetyStock).toBeCloseTo(2296.78, 1)
  })
  it('ejemplo 2: centro de distribución, LT de 10 días y revisión cada 2 semanas', () => {
    const r = periodicReview({ ...base, LT: 10 / 7, R: 2 })
    expect(r.sigmaC).toBeCloseTo(102.8124, 3)
    expect(r.SS).toBeCloseTo(169.111, 2)
    expect(r.NOP).toBeCloseTo(393.29, 1)
  })
})

describe('Revisión Continua', () => {
  it('lead time por etapas (arroz): LT = 36,3 días, σ_LT = 3,63', () => {
    const orders = [
      [3, 3, 5, 17, 0, 1, 1, 1],
      [2, 4, 5, 20, 0, 2, 1, 1],
      [2, 2, 6, 21, 0, 1, 1, 1],
      [2, 5, 3, 23, 0, 1, 1, 1],
      [1, 3, 6, 19, 0, 1, 1, 1],
      [4, 7, 8, 22, 0, 2, 1, 1],
      [5, 6, 9, 25, 0, 3, 1, 1],
      [3, 7, 7, 25, 0, 2, 1, 1],
      [3, 4, 6, 18, 0, 2, 2, 1],
      [3, 5, 8, 20, 0, 1, 1, 1],
      [1, 4, 3, 20, 0, 1, 1, 1],
      [2, 4, 3, 19, 0, 2, 1, 1],
      [1, 2, 4, 17, 0, 1, 1, 1],
      [1, 5, 7, 20, 0, 1, 1, 1],
      [2, 4, 5, 19, 0, 2, 1, 1],
    ]
    const lt = leadTimeByStages(orders)
    expect(lt.LT).toBeCloseTo(36.267, 3)
    expect(lt.sigmaLT).toBeCloseTo(3.6332, 3)
  })
  it('punto de reorden con demanda semanal de 42,64 ± 10,48 y el LT del arroz', () => {
    const r = continuousReview({ d: 42.64 / 7, sigmaD: 10.48 / Math.sqrt(7), LT: 36.2667, sigmaLT: 3.6332, D: 42.64 * 52, S: 100, H: 1, c: 10, criterion: { kind: 'nsc', nsc: 0.95 } })
    expect(r.sigmaC).toBeCloseTo(32.54, 1)
    expect(r.ROP).toBeCloseTo(274.44, 0)
  })
  it('con fill rate, k sale de G(k) = (1 − FR)·Q/σc', () => {
    const r = continuousReview({ d: 10, sigmaD: 5, LT: 9, sigmaLT: 0, D: 3650, S: 50, H: 2, c: 8, criterion: { kind: 'fr', fr: 0.99 } })
    expect(r.FR).toBeCloseTo(0.99, 6)
  })
})

describe('Can-Order', () => {
  it('ejemplo de tres productos: A dispara la orden, B se suma, C no', () => {
    const q = canOrderQuantities([
      { stock: 90, ROP: 100, COP: 160, OBS: 300 },
      { stock: 140, ROP: 100, COP: 180, OBS: 280 },
      { stock: 220, ROP: 120, COP: 190, OBS: 320 },
    ])
    expect(q).toEqual([210, 140, 0])
  })
  it('si ninguno llega al ROP, no se pide', () => {
    expect(canOrderQuantities([{ stock: 150, ROP: 100, COP: 160, OBS: 300 }])).toEqual([0])
  })
})
