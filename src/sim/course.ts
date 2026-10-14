/**
 * Fórmulas de los modelos de inventario del curso (UTEC, Ingeniería en Logística), con su misma notación:
 * Lote Económico de Compra, Revisión Continua, Revisión Periódica y Can-Order.
 *
 * Unidades: D es anual y H = h·c es anual ($/unidad/año). La demanda media y su desvío se expresan siempre en la
 * unidad de tiempo del lead time (LT) y del período de revisión (R), como pide el curso.
 */

// ——— Normal estándar ———

/** Densidad φ(k). */
export const phi = (k: number) => Math.exp(-0.5 * k * k) / Math.sqrt(2 * Math.PI)

/** Acumulada Φ(k) = P(Z ≤ k) (Excel: DISTR.NORM.ESTAND.N(k; VERDADERO)). Error menor a 1e-7. */
export function Phi(k: number): number {
  // Abramowitz y Stegun 26.2.17.
  const t = 1 / (1 + 0.2316419 * Math.abs(k))
  const poly = t * (0.31938153 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))))
  const p = 1 - phi(k) * poly
  return k >= 0 ? p : 1 - p
}

/** Inversa de Φ (Excel: DISTR.NORM.ESTAND.INV(p)). Algoritmo de Acklam, error relativo menor a 1,2e-9. */
export function invPhi(p: number): number {
  if (p <= 0) return -Infinity
  if (p >= 1) return Infinity
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239]
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572]
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783]
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416]
  const lo = 0.02425
  if (p < lo) {
    const q = Math.sqrt(-2 * Math.log(p))
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  }
  if (p > 1 - lo) return -invPhi(1 - p)
  const q = p - 0.5
  const r = q * q
  return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
}

/** Magnitud de ruptura G(k) (función de pérdida normal): faltante esperado por ciclo, en desvíos. */
export const G = (k: number) => phi(k) - k * (1 - Phi(k))

/** k tal que G(k) = g. G es decreciente; se busca por bisección en [−4, 5]. */
export function invG(g: number): number {
  if (g <= G(5)) return 5
  if (g >= G(-4)) return -4
  let [lo, hi] = [-4, 5]
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2
    if (G(mid) > g) lo = mid
    else hi = mid
  }
  return (lo + hi) / 2
}

// ——— Lote Económico de Compra ———

/** Q* = √(2·D·S / H). */
export const eoq = (D: number, S: number, H: number) => Math.sqrt((2 * D * S) / H)

/** Costo relevante: pedir más mantener, TRC(Q) = S·D/Q + H·Q/2. */
export const trc = (Q: number, D: number, S: number, H: number) => (S * D) / Q + (H * Q) / 2

/** Costo total del modelo EOQ (sin faltantes): CT = c·D + S·D/Q + H·Q/2. */
export const ctEoq = (Q: number, D: number, S: number, H: number, c: number) => c * D + trc(Q, D, S, H)

/** Sensibilidad: TRC(Q) / TRC(Q*) = ½·(Q* / Q + Q / Q*). */
export const sensitivityQ = (Q: number, Qstar: number) => 0.5 * (Qstar / Q + Q / Qstar)

/** Sensibilidad a un error de pronóstico: TRC(Q*_F) / TRC(Q*_A) = ½·(√(D_A/D_F) + √(D_F/D_A)). */
export const sensitivityD = (DA: number, DF: number) => 0.5 * (Math.sqrt(DA / DF) + Math.sqrt(DF / DA))

/** Sensibilidad a la periodicidad: TRC(T) / TRC(T*) = ½·(T / T* + T* / T). */
export const sensitivityT = (T: number, Tstar: number) => 0.5 * (T / Tstar + Tstar / T)

// ——— Variabilidad ———

/** Índice de variabilidad IV = σ / media. */
export const iv = (mean: number, sigma: number) => sigma / mean

/**
 * Desvío estándar combinado: σc = √(σ_d²·tiempo + d²·σ_LT²). En revisión continua el tiempo protegido es el LT; en
 * revisión periódica, LT + R.
 */
export const sigmaC = (d: number, sigmaD: number, time: number, sigmaLT: number) => Math.sqrt(sigmaD * sigmaD * time + d * d * sigmaLT * sigmaLT)

/**
 * Lead time por etapas, como en el ejemplo del arroz: el LT es la suma de los promedios de cada etapa y σ_LT la raíz
 * de la suma de las varianzas (desvío poblacional), suponiendo etapas independientes.
 */
