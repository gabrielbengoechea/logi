// Las escenas del centro de distribución dejan el reloj justo antes del evento y el lugar dentro del predio.
import { describe, expect, it } from 'vitest'
import { dockSchedule } from '../scene/Docks'
import { dayOf, useStore } from '../store'
import type { ContextoEscena, Lugar } from './escenas'
import { menuNave, tiempoNave } from './escenas-nave'

const menu = menuNave()
const st = () => useStore.getState()

function recorrer(id: string) {
  const lugares: Lugar[] = []
  const ctx: ContextoEscena = { irA: (l) => lugares.push(l), tiempo: menu.tiempo }
  const e = menu.escenas!.find((x) => x.id === id)!
  lugares.push(e.preparar(ctx))
  const tiempos = [st().t]
  for (const p of e.pasos) {
    p.al?.(ctx)
    if (p.lugar) lugares.push(p.lugar)
    expect(p.texto.length).toBeGreaterThan(40)
    tiempos.push(st().t)
  }
  for (const l of lugares) {
    expect(Math.abs(l.pos.x)).toBeLessThan(115)
    expect(l.pos.z).toBeGreaterThan(-75)
    expect(l.pos.z).toBeLessThan(137)
    expect(Number.isFinite(l.yaw)).toBe(true)
  }
  return { lugares, tiempos }
}

describe('escenas guiadas de la nave', () => {
  it('recepción: un camión de proveedor llega a una puerta de recepción', () => {
    st().setT(10)
    recorrer('recepcion')
    const d = dayOf(st().t)
    const h = st().t - d * 24
    const visitas = dockSchedule(st().run.days[d], st().decisions).filter((v) => v.inbound)
    expect(visitas.some((v) => h >= v.start - 0.4 && h <= v.end)).toBe(true)
  })

  it('despacho: termina en el patio con el camión saliendo', () => {
    st().setT(10)
    const { lugares } = recorrer('despacho')
    expect(lugares[lugares.length - 1].pos.y).toBeLessThan(0)
  })

  it('almacenaje y fin de turno', () => {
    recorrer('almacenaje')
    recorrer('turno')
    expect(st().speed).toBeCloseTo(1 / 60)
  })

  it('reloj y lugares', () => {
    expect(tiempoNave.reloj()).toMatch(/^[a-zé]+ \d\d:\d\d$/)
    expect(tiempoNave.detalle!()).toContain('Día')
    expect(menu.lugares!.length).toBeGreaterThanOrEqual(6)
  })
})
