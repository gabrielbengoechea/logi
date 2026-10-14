import { FAMILIES, familyOf, generateCatalog, seasonFactor, type AbcClass, type Product } from './catalog'
import { CLIENTS, CLIENT_SHARE, defaultFrequency, summerFactor } from './clients'
import { gammaMean1, hashUniform, mulberry32, poissonFrom } from './rng'
import { DOCKS, HALL, POSITIONS } from './warehouse'

/** Tarifas en USD. Valores estimados, con órdenes de magnitud verosímiles para Uruguay. */
export interface Tariffs {
  /** Alquiler de la nave, USD por m² por mes. */
  rentM2Month: number
  /** Costo de capital del inventario, anual, sobre el valor de costo. */
  capitalRate: number
  /** Depósito externo para lo que no entra en la nave, USD por pallet por día. */
  overflowPalletDay: number
  /** Costo de emitir una orden de compra, USD por línea. */
  orderLocal: number
  orderImport: number
  /** Operario, USD por mes con cargas sociales. */
  operatorMonth: number
  /** Recargo del turno nocturno. */
  nightPremium: number
  /** Autoelevador, USD por mes. */
  forkliftMonth: number
  /** Camión propio: costo fijo por mes (amortización, seguro, chofer) y variable por km. */
  truckMonth: number
  truckKm: number
  /** Flete contratado, USD por km recorrido (ida y vuelta) y mínimo por viaje. */
  hiredKm: number
  hiredMinTrip: number
  /** Costo anual de tener stock en los locales del cliente (capital y espacio), sobre el valor de costo. */
  storeHoldingRate: number
  /** Costo de cada faltante, además del margen que no se cobra (cliente insatisfecho), sobre el precio de venta. */
  shortagePenalty: number
}

export const BASE_TARIFFS: Tariffs = {
  rentM2Month: 6,
  capitalRate: 0.12,
  overflowPalletDay: 0.6,
  orderLocal: 60,
  orderImport: 250,
  operatorMonth: 1600,
  nightPremium: 0.2,
  forkliftMonth: 1200,
  truckMonth: 4500,
  truckKm: 0.9,
  hiredKm: 1.6,
  hiredMinTrip: 200,
  storeHoldingRate: 0.25,
  shortagePenalty: 0.05,
}

/** Lo que no controla el jugador: el mundo. */
export interface Scenario {
  seed: number
  /** Primer día de la simulación, como día del año (0 = 1 de enero de 2027). Tiene que caer lunes. */
  startDayOfYear: number
  products: number
  /** Volumen base de la demanda, en pallets por día. */
  palletsPerDay: number
  /** Multiplicador de la demanda (temporada, crisis, promoción). */
  demandFactor: number
  /** Multiplicador de la variabilidad de la demanda. */
  variability: number
  seasonality: boolean
  /** Si falta stock, ¿la venta se pierde o queda pendiente para la próxima entrega? */
  shortage: 'lost' | 'backorder'
  /** Multiplicador de la demora de los importados (por ejemplo, congestión en el puerto). */
  importDelay: number
  /** Multiplicador del precio del gasoil. */
  fuel: number
  areaM2: number
  positions: number
  docks: number
  tariffs: Tariffs
}

export const BASE_SCENARIO: Scenario = {
  seed: 1,
  // Lunes 1 de marzo de 2027.
  startDayOfYear: 59,
  products: 240,
  palletsPerDay: 180,
  demandFactor: 1,
  variability: 1,
  seasonality: true,
  shortage: 'lost',
  importDelay: 1,
  fuel: 1,
  areaM2: HALL.length * HALL.width,
  positions: POSITIONS,
  docks: DOCKS.length,
  tariffs: BASE_TARIFFS,
}

/** Política de reposición de una clase ABC. */
export interface Policy {
  /** Punto de pedido y lote (revisión continua) o revisión periódica hasta un máximo. */
  kind: 'sQ' | 'RS'
  /** Nivel de servicio objetivo (define el stock de seguridad). */
  service: number
  /** Lote: económico (EOQ) o días de cobertura. Solo para sQ. */
  lot: 'eoq' | 'cover'
  coverDays: number
  /** Cada cuántos días se revisa. Solo para RS. */
  reviewDays: number
}

/** Lo que decide el jugador. */
export interface Decisions {
  policy: Record<AbcClass, Policy>
  shifts: 1 | 2 | 3
  operatorsPerShift: number
  forklifts: number
  overtime: boolean
  ownTrucks: number
  /** Entregas por semana a cada cliente, en el orden de CLIENTS. */
  frequency: (1 | 2 | 3 | 5)[]
}

