import { describe, expect, it } from 'vitest'
import { Simulation } from '../sim/engine'
import { summarize } from '../sim/summary'
import { ACTIVITIES, ACTIVITY_DECISIONS, ACTIVITY_SCENARIO, correctOption } from './activities'

const EXPECTED: Record<string, number> = { 'costo-pedir': 0, 'nivel-servicio': 1, periodica: 1, 'can-order': 1, 'lead-time': 2 }

const year = (d: typeof ACTIVITY_DECISIONS, s: typeof ACTIVITY_SCENARIO) => {
  const sim = new Simulation(s, d)
  return summarize(sim.run(364), s)
}

describe('actividades: la conclusión no depende de la demanda sorteada', () => {
  for (const seed of [1, 2, 3]) {
    const sc = { ...ACTIVITY_SCENARIO, seed }
    const base = year(ACTIVITY_DECISIONS, sc)
    for (const a of ACTIVITIES)
      it(`${a.title} (semilla ${seed})`, () => {
        const [d, s] = a.change(ACTIVITY_DECISIONS, sc)
        const alt = year(d, s)
        // Con cualquier demanda sorteada, la conclusión es la misma.
        expect(correctOption(a, base, alt)).toBe(EXPECTED[a.key])
      })
  }
}, 300000)
