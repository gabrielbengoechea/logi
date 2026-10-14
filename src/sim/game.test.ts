import { describe, expect, it } from 'vitest'
import { BASE_DECISIONS } from './engine'
import { encodeGame, gameEvents, gameSummary, newGame, playWeek, score, verifyCode, weekScenario, gameScenario } from './game'

describe('modo juego', () => {
  it('la misma partida tiene los mismos eventos, en semanas distintas', () => {
    expect(gameEvents(5)).toEqual(gameEvents(5))
    const weeks = gameEvents(5).map((e) => e.week)
    expect(new Set(weeks).size).toBe(4)
    expect(weeks.every((w) => w >= 2 && w <= 13)).toBe(true)
  })

  it('los eventos cambian el escenario solo mientras duran', () => {
    const ev = [{ kind: 'gripe' as const, week: 3, span: 1, title: '', text: '' }]
    expect(weekScenario(gameScenario(1), ev, 3).staffFactor).toBe(0.75)
    expect(weekScenario(gameScenario(1), ev, 4).staffFactor).toBe(1)
  })

  it('el código se vuelve a jugar y da el mismo resultado', async () => {
    let g = newGame('Grupo 1', 3)
    g = playWeek(g, BASE_DECISIONS)
    g = playWeek(g, { ...BASE_DECISIONS, ownTrucks: 4, operatorsPerShift: 10 })
    g = playWeek(g, { ...BASE_DECISIONS, ownTrucks: 4 })
    const code = await encodeGame(g)
    expect(code.startsWith('LOGI-')).toBe(true)
    const v = await verifyCode(code)
    expect(v.ok).toBe(true)
    expect(v.group).toBe('Grupo 1')
    expect(v.weeks).toBe(3)
    expect(Math.round(score(v.summary))).toBe(Math.round(score(gameSummary(g))))
  })

  it('un código con el resultado cambiado no verifica', async () => {
    let g = newGame('Tramposo', 3)
    g = playWeek(g, BASE_DECISIONS)
    const code = await encodeGame(g)
    const raw = code.slice(5)
    const bytes = Uint8Array.from(atob(raw.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0))
    const text = await new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).text()
    const p = JSON.parse(text)
    p.r += 100000
    const back = new Uint8Array(await new Response(new Blob([JSON.stringify(p)]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer())
    const forged = 'LOGI-' + btoa(String.fromCharCode(...back)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
    expect((await verifyCode(forged)).ok).toBe(false)
  })
})