export const BASE_DECISIONS: Decisions = {
  policy: {
    A: { kind: 'sQ', service: 0.98, lot: 'eoq', coverDays: 14, reviewDays: 7 },
    B: { kind: 'sQ', service: 0.95, lot: 'eoq', coverDays: 21, reviewDays: 7 },
    C: { kind: 'sQ', service: 0.9, lot: 'eoq', coverDays: 30, reviewDays: 14 },
  },
  shifts: 2,
  operatorsPerShift: 8,
  forklifts: 6,
  overtime: true,
  ownTrucks: 10,
  frequency: CLIENTS.map(defaultFrequency),
}

/** Productividades (estimadas). */
export const PRODUCTIVITY = {
  /** Horas productivas por turno y persona. */
  shiftHours: 7.5,
  /** Horas extra posibles por operario y día. */
  overtimeHours: 2,
  /** Picking de cajas sueltas, cajas por hora y operario. */
  casesPerHour: 110,
  /** Pallets completos: sacar del rack, por hora y operario. */
  fullPalletsPerHour: 20,
  /** Carga al camión, pallets por hora y operario. */
  loadPalletsPerHour: 30,
  /** Recepción: descargar, controlar y ubicar, pallets por hora y operario. */
  receivePalletsPerHour: 16,
  /** Movimientos de autoelevador por hora. */
  forkliftMovesPerHour: 14,
  /** Cajas que entran en un pallet armado con mercadería mezclada. */
  mixedCasesPerPallet: 55,
  /** Pallets por camión con semirremolque. */
  truckPallets: 26,
  /** Velocidad media del camión en ruta, km/h. */
  truckKmh: 65,
  /** Horas de carga y descarga por viaje. */
  stopHours: 3,
  /** Horas de manejo por día y chofer. */
  driveHoursPerDay: 10,
}

const DAYS_PER_MONTH = 30.4
/** Suavizado del pronóstico: con 0,05, pesa más o menos el último mes. */
const FORECAST_ALPHA = 0.05
const WEEKDAYS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Días de la semana (0 = lunes) en que se entrega a un cliente, repartidos para no cargar siempre el mismo día. */
export function deliveryDays(freq: 1 | 2 | 3 | 5, clientIndex: number): number[] {
  if (freq === 5) return [0, 1, 2, 3, 4]
  if (freq === 3) return clientIndex % 2 ? [1, 3, 4] : [0, 2, 4]
  if (freq === 2) return [[0, 3], [1, 4], [0, 2], [1, 3]][clientIndex % 4]
  return [clientIndex % 5]
}

export interface Shipment {
  client: number
  pallets: number
  trucks: number
  own: number
  km: number
}

export interface Costs {
  rent: number
  capital: number
  overflow: number
  ordering: number
  labor: number
  overtime: number
  forklifts: number
  fleet: number
  fuel: number
  hired: number
  storeStock: number
  shortage: number
}

export const COST_LABELS: Record<keyof Costs, string> = {
  rent: 'Alquiler de la nave',
  capital: 'Capital en stock',
  overflow: 'Depósito externo',
  ordering: 'Órdenes de compra',
  labor: 'Personal',
  overtime: 'Horas extra',
  forklifts: 'Autoelevadores',
  fleet: 'Flota propia (fijo)',
  fuel: 'Flota propia (km)',
  hired: 'Fletes contratados',
  storeStock: 'Stock en los clientes',
  shortage: 'Penalización por faltantes',
}

export interface DayStats {
  day: number
  weekday: number
  /** Unidades pedidas, entregadas y perdidas (o pendientes) en las entregas del día. */
  requested: number
  shipped: number
  short: number
  /** Valor de venta perdido por faltantes. */
  lostSales: number
  ordersDue: number
  ordersOnTime: number
  /** Pedidos atrasados por falta de capacidad de la nave. */
  backlog: number
  revenue: number
  cogs: number
  costs: Costs
  stockValue: number
  pallets: number
  palletsIn: number
  palletsOut: number
  hoursNeeded: number
  hoursAvailable: number
  forkliftUse: number
  purchaseOrders: number
  km: number
  truckFill: number
  shipments: Shipment[]
  /** Pallets ocupados por producto al cierre del día. */
  palletsBySku: Uint16Array
}

interface ClientOrder {
  client: number
  due: number
  lines: { sku: number; qty: number }[]
}

interface Inbound {
  sku: number
  qty: number
  arrive: number
}

