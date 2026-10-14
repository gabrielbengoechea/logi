import { mulberry32 } from './rng'
import { BASE_DECISIONS, BASE_SCENARIO, Simulation, type Decisions, type Scenario } from './engine'
import { summarize, type Summary } from './summary'

/**
 * Modo juego: cada semana el grupo decide (políticas, personal, flota, frecuencias) y después corre la semana. Todos
 * los grupos con el mismo número de partida ven la misma demanda y los mismos eventos, así se pueden comparar.
 */

/** La partida arranca el lunes 6 de setiembre de 2027 y llega hasta la temporada alta de fin de año. */
export const GAME_START_DAY = 248
export const GAME_WEEKS = 16

export type EventKind = 'paro' | 'puerto' | 'promo' | 'gasoil' | 'calor' | 'gripe'

export interface GameEvent {
  kind: EventKind
  week: number
  /** Semanas que dura (el gasoil queda hasta el final). */
  span: number
  title: string
  text: string
}

const POOL: Omit<GameEvent, 'week'>[] = [
  { kind: 'paro', span: 1, title: 'Paro de transporte', text: 'Los fletes contratados cobran 60 % más esta semana. Los camiones propios no paran.' },
  { kind: 'puerto', span: 3, title: 'Congestión en el puerto', text: 'Las importaciones pedidas en las próximas tres semanas demoran 40 % más.' },
  { kind: 'promo', span: 2, title: 'Promoción de bebidas', text: 'Los supermercados lanzan una promoción: la demanda de bebidas sube 50 % por dos semanas.' },
  { kind: 'gasoil', span: 99, title: 'Suba del gasoil', text: 'El gasoil sube 25 % desde esta semana y hasta el final de la partida.' },
  { kind: 'calor', span: 1, title: 'Ola de calor', text: 'Se adelanta el verano: bebidas +40 % e higiene personal +20 % esta semana.' },
  { kind: 'gripe', span: 1, title: 'Brote de gripe', text: 'Falta un cuarto del personal esta semana.' },
]

/** Eventos de una partida: cuatro, en semanas distintas entre la 3 y la 14, sorteados con el número de partida. */
export function gameEvents(seed: number): GameEvent[] {
  const r = mulberry32(seed * 31 + 7)
  const pool = [...POOL]
  const weeks = new Set<number>()
  const out: GameEvent[] = []
  while (out.length < 4) {
    const e = pool.splice(Math.floor(r() * pool.length), 1)[0]
    let week = 2 + Math.floor(r() * 12)
    while (weeks.has(week)) week = 2 + ((week - 1) % 12)
    weeks.add(week)
    out.push({ ...e, week })
  }
  return out.sort((a, b) => a.week - b.week)
}

/** Escenario de una semana: el base con los eventos que estén vigentes. */
export function weekScenario(base: Scenario, events: GameEvent[], week: number): Scenario {
  let s: Scenario = { ...base, familyBoost: {}, staffFactor: 1, tariffs: { ...base.tariffs } }
  for (const e of events) {
    if (week < e.week || week >= e.week + e.span) continue
    if (e.kind === 'paro') s.tariffs.hiredKm *= 1.6
    if (e.kind === 'puerto') s = { ...s, importDelay: s.importDelay * 1.4 }
    if (e.kind === 'promo') s.familyBoost = { ...s.familyBoost, bebidas: (s.familyBoost?.bebidas ?? 1) * 1.5 }
    if (e.kind === 'gasoil') s = { ...s, fuel: s.fuel * 1.25 }
    if (e.kind === 'calor') s.familyBoost = { ...s.familyBoost, bebidas: (s.familyBoost?.bebidas ?? 1) * 1.4, higiene: (s.familyBoost?.higiene ?? 1) * 1.2 }
    if (e.kind === 'gripe') s.staffFactor = (s.staffFactor ?? 1) * 0.75
  }
  return s
}

export const gameScenario = (seed: number): Scenario => ({ ...BASE_SCENARIO, seed, startDayOfYear: GAME_START_DAY })

export interface Game {
  group: string
  seed: number
  events: GameEvent[]
  /** Decisiones de cada semana jugada. */
  history: Decisions[]
  sim: Simulation
}

export function newGame(group: string, seed: number): Game {
  return { group, seed, events: gameEvents(seed), history: [], sim: new Simulation(gameScenario(seed), BASE_DECISIONS) }
}

/** Juega la semana siguiente con estas decisiones. */
export function playWeek(game: Game, decisions: Decisions): Game {
  const week = game.history.length
  game.sim.decisions = decisions
  game.sim.scenario = weekScenario(gameScenario(game.seed), game.events, week)
  game.sim.run(7)
  return { ...game, history: [...game.history, decisions] }
}

export const gameSummary = (game: Game, from = 0, to = game.sim.days.length) => summarize(game.sim.days, game.sim.scenario, from, to)

/** Puntaje: resultado acumulado (margen bruto menos costos logísticos), en dólares. */
export const score = (s: Summary) => s.result

// ——— Código de resultado ———

interface Payload {
  v: 1
  g: string
  s: number
  /** Decisiones de cada semana, como diferencias con la semana anterior. */
  h: Partial<Decisions>[]
  r: number
}

async function deflate(text: string): Promise<Uint8Array> {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function inflate(bytes: Uint8Array): Promise<string> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Response(stream).text()
}

const toB64 = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const fromB64 = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))

/** Código que el grupo entrega al docente: nombre, partida, decisiones de cada semana y resultado. */
export async function encodeGame(game: Game): Promise<string> {
  const h = game.history.map((d, i) => {
    const prev = i ? game.history[i - 1] : BASE_DECISIONS
    return Object.fromEntries(Object.entries(d).filter(([k, v]) => JSON.stringify(v) !== JSON.stringify(prev[k as keyof Decisions])))
  })
  const payload: Payload = { v: 1, g: game.group, s: game.seed, h, r: Math.round(score(gameSummary(game))) }
  return `LOGI-${toB64(await deflate(JSON.stringify(payload)))}`
}

export interface Verified {
  group: string
  seed: number
  weeks: number
  claimed: number
  summary: Summary
  /** El resultado declarado coincide con el que da la simulación. */
  ok: boolean
}

/** Lee un código y vuelve a jugar la partida para verificar el resultado. */
export async function verifyCode(code: string): Promise<Verified> {
  const raw = code.trim().replace(/^LOGI-/, '')
  const p = JSON.parse(await inflate(fromB64(raw))) as Payload
  if (p.v !== 1) throw new Error('Versión de código desconocida')
  let game = newGame(p.g, p.s)
  let dec = BASE_DECISIONS
  for (const delta of p.h) {
    dec = { ...dec, ...delta }
    game = playWeek(game, dec)
  }
  const summary = gameSummary(game)
  return { group: p.g, seed: p.s, weeks: p.h.length, claimed: p.r, summary, ok: Math.round(score(summary)) === p.r }
}