export function leadTimeByStages(orders: number[][]) {
  const stages = orders[0].length
  let mean = 0
  let variance = 0
  for (let j = 0; j < stages; j++) {
    const col = orders.map((o) => o[j])
    const m = col.reduce((s, v) => s + v, 0) / col.length
    mean += m
    variance += col.reduce((s, v) => s + (v - m) ** 2, 0) / col.length
  }
  return { LT: mean, sigmaLT: Math.sqrt(variance) }
}

// ——— Factor de seguridad k (cuatro criterios del curso) ———

/** Criterio con el que la empresa elige k. */
export type Criterion =
  | { kind: 'nsc'; nsc: number }
  | { kind: 'fr'; fr: number }
  | { kind: 'cup'; cup: number }
  | { kind: 'b'; b: number }

export interface KInput {
  /** Demanda anual. */
  D: number
  /** Costo de mantener anual por unidad. */
  H: number
  /** Unidades por pedido: Q* en revisión continua, D_R en revisión periódica. */
  lot: number
  sigmaC: number
}

/**
 * k según el criterio:
 * - 01 costo por unidad perdida: k = DISTR.NORM.ESTAND.INV(1 − lote·H / (D·c_up));
 * - 02 costo por venta no realizada: k = √(2·ln(B·D / (H·lote·σc·√(2π))));
 * - 03 nivel de servicio de ciclo: k = DISTR.NORM.ESTAND.INV(NSC);
 * - 04 fill rate: G(k) = (1 − FR)·lote/σc, y k sale de invertir G.
 * Un k negativo no tiene sentido como factor de seguridad: se toma 0.
 */
export function kFor(c: Criterion, x: KInput): number {
  let k: number
  if (c.kind === 'nsc') k = invPhi(c.nsc)
  else if (c.kind === 'fr') k = invG(((1 - c.fr) * x.lot) / x.sigmaC)
  else if (c.kind === 'cup') k = invPhi(Math.max(1e-9, 1 - (x.lot * x.H) / (x.D * c.cup)))
  else {
    const arg = (c.b * x.D) / (x.H * x.lot * x.sigmaC * Math.sqrt(2 * Math.PI))
    k = arg > 1 ? Math.sqrt(2 * Math.log(arg)) : 0
  }
  return Math.max(0, k)
}

/** NSC = Φ(k). */
export const nscOf = (k: number) => Phi(k)

/** FR = 1 − G(k)·σc / lote. */
export const frOf = (k: number, sigma: number, lot: number) => 1 - (G(k) * sigma) / lot

// ——— Revisión continua (s, Q) ———

export interface ContinuousInput {
  /** Demanda media y desvío por unidad de tiempo del LT. */
  d: number
  sigmaD: number
  LT: number
  sigmaLT: number
  /** Demanda anual, costo de pedir, costo de mantener anual, costo unitario. */
  D: number
  S: number
  H: number
  c: number
  criterion: Criterion
  /** Lote; si no se da, Q* (EOQ). */
  Q?: number
  /** Costo por unidad perdida (para el costo total). */
  cup?: number
}

/**
 * Revisión continua: pedir Q* cuando la posición de inventario cae al punto de reorden.
 * ROP = Demanda_LT + k·σc, SS = k·σc.
 * Costo total: c·D + S·D/Q + H·(Q/2 + SS + Demanda_LT) + c_up·σc·G(k)·D/Q. El apunte escribe el último término como
 * c_up·Q²·(1 − FR); acá se usa la forma equivalente en unidades perdidas por año (σc·G(k) por ciclo, D/Q ciclos),
 * la misma que en revisión periódica.
 */
export function continuousReview(x: ContinuousInput) {
  const Q = x.Q ?? eoq(x.D, x.S, x.H)
  const sc = sigmaC(x.d, x.sigmaD, x.LT, x.sigmaLT)
  const k = kFor(x.criterion, { D: x.D, H: x.H, lot: Q, sigmaC: sc })
  const SS = k * sc
  const DLT = x.d * x.LT
  const ROP = DLT + SS
  const cycles = x.D / Q
  const lost = sc * G(k) * cycles
  const costs = {
    acquisition: x.c * x.D,
    ordering: x.S * cycles,
    cycleStock: (x.H * Q) / 2,
    safetyStock: x.H * SS,
    transit: x.H * DLT,
    shortage: (x.cup ?? 0) * lost,
  }
  return { Q, sigmaC: sc, k, SS, DLT, ROP, cycles, NSC: nscOf(k), FR: frOf(k, sc, Q), lostPerYear: lost, costs, TC: Object.values(costs).reduce((s, v) => s + v, 0) }
}