/** z de la normal estándar para un nivel de servicio (aproximación de Acklam, suficiente acá). */
export function zFor(p: number): number {
  const q = Math.min(Math.max(p, 0.5), 0.9999)
  const t = Math.sqrt(-2 * Math.log(1 - q))
  return t - (2.515517 + 0.802853 * t + 0.010328 * t * t) / (1 + 1.432788 * t + 0.189269 * t * t + 0.001308 * t * t * t)
}

export function emptyCosts(): Costs {
  return { rent: 0, capital: 0, overflow: 0, ordering: 0, labor: 0, overtime: 0, forklifts: 0, fleet: 0, fuel: 0, hired: 0, storeStock: 0, shortage: 0 }
}

export const totalCost = (c: Costs) => Object.values(c).reduce((s, v) => s + v, 0)

/**
 * Simulación día a día del centro logístico. Se puede avanzar de a un día (modo juego: las decisiones cambian cada
 * semana) o correr un período entero (modo simulador).
 */
export class Simulation {
  readonly scenario: Scenario
  readonly products: Product[]
  readonly days: DayStats[] = []
  decisions: Decisions
  day = 0

  readonly onHand: Float64Array
  readonly onOrder: Float64Array
  /** Pronóstico: demanda diaria suavizada y su desvío. */
  readonly forecast: Float64Array
  readonly forecastDev: Float64Array
  /** Demanda acumulada de cada cliente desde su última entrega, por producto. */
  private readonly pending: Float64Array[]
  private queue: ClientOrder[] = []
  private inbound: Inbound[] = []
  private receiving: Inbound[] = []
  /** Días de camión propio ya comprometidos en viajes largos. */
  private truckBusy: number[] = []
  private readonly demandShock: (sku: number, day: number) => number

  constructor(scenario: Scenario = BASE_SCENARIO, decisions: Decisions = BASE_DECISIONS) {
    this.scenario = scenario
    this.decisions = decisions
    this.products = generateCatalog(scenario.seed, scenario.products, scenario.palletsPerDay)
    const n = this.products.length
    this.onHand = new Float64Array(n)
    this.onOrder = new Float64Array(n)
    this.forecast = new Float64Array(n)
    this.forecastDev = new Float64Array(n)
    this.pending = CLIENTS.map(() => new Float64Array(n))

    // Shock de demanda común a todos los clientes, por producto y día: gamma de media 1 con el cv del producto.
    const shocks = new Map<number, number>()
    this.demandShock = (sku, day) => {
      const key = day * 4096 + sku
      let v = shocks.get(key)
      if (v === undefined) {
        const r = mulberry32(Math.floor(hashUniform(scenario.seed, 11, day, sku) * 2 ** 31))
        v = gammaMean1(this.products[sku].cv * scenario.variability, r)
        shocks.set(key, v)
      }
      return v
    }

    // Arranque: pronóstico perfecto y stock en el punto medio de la política; los importados ya tienen pedidos en
    // camino, para no empezar con faltantes.
    for (const p of this.products) {
      const d = p.dailyDemand * scenario.demandFactor
      this.forecast[p.id] = d
      this.forecastDev[p.id] = d * (p.cv * scenario.variability + 1) + Math.sqrt(d)
      const { s, q } = this.reorderLevels(p.id)
      this.onHand[p.id] = Math.round(s - d * this.leadTime(p) + q / 2 + d * 3)
      if (p.imported) {
        const each = Math.max(q, d * 14)
        for (let t = 14; t < this.leadTime(p); t += each / d) {
          this.inbound.push({ sku: p.id, qty: Math.round(each), arrive: Math.round(t) })
          this.onOrder[p.id] += Math.round(each)
        }
      }
    }
  }

  dayOfYear(day = this.day) {
    return (this.scenario.startDayOfYear + day) % 365
  }

  leadTime(p: Product) {
    return p.imported ? p.leadDays * this.scenario.importDelay : p.leadDays
  }

  /** Ancho del rango en que varía la demora real alrededor de la media, en días. */
  leadSpread(p: Product) {
    return p.imported ? 10 * this.scenario.importDelay : 2
  }

  /** Demanda media esperada de un producto en un día, todos los clientes juntos, sin el efecto del verano. */
  private expectedTotal(sku: number, day: number) {
    const p = this.products[sku]
    const season = this.scenario.seasonality ? seasonFactor(familyOf(p.family), this.dayOfYear(day)) : 1
    return p.dailyDemand * this.scenario.demandFactor * season
  }

