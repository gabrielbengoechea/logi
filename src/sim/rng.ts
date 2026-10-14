/** Generador pseudoaleatorio con semilla (mulberry32): mismo escenario, mismos resultados. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Número al azar en [0, 1) que depende solo de sus argumentos (no de cuántos se sortearon antes). Así la demanda de
 * un día no cambia según las decisiones del jugador: todos los grupos con la misma semilla ven la misma demanda.
 */
export function hashUniform(seed: number, a: number, b = 0, c = 0): number {
  let h = (seed ^ 0x9e3779b9) >>> 0
  for (const v of [a, b, c]) {
    h = Math.imul(h ^ (v >>> 0), 0x85ebca6b)
    h ^= h >>> 13
    h = Math.imul(h, 0xc2b2ae35)
    h ^= h >>> 16
  }
  return (h >>> 0) / 4294967296
}

/** Normal estándar a partir de dos uniformes (Box-Muller). */
export function normalFrom(u1: number, u2: number): number {
  return Math.sqrt(-2 * Math.log(Math.max(u1, 1e-12))) * Math.cos(2 * Math.PI * u2)
}

/** Poisson de media m. Inversión para medias chicas; aproximación normal para medias grandes. */
export function poissonFrom(m: number, u1: number, u2: number): number {
  if (m <= 0) return 0
  if (m > 30) return Math.max(0, Math.round(m + Math.sqrt(m) * normalFrom(u1, u2)))
  let k = 0
  let p = Math.exp(-m)
  let cdf = p
  while (u1 > cdf && k < 200) {
    k++
    p *= m / k
    cdf += p
  }
  return k
}

/** Gamma de media 1 y coeficiente de variación cv (Marsaglia-Tsang), con un generador para los sorteos internos. */
export function gammaMean1(cv: number, rand: () => number): number {
  if (cv <= 0) return 1
  const k = 1 / (cv * cv)
  const shape = k < 1 ? k + 1 : k
  const d = shape - 1 / 3
  const c = 1 / Math.sqrt(9 * d)
  for (;;) {
    let x: number
    let v: number
    do {
      x = normalFrom(rand(), rand())
      v = 1 + c * x
    } while (v <= 0)
    v = v * v * v
    const u = rand()
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) {
      const g = d * v
      return (k < 1 ? g * rand() ** (1 / k) : g) / k
    }
  }
}