// ——— Revisión periódica (R, NOP) ———

export interface PeriodicInput extends Omit<ContinuousInput, 'Q'> {
  /** Período de revisión, en la unidad del LT. */
  R: number
  /** Unidades de tiempo del LT que tiene un año (por ejemplo 52 semanas o 365 días). */
  perYear: number
}

/**
 * Revisión periódica: cada R períodos, pedir lo necesario para llegar al Nivel Óptimo de Inventario.
 * NOP = Demanda_(LT+R) + k·σc, con σc = √(σ_d²·(LT + R) + d²·σ_LT²). D_R = d·R.
 * Costo total: c·D + S·D/D_R + H·(D_R/2 + SS + D_LT) + c_up·σc·G(k)·D/D_R.
 */
export function periodicReview(x: PeriodicInput) {
  const sc = sigmaC(x.d, x.sigmaD, x.LT + x.R, x.sigmaLT)
  const DR = x.d * x.R
  const k = kFor(x.criterion, { D: x.D, H: x.H, lot: DR, sigmaC: sc })
  const SS = k * sc
  const DLT = x.d * x.LT
  const NOP = x.d * (x.LT + x.R) + SS
  const cycles = x.D / DR
  const lost = sc * G(k) * cycles
  const costs = {
    acquisition: x.c * x.D,
    ordering: x.S * cycles,
    cycleStock: (x.H * DR) / 2,
    safetyStock: x.H * SS,
    transit: x.H * DLT,
    shortage: (x.cup ?? 0) * lost,
  }
  return { DR, sigmaC: sc, k, SS, DLT, NOP, cycles, NSC: nscOf(k), FR: frOf(k, sc, DR), lostPerYear: lost, costs, TC: Object.values(costs).reduce((s, v) => s + v, 0) }
}

/** Pasa una demanda anual N(media; σ) a la unidad de tiempo del LT: la media se divide y la varianza también. */
export const perPeriod = (annualMean: number, annualSigma: number, periodsPerYear: number) => ({
  d: annualMean / periodsPerYear,
  sigmaD: annualSigma / Math.sqrt(periodsPerYear),
})

// ——— Can-Order (varios artículos del mismo proveedor) ———

export interface CanOrderInput {
  /** Demanda media y desvío por unidad de tiempo del LT. */
  d: number
  sigmaD: number
  LT: number
  sigmaLT: number
  D: number
  /** Costo de emitir un pedido y costo de pedido que se ahorra al sumarse a una orden ya emitida. */
  S: number
  Ssaved: number
  /** Costo de mantener anual y unidades de tiempo del LT por año (para H_t). */
  H: number
  perYear: number
  criterion: Criterion
}

/**
 * Can-Order: ROP obliga a pedir, COP permite sumarse a una orden ya emitida y OBS es el stock al que se repone.
 * ROP = Demanda_LT + k·σc; tiempo de aproximación = S_ahorrado / (H_t·Q); COP = ROP + d·tiempo de aproximación;
 * OBS = ROP + Q, con Q = Q* (EOQ).
 */
export function canOrderLevels(x: CanOrderInput) {
  const Q = eoq(x.D, x.S, x.H)
  const sc = sigmaC(x.d, x.sigmaD, x.LT, x.sigmaLT)
  const k = kFor(x.criterion, { D: x.D, H: x.H, lot: Q, sigmaC: sc })
  const ROP = x.d * x.LT + k * sc
  const Ht = x.H / x.perYear
  const approach = x.Ssaved / (Ht * Q)
  return { Q, sigmaC: sc, k, ROP, approach, COP: ROP + x.d * approach, OBS: ROP + Q }
}

/**
 * Regla de pedido: si algún artículo quedó por debajo de su ROP, se emite la orden y se suman los que están por
 * debajo de su COP. Cada uno pide hasta su OBS. Si ninguno llegó al ROP, no se pide nada.
 */
export function canOrderQuantities(items: { stock: number; ROP: number; COP: number; OBS: number }[]): number[] {
  if (!items.some((i) => i.stock < i.ROP)) return items.map(() => 0)
  return items.map((i) => (i.stock < i.COP ? Math.max(0, i.OBS - i.stock) : 0))
}