  /** Sorteo de Poisson fijo para la semilla, el día, el cliente y el producto. */
  private draw(mean: number, sku: number, client: number, day: number) {
    return poissonFrom(mean, hashUniform(this.scenario.seed, day * 64 + client, sku, 1), hashUniform(this.scenario.seed, day * 64 + client, sku, 2))
  }

  /** Demanda real (al azar, pero fija para la semilla) de un producto para un cliente en un día. */
  demand(sku: number, client: number, day: number) {
    const summer = this.scenario.seasonality ? summerFactor(CLIENTS[client], this.dayOfYear(day)) : 1
    return this.draw(this.expectedTotal(sku, day) * this.demandShock(sku, day) * CLIENT_SHARE[client] * summer, sku, client, day)
  }

  /** Punto de pedido (s), lote (q) y máximo (S) de un producto con la política de su clase. */
  reorderLevels(sku: number) {
    const p = this.products[sku]
    const pol = this.decisions.policy[p.abc]
    const t = this.scenario.tariffs
    const d = this.forecast[sku]
    const sigma = this.forecastDev[sku]
    const lt = this.leadTime(p)
    const protect = pol.kind === 'RS' ? lt + pol.reviewDays : lt
    // Demora variable: desvío de una uniforme de ancho LEAD_SPREAD.
    const sigmaLt = this.leadSpread(p) / Math.sqrt(12)
    const safety = zFor(pol.service) * Math.sqrt(protect * sigma * sigma + d * d * sigmaLt * sigmaLt)
    const s = d * protect + safety
    // Costo anual de guardar una unidad: capital más la parte del alquiler que ocupa su lugar en el pallet.
    const positionYear = (t.rentM2Month * this.scenario.areaM2 * 12) / this.scenario.positions
    const h = p.cost * t.capitalRate + positionYear / p.unitsPerPallet
    const k = p.imported ? t.orderImport : t.orderLocal
    const eoq = Math.sqrt((2 * d * 365 * k) / h)
    const q = Math.max(p.unitsPerCase, pol.lot === 'eoq' ? eoq : d * pol.coverDays)
    return { s, q: Math.ceil(q / p.unitsPerCase) * p.unitsPerCase, S: s + (pol.kind === 'RS' ? 0 : q), safety }
  }

  private palletsOf(sku: number, qty: number) {
    return Math.ceil(qty / this.products[sku].unitsPerPallet - 1e-9)
  }

