/** Clientes: un centro de reparto por departamento, en su capital. Montevideo se divide en dos zonas. */
export interface Client {
  key: string
  name: string
  department: string
  /** [lon, lat] del punto de entrega. */
  at: [number, number]
  /** Población que atiende (aprox., censo 2023), para repartir la demanda. */
  population: number
  /**
   * Distancia por ruta desde la nave, en km (solo ida): camino más corto por la red vial de Overture / OpenStreetMap
   * (tools/geo/build-uruguay.ts).
   */
  km: number
  /** Ruta principal por la que se llega. */
  route: string
  /** Demanda extra en verano (balnearios). 0 = sin efecto. */
  summer: number
}

/** La nave: predio sobre la Ruta 5, zona oeste de Montevideo (ubicación verosímil, nave inventada). */
export const DEPOT = { name: 'Centro logístico Ruta 5', at: [-56.255, -34.795] as [number, number] }

export const CLIENTS: Client[] = [
  { key: 'mvd-c', name: 'Montevideo Centro', department: 'Montevideo', at: [-56.19, -34.905], population: 650_000, km: 17, route: 'Ruta 5', summer: 0 },
  { key: 'mvd-e', name: 'Montevideo Este', department: 'Montevideo', at: [-56.1, -34.88], population: 650_000, km: 22, route: 'Anillo Perimetral', summer: 0 },
  { key: 'can', name: 'Canelones', department: 'Canelones', at: [-56.284, -34.522], population: 607_000, km: 35, route: 'Ruta 5', summer: 0.1 },
  { key: 'mal', name: 'Maldonado', department: 'Maldonado', at: [-54.958, -34.903], population: 212_000, km: 143, route: 'Ruta Interbalnearia', summer: 0.9 },
  { key: 'col', name: 'Colonia del Sacramento', department: 'Colonia', at: [-57.842, -34.471], population: 136_000, km: 177, route: 'Ruta 1', summer: 0.15 },
  { key: 'sal', name: 'Salto', department: 'Salto', at: [-57.965, -31.388], population: 133_000, km: 499, route: 'Ruta 3', summer: 0.1 },
  { key: 'pay', name: 'Paysandú', department: 'Paysandú', at: [-58.075, -32.321], population: 118_000, km: 361, route: 'Ruta 3', summer: 0.05 },
  { key: 'sjo', name: 'San José de Mayo', department: 'San José', at: [-56.713, -34.337], population: 116_000, km: 85, route: 'Ruta 1 y Ruta 3', summer: 0 },
  { key: 'riv', name: 'Rivera', department: 'Rivera', at: [-55.551, -30.905], population: 104_000, km: 486, route: 'Ruta 5', summer: 0 },
  { key: 'tac', name: 'Tacuarembó', department: 'Tacuarembó', at: [-55.984, -31.711], population: 93_000, km: 380, route: 'Ruta 5', summer: 0 },
  { key: 'mel', name: 'Melo', department: 'Cerro Largo', at: [-54.183, -32.37], population: 90_000, km: 390, route: 'Ruta 8', summer: 0 },
  { key: 'mer', name: 'Mercedes', department: 'Soriano', at: [-58.031, -33.252], population: 83_000, km: 276, route: 'Ruta 2', summer: 0.05 },
  { key: 'roc', name: 'Rocha', department: 'Rocha', at: [-54.333, -34.483], population: 78_000, km: 213, route: 'Ruta 9', summer: 1.2 },
  { key: 'art', name: 'Artigas', department: 'Artigas', at: [-56.468, -30.4], population: 76_000, km: 579, route: 'Ruta 30', summer: 0 },
  { key: 'flo', name: 'Florida', department: 'Florida', at: [-56.215, -34.099], population: 69_000, km: 93, route: 'Ruta 5', summer: 0 },
  { key: 'min', name: 'Minas', department: 'Lavalleja', at: [-55.237, -34.376], population: 60_000, km: 127, route: 'Ruta 8', summer: 0 },
  { key: 'dur', name: 'Durazno', department: 'Durazno', at: [-56.523, -33.381], population: 59_000, km: 172, route: 'Ruta 5', summer: 0 },
  { key: 'fbe', name: 'Fray Bentos', department: 'Río Negro', at: [-58.304, -33.116], population: 57_000, km: 308, route: 'Ruta 2', summer: 0.05 },
  { key: 'tyt', name: 'Treinta y Tres', department: 'Treinta y Tres', at: [-54.383, -33.233], population: 49_000, km: 292, route: 'Ruta 8', summer: 0 },
  { key: 'tri', name: 'Trinidad', department: 'Flores', at: [-56.889, -33.517], population: 26_000, km: 180, route: 'Ruta 3', summer: 0 },
]

const TOTAL_POPULATION = CLIENTS.reduce((s, c) => s + c.population, 0)

/** Parte de la demanda de cada cliente. */
export const CLIENT_SHARE = CLIENTS.map((c) => c.population / TOTAL_POPULATION)

/** Demanda extra de verano: máxima a mediados de enero, nula de abril a noviembre. */
export function summerFactor(c: Client, dayOfYear: number): number {
  if (!c.summer) return 1
  const d = Math.min(Math.abs(dayOfYear - 15), 365 - Math.abs(dayOfYear - 15))
  return 1 + c.summer * Math.max(0, Math.cos((Math.min(d, 75) / 75) * (Math.PI / 2)))
}

/** Frecuencia de entrega por defecto (días por semana), según el tamaño del cliente. */
export function defaultFrequency(c: Client): 1 | 2 | 3 | 5 {
  return c.population >= 500_000 ? 5 : c.population >= 120_000 ? 3 : c.population >= 70_000 ? 2 : 1
}
