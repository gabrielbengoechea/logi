import type { Product } from '../sim/catalog'
import type { DayStats } from '../sim/engine'
import { RACK, slots, type Slot } from '../sim/warehouse'

export interface Slotting {
  slots: Slot[]
  /** Posiciones fijas de cada producto (índices en `slots`). */
  home: number[][]
  /** Posiciones de reserva, de la mejor a la peor. */
  reserve: number[]
}

/**
 * Asignación de ubicaciones (slotting): cada producto recibe posiciones fijas según su rotación física (los que más
 * pallets mueven, cerca de los despachos), tantas como pallets tiene la mitad del tiempo. Lo que excede va a reserva,
 * donde haya lugar. Ojo: la clase ABC se calcula por valor, que no es lo mismo que la rotación.
 */
export function assignSlots(products: Product[], days: DayStats[]): Slotting {
  const all = slots()
  // Se recorre por columnas (cara y módulo), de la más cercana a la más lejana, y dentro de cada una de abajo arriba.
  const column = (s: Slot) => s.side * RACK.bays + s.bay
  const colCost = new Map<number, number>()
  for (const s of all) if (s.level === 0) colCost.set(column(s), Math.min(colCost.get(column(s)) ?? Infinity, s.cost))
  const order = all.map((_, i) => i).sort((a, b) => colCost.get(column(all[a]))! - colCost.get(column(all[b]))! || all[a].level - all[b].level || all[a].z - all[b].z)

  const median = products.map((p) => {
    const v = days.map((d) => d.palletsBySku[p.id]).sort((a, b) => a - b)
    return v[Math.floor(v.length / 2)] ?? 0
  })
  // Por rotación física (pallets que salen por día), no por valor: lo que más se mueve, más cerca de los despachos.
  const bySpeed = [...products].sort((a, b) => b.dailyDemand / b.unitsPerPallet - a.dailyDemand / a.unitsPerPallet)
  const home: number[][] = products.map(() => [])
  let next = 0
  const budget = Math.floor(order.length * 0.75)
  for (const p of bySpeed) {
    const n = Math.max(1, median[p.id])
    for (let i = 0; i < n && next < budget; i++) home[p.id].push(order[next++])
  }
  return { slots: all, home, reserve: order.slice(next) }
}

/** Producto de cada posición en un día (−1 = vacía) y pallets que no entraron en la nave. */
export function occupancy(sl: Slotting, day: DayStats): { sku: Int16Array; overflow: number } {
  const sku = new Int16Array(sl.slots.length).fill(-1)
  let r = 0
  let overflow = 0
  day.palletsBySku.forEach((n, s) => {
    const home = sl.home[s]
    for (let i = 0; i < Math.min(n, home.length); i++) sku[home[i]] = s
    for (let i = home.length; i < n; i++) {
      if (r < sl.reserve.length) sku[sl.reserve[r++]] = s
      else overflow++
    }
  })
  return { sku, overflow }
}