  /** Avanza un día. */
  step(): DayStats {
    const day = this.day
    const weekday = day % 7
    const open = weekday < 5
    const sc = this.scenario
    const t = sc.tariffs
    const dec = this.decisions
    const P = PRODUCTIVITY
    const n = this.products.length
    const costs = emptyCosts()
    const stats: DayStats = {
      day,
      weekday,
      requested: 0,
      shipped: 0,
      short: 0,
      lostSales: 0,
      ordersDue: 0,
      ordersOnTime: 0,
      backlog: 0,
      revenue: 0,
      cogs: 0,
      costs,
      stockValue: 0,
      pallets: 0,
      palletsIn: 0,
      palletsOut: 0,
      hoursNeeded: 0,
      hoursAvailable: 0,
      forkliftUse: 0,
      purchaseOrders: 0,
      km: 0,
      truckFill: 0,
      shipments: [],
      palletsBySku: new Uint16Array(n),
    }

    // 1. Demanda del día en los clientes; se acumula hasta su próxima entrega.
    const base = new Float64Array(n)
    for (let s = 0; s < n; s++) base[s] = this.expectedTotal(s, day) * this.demandShock(s, day)
    for (let c = 0; c < CLIENTS.length; c++) {
      const pend = this.pending[c]
      const k = CLIENT_SHARE[c] * (sc.seasonality ? summerFactor(CLIENTS[c], this.dayOfYear(day)) : 1)
      for (let s = 0; s < n; s++) {
        pend[s] += this.draw(base[s] * k, s, c, day)
      }
    }

    // 2. Mercadería que llega: queda en el andén hasta que se recibe.
    this.inbound = this.inbound.filter((o) => {
      if (o.arrive > day) return true
      this.receiving.push(o)
      return false
    })

    // 3. Pedidos de los clientes que tienen entrega hoy. Lo que piden es la demanda que ve la nave: con eso se
    // actualiza el pronóstico (suavizado exponencial de la media y del desvío), también los días sin pedidos.
    const ordered = new Float64Array(n)
    if (open)
      for (let c = 0; c < CLIENTS.length; c++) {
        if (!deliveryDays(dec.frequency[c], c).includes(weekday)) continue
        const lines: ClientOrder['lines'] = []
        const pend = this.pending[c]
        for (let s = 0; s < n; s++)
          if (pend[s] > 0) {
            lines.push({ sku: s, qty: pend[s] })
            ordered[s] += pend[s]
          }
        pend.fill(0)
        this.queue.push({ client: c, due: day, lines })
      }
    for (let s = 0; s < n; s++) {
      const err = ordered[s] - this.forecast[s]
      this.forecast[s] += FORECAST_ALPHA * err
      this.forecastDev[s] += FORECAST_ALPHA * (Math.abs(err) * 1.25 - this.forecastDev[s])
    }

    // 4. Capacidad del día: horas de personal y de autoelevador.
    let hours = 0
    let liftHours = 0
    let overtimeLeft = 0
    if (open) {
      hours = dec.operatorsPerShift * dec.shifts * P.shiftHours
      liftHours = dec.forklifts * dec.shifts * P.shiftHours
      overtimeLeft = dec.overtime ? dec.operatorsPerShift * P.overtimeHours : 0
    }
    stats.hoursAvailable = hours
    let usedOvertime = 0
    const take = (h: number, lift: number) => {
      if (lift > liftHours + 1e-9) return false
      if (h <= hours) {
        hours -= h
      } else if (h <= hours + overtimeLeft) {
        usedOvertime += h - hours
        overtimeLeft -= h - hours
        hours = 0
      } else return false
      liftHours -= lift
      stats.hoursNeeded += h
      return true
    }

    // 5. Preparación y despacho: primero los pedidos más viejos. Un pedido que no entra en el día queda atrasado.
    const shippedPallets = new Map<number, number>()
    const shippedValue = new Map<number, number>()
    const remaining: ClientOrder[] = []
    for (const order of this.queue) {
      if (!open) {
        remaining.push(order)
        continue
      }
      let cases = 0
      let full = 0
      const picks = order.lines.map((l) => {
        const p = this.products[l.sku]
        const qty = Math.min(l.qty, Math.max(0, this.onHand[l.sku]))
        const f = Math.floor(qty / p.unitsPerPallet)
        full += f
        cases += Math.ceil((qty - f * p.unitsPerPallet) / p.unitsPerCase - 1e-9)
        return qty
      })
      const outPallets = full + Math.ceil(cases / P.mixedCasesPerPallet)
      const h = cases / P.casesPerHour + full / P.fullPalletsPerHour + outPallets / P.loadPalletsPerHour
      const lift = (full + outPallets) / P.forkliftMovesPerHour
      if (!take(h, lift)) {
        remaining.push(order)
        continue
      }
      if (order.due === day) stats.ordersOnTime++
      order.lines.forEach((l, i) => {
        const p = this.products[l.sku]
        const qty = picks[i]
        this.onHand[l.sku] -= qty
        stats.requested += l.qty
        stats.shipped += qty
        stats.revenue += qty * p.price
        stats.cogs += qty * p.cost
        shippedValue.set(order.client, (shippedValue.get(order.client) ?? 0) + qty * p.cost)
        const missing = l.qty - qty
        if (missing > 0) {
          stats.short += missing
          if (sc.shortage === 'backorder') this.pending[order.client][l.sku] += missing
          else stats.lostSales += missing * p.price
          costs.shortage += missing * p.price * t.shortagePenalty
        }
      })
      shippedPallets.set(order.client, (shippedPallets.get(order.client) ?? 0) + outPallets)
      stats.palletsOut += outPallets
    }
    stats.ordersDue = this.queue.filter((o) => o.due === day).length
    this.queue = remaining
    stats.backlog = remaining.length

    // 6. Recepción con la capacidad que sobra.
    this.receiving = this.receiving.filter((o) => {
      if (!open) return true
      const pallets = this.palletsOf(o.sku, o.qty)
      if (!take(pallets / P.receivePalletsPerHour, pallets / P.forkliftMovesPerHour)) return true
      this.onHand[o.sku] += o.qty
      this.onOrder[o.sku] -= o.qty
      stats.palletsIn += pallets
      return false
    })
    stats.forkliftUse = open && dec.forklifts ? 1 - liftHours / (dec.forklifts * dec.shifts * P.shiftHours) : 0

    // 7. Transporte: un viaje directo por cliente; primero los camiones propios, el resto con fletes.
    this.truckBusy = this.truckBusy.map((d) => d - 1).filter((d) => d > 0)
    let ownFree = Math.max(0, dec.ownTrucks - this.truckBusy.length)
    let ownKm = 0
    let truckSlots = 0
    const trips = [...shippedPallets.entries()].sort((a, b) => CLIENTS[b[0]].km - CLIENTS[a[0]].km)
    for (const [c, pallets] of trips) {
      const trucks = Math.max(1, Math.ceil(pallets / P.truckPallets))
      const km = CLIENTS[c].km * 2
      const tripDays = Math.max(1, Math.ceil((km / P.truckKmh + P.stopHours) / P.driveHoursPerDay))
      const own = Math.min(trucks, ownFree)
      ownFree -= own
      for (let i = 0; i < own; i++) if (tripDays > 1) this.truckBusy.push(tripDays - 1)
      ownKm += own * km
      const hired = trucks - own
      costs.hired += hired * Math.max(t.hiredMinTrip, km * t.hiredKm * (0.6 * sc.fuel + 0.4))
      stats.km += trucks * km
      truckSlots += trucks * P.truckPallets
      stats.shipments.push({ client: c, pallets, trucks, own, km })
      // Stock en el local: lo entregado dura hasta la próxima entrega; en promedio, la mitad del intervalo.
      const interval = 7 / dec.frequency[c]
      costs.storeStock += (shippedValue.get(c) ?? 0) * (interval / 2) * (t.storeHoldingRate / 365)
    }
    costs.fuel = ownKm * t.truckKm * (0.7 * sc.fuel + 0.3)
    stats.truckFill = truckSlots ? stats.palletsOut / truckSlots : 0

    // 8. Reposición: se revisa cada producto con la política de su clase (solo los días hábiles).
    if (open)
      for (const p of this.products) {
        const pol = dec.policy[p.abc]
        // Revisión periódica contada en días hábiles, repartida entre productos para no pedir todo el mismo día.
        const workday = Math.floor(day / 7) * 5 + weekday
        if (pol.kind === 'RS' && (workday + p.id) % Math.max(1, Math.round((pol.reviewDays * 5) / 7)) !== 0) continue
        const position = this.onHand[p.id] + this.onOrder[p.id]
        const { s, q, S } = this.reorderLevels(p.id)
        let qty = 0
        if (pol.kind === 'sQ') {
          if (position > s) continue
          qty = q * Math.ceil((s - position) / q + 1e-9)
        } else {
          qty = Math.ceil(Math.max(0, S - position) / p.unitsPerCase) * p.unitsPerCase
          if (qty <= 0) continue
        }
        const jitter = (hashUniform(sc.seed, day, p.id, 7) - 0.5) * this.leadSpread(p)
        const arrive = day + Math.max(1, Math.round(this.leadTime(p) + jitter))
        this.inbound.push({ sku: p.id, qty, arrive })
        this.onOrder[p.id] += qty
        costs.ordering += p.imported ? t.orderImport : t.orderLocal
        stats.purchaseOrders++
      }

    // 9. Stock y costos del día.
    let pallets = 0
    for (let s = 0; s < n; s++) {
      const qty = Math.max(0, this.onHand[s])
      const pp = this.palletsOf(s, qty)
      stats.palletsBySku[s] = Math.min(65535, pp)
      pallets += pp
      stats.stockValue += qty * this.products[s].cost
    }
    for (const o of this.receiving) pallets += this.palletsOf(o.sku, o.qty)
    stats.pallets = pallets
    costs.rent = (t.rentM2Month * sc.areaM2) / DAYS_PER_MONTH
    costs.capital = (stats.stockValue * t.capitalRate) / 365
    costs.overflow = Math.max(0, pallets - sc.positions) * t.overflowPalletDay
    const shiftCost = (dec.operatorsPerShift * t.operatorMonth) / DAYS_PER_MONTH
    costs.labor = shiftCost * dec.shifts + (dec.shifts === 3 ? shiftCost * t.nightPremium : 0)
    costs.overtime = usedOvertime * (t.operatorMonth / (22 * 8)) * 2
    costs.forklifts = (dec.forklifts * t.forkliftMonth) / DAYS_PER_MONTH
    costs.fleet = (dec.ownTrucks * t.truckMonth) / DAYS_PER_MONTH

    this.days.push(stats)
    this.day++
    return stats
  }

  run(days: number) {
    for (let i = 0; i < days; i++) this.step()
    return this.days
  }
}

export const weekdayName = (d: number) => WEEKDAYS[d % 7]
export { FAMILIES }
