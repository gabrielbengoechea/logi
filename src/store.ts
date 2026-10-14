import { create } from 'zustand'
import { BASE_DECISIONS, BASE_SCENARIO, Simulation, type DayStats, type Decisions, type Scenario } from './sim/engine'
import type { Product } from './sim/catalog'
import { summarize, type Summary } from './sim/summary'
import { newGame, playWeek, type Game } from './sim/game'

export type View = 'nave' | 'andenes' | 'planta' | 'exterior' | 'mapa'
/** Calidad gráfica: alta (sombras, oclusión ambiental y brillo), media (sin oclusión) o baja (sin efectos). */
export type Quality = 'alta' | 'media' | 'baja'
/** Color de los pallets: por familia de producto o por clase ABC. */
export type ColorMode = 'familia' | 'abc'
export type Selection = { kind: 'product'; id: number } | { kind: 'dock'; index: number } | null
export type IconTint = 'sistema' | 'azul' | 'grafito' | 'puerto' | 'trazo'

export const UI_SCALES = [0.85, 1, 1.15, 1.3] as const
export type UiScale = (typeof UI_SCALES)[number]

/** Días que se simulan de una vez en el modo libre. */
export const HORIZON_DAYS = 364

function saved<T>(key: string, ok: (v: unknown) => v is T, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    const v = raw === null ? null : JSON.parse(raw)
    return ok(v) ? v : fallback
  } catch {
    return fallback
  }
}

function persist(key: string, v: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(v))
  } catch {
    // Sin almacenamiento (ventana privada): la preferencia dura hasta recargar.
  }
}

export interface Run {
  sim: Simulation
  products: Product[]
  days: DayStats[]
  summary: Summary
}

function simulate(scenario: Scenario, decisions: Decisions): Run {
  const sim = new Simulation(scenario, decisions)
  const days = sim.run(HORIZON_DAYS)
  return { sim, products: sim.products, days, summary: summarize(days, scenario) }
}

/** Corrida guardada para comparar: sus decisiones, su escenario y sus indicadores. */
export interface Base {
  decisions: Decisions
  scenario: Scenario
  summary: Summary
}

interface State {
  scenario: Scenario
  decisions: Decisions
  run: Run
  base: Base
  /** Simulando (un año tarda alrededor de un segundo). */
  running: boolean
  /** Partida del modo juego en curso (mientras dura, la escena muestra lo jugado). */
  game: Game | null
  /** Corrida del simulador, para volver a ella al salir del juego. */
  freeRun: Run | null
  /** Tiempo, en horas desde el inicio. */
  t: number
  playing: boolean
  /** Horas simuladas por segundo real. */
  speed: number
  view: View
  selection: Selection
  colorMode: ColorMode
  quality: Quality
  qualityLocked: boolean
  dayNight: boolean
  presenting: boolean
  iconTint: IconTint
  uiScale: UiScale

  /** Cambia decisiones o escenario y vuelve a simular el año. */
  apply: (decisions: Decisions, scenario?: Scenario) => void
  setBase: () => void
  startGame: (group: string, seed: number) => void
  playGameWeek: (decisions: Decisions) => void
  quitGame: () => void
  restoreBase: () => void
  setT: (t: number) => void
  advance: (seconds: number) => void
  togglePlay: () => void
  setSpeed: (s: number) => void
  setView: (v: View) => void
  select: (s: Selection) => void
  setColorMode: (m: ColorMode) => void
  setQuality: (q: Quality, byUser?: boolean) => void
  setDayNight: (on: boolean) => void
  setPresenting: (on: boolean) => void
  setIconTint: (t: IconTint) => void
  setUiScale: (s: UiScale) => void
}

const SCALES = UI_SCALES as readonly number[]

export const useStore = create<State>((set, get) => ({
  scenario: BASE_SCENARIO,
  decisions: BASE_DECISIONS,
  ...(() => {
    const run = simulate(BASE_SCENARIO, BASE_DECISIONS)
    return { run, base: { decisions: BASE_DECISIONS, scenario: BASE_SCENARIO, summary: run.summary } }
  })(),
  running: false,
  game: null,
  freeRun: null,
  // Arranca el primer lunes a media mañana, con la nave trabajando.
  t: 10,
  playing: true,
  speed: 1,
  view: 'nave',
  selection: null,
  colorMode: 'familia',
  quality: typeof window !== 'undefined' && window.innerWidth < 900 ? 'media' : 'alta',
  qualityLocked: false,
  dayNight: true,
  presenting: false,
  iconTint: saved('logi-iconos', (v): v is IconTint => typeof v === 'string' && ['sistema', 'azul', 'grafito', 'puerto', 'trazo'].includes(v), 'puerto'),
  uiScale: saved('logi-escala', (v): v is UiScale => typeof v === 'number' && SCALES.includes(v), 1),

  apply: (decisions, scenario = get().scenario) => {
    set({ decisions, scenario, running: true })
    // Se deja pintar el aviso de "simulando" antes de bloquear el hilo.
    setTimeout(() => set({ run: simulate(scenario, decisions), running: false, selection: null }), 30)
  },
  startGame: (group, seed) => {
    set({ game: newGame(group, seed), freeRun: get().freeRun ?? get().run })
  },
  playGameWeek: (decisions) => {
    const g = get().game
    if (!g) return
    set({ running: true })
    setTimeout(() => {
      const game = playWeek(g, decisions)
      const days = game.sim.days.slice()
      const week = game.history.length - 1
      set({
        game,
        decisions,
        scenario: game.sim.scenario,
        run: { sim: game.sim, products: game.sim.products, days, summary: summarize(days, game.sim.scenario) },
        running: false,
        selection: null,
        // La escena muestra la semana recién jugada desde el lunes a primera hora.
        t: week * 7 * 24 + 6,
        playing: true,
        speed: 4,
      })
    }, 30)
  },
  quitGame: () => {
    const free = get().freeRun
    set({ game: null, freeRun: null, ...(free ? { run: free, scenario: free.sim.scenario, decisions: free.sim.decisions, t: 10 } : {}) })
  },
  setBase: () => {
    const { decisions, scenario, run } = get()
    set({ base: { decisions, scenario, summary: run.summary } })
  },
  restoreBase: () => get().apply(get().base.decisions, get().base.scenario),
  setT: (t) => set({ t: Math.min(Math.max(0, t), get().run.days.length * 24 - 0.01) }),
  advance: (seconds) => {
    const { playing, speed, t, run } = get()
    if (!playing) return
    const next = t + seconds * speed
    const end = run.days.length * 24
    if (next >= end) set({ t: end - 0.01, playing: false })
    else set({ t: next })
  },
  togglePlay: () => set({ playing: !get().playing }),
  setSpeed: (speed) => set({ speed }),
  setView: (view) => set({ view }),
  select: (selection) => set({ selection }),
  setColorMode: (colorMode) => set({ colorMode }),
  setQuality: (quality, byUser = false) => set({ quality, qualityLocked: byUser || get().qualityLocked }),
  setDayNight: (dayNight) => set({ dayNight }),
  setPresenting: (presenting) => set({ presenting }),
  setIconTint: (iconTint) => {
    persist('logi-iconos', iconTint)
    set({ iconTint })
  },
  setUiScale: (uiScale) => {
    persist('logi-escala', uiScale)
    set({ uiScale })
  },
}))

/** Día simulado (0 = primer lunes) para un tiempo en horas. */
export const dayOf = (t: number) => Math.min(useStore.getState().run.days.length - 1, Math.max(0, Math.floor(t / 24)))
