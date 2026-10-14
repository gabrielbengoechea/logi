/**
 * Geometría de la nave, en metros. Origen en el centro del piso; x a lo largo (125 m), z a lo ancho (80 m), con los
 * andenes sobre la pared z = +40 (al sur, hacia el patio de maniobras). El piso de la nave está 1,2 m más alto que
 * el patio, a la altura de la caja de un semirremolque.
 */
export const HALL = { length: 125, width: 80, height: 13, dockHeight: 1.2 }

/** Pallet de 1,0 × 1,2 m (el más usado en Uruguay), carga de hasta 1,5 m. */
export const PALLET = { w: 1.0, d: 1.2, base: 0.15 }

export const RACK = {
  /** Filas dobles (espalda con espalda), cada una con dos caras. */
  doubles: 13,
  /** Módulos por cara, a lo largo de z. */
  bays: 24,
  /** Pallets por módulo y por nivel. */
  perBay: 2,
  levels: 5,
  bayLength: 2.4,
  depth: 1.2,
  /** Separación entre las dos caras de una fila doble. */
  flue: 0.2,
  aisle: 3.0,
  levelPitch: 1.95,
  /** Primer nivel sobre el piso; el resto con vigas. */
  firstBeam: 1.95,
  /** Borde de las estanterías del lado de los andenes y borde x de la primera fila. */
  front: 21,
  x0: -34.9,
}

export const POSITIONS = RACK.doubles * 2 * RACK.bays * RACK.perBay * RACK.levels

/** Andenes: 10 puertas; las 4 de la izquierda reciben, las 6 de la derecha despachan. */
export const DOCKS = Array.from({ length: 10 }, (_, i) => ({ x: -45 + i * 10, inbound: i < 4 }))

/** Playa de preparación: franja entre las estanterías y los andenes. */
export const STAGING = { z0: 25, z1: HALL.width / 2 - 1 }

export interface Slot {
  /** Centro del pallet en el piso de la nave. */
  x: number
  y: number
  z: number
  side: number
  bay: number
  level: number
  /** Costo de llegar: recorrido desde los andenes de despacho más la altura. Las mejores posiciones, para los A. */
  cost: number
}

/** x del eje de una cara de estantería (k = 0 … 2·doubles − 1). */
export function faceX(k: number) {
  const pitch = 2 * RACK.depth + RACK.flue + RACK.aisle
  const d = Math.floor(k / 2)
  const left = RACK.x0 + d * pitch
  return k % 2 === 0 ? left + RACK.depth / 2 : left + RACK.depth + RACK.flue + RACK.depth / 2
}

/** Todas las posiciones de pallet, ordenadas de la mejor a la peor. */
export function slots(): Slot[] {
  const out: Slot[] = []
  const outX = DOCKS.filter((d) => !d.inbound).reduce((s, d) => s + d.x, 0) / DOCKS.filter((d) => !d.inbound).length
  for (let k = 0; k < RACK.doubles * 2; k++)
    for (let b = 0; b < RACK.bays; b++)
      for (let p = 0; p < RACK.perBay; p++)
        for (let l = 0; l < RACK.levels; l++) {
          const x = faceX(k)
          const z = RACK.front - b * RACK.bayLength - (p + 0.5) * (RACK.bayLength / RACK.perBay)
          const y = l === 0 ? 0 : RACK.firstBeam + (l - 1) * RACK.levelPitch
          out.push({ x, y, z, side: k, bay: b, level: l, cost: Math.abs(x - outX) + (STAGING.z0 - z) + l * 6 })
        }
  return out.sort((a, b) => a.cost - b.cost)
}

/** x del centro del pasillo que sigue a la fila doble d (d = 0 … doubles − 2); d = −1 es el pasillo de la izquierda. */
export function aisleX(d: number) {
  const pitch = 2 * RACK.depth + RACK.flue + RACK.aisle
  return RACK.x0 + d * pitch + 2 * RACK.depth + RACK.flue + RACK.aisle / 2
}
