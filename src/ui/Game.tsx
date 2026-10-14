import { useEffect, useState } from 'react'
import { GAME_START_DAY, GAME_WEEKS, encodeGame, gameSummary, verifyCode, type Verified } from '../sim/game'
import { useStore } from '../store'
import { SectionTitle } from './controls'
import { dateLabel, pct1, usd } from './format'
import { DecisionsEditor } from './Simulator'

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' }) {
  return (
    <div className="flex justify-between px-3 py-2 text-[14.5px]">
      <span>{label}</span>
      <span className="font-semibold tabular-nums" style={{ color: tone === 'bad' ? 'var(--alert)' : tone === 'good' ? '#248a3d' : undefined }}>
        {value}
      </span>
    </div>
  )
}

/** Pantalla del docente: pega los códigos de los grupos, se vuelven a jugar y se ordenan por resultado. */
function Compare({ onBack }: { onBack: () => void }) {
  const [text, setText] = useState('')
  const [rows, setRows] = useState<(Verified | { error: string; code: string })[]>([])
  const [busy, setBusy] = useState(false)
  const check = async () => {
    setBusy(true)
    const out: (Verified | { error: string; code: string })[] = []
    for (const code of text.split(/\s+/).filter((c) => c.startsWith('LOGI-'))) {
      try {
        out.push(await verifyCode(code))
      } catch {
        out.push({ error: 'Código ilegible', code: code.slice(0, 16) })
      }
      setRows([...out])
    }
    setBusy(false)
  }
  const ok = rows.filter((r): r is Verified => 'summary' in r).sort((a, b) => b.summary.result - a.summary.result)
  return (
    <div className="space-y-4">
      <p className="px-1 text-[13.5px] leading-snug text-[var(--ink-2)]">
        Pegá los códigos de los grupos (uno por línea). La app vuelve a jugar cada partida con sus decisiones y comprueba el resultado.
      </p>
      <textarea value={text} onChange={(e) => setText(e.target.value)} rows={6} placeholder="LOGI-…" className="w-full rounded-[12px] bg-white p-3 font-mono text-[12px] outline-none focus:ring-2 focus:ring-[var(--accent)]" />
      <div className="flex gap-2">
        <button onClick={check} disabled={busy || !text.trim()} className="h-10 flex-1 rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white disabled:opacity-40">
          {busy ? 'Verificando…' : 'Verificar y ordenar'}
        </button>
        <button onClick={onBack} className="h-10 rounded-[12px] bg-[var(--fill)] px-4 text-[15px] font-semibold text-[var(--accent)]">
          Volver
        </button>
      </div>
      {ok.length > 0 && (
        <div className="inset-list text-[13.5px]">
          <div className="flex px-3 py-1.5 text-[12px] font-semibold text-[var(--ink-2)]">
            <span className="w-6">#</span>
            <span className="flex-1">Grupo</span>
            <span className="w-[86px] text-right">Resultado</span>
            <span className="w-[58px] text-right">Fill rate</span>
          </div>
          {ok.map((r, i) => (
            <div key={i} className="flex items-center px-3 py-2">
              <span className="w-6 font-semibold">{i + 1}</span>
              <span className="flex flex-1 flex-col">
                <span className="font-medium">{r.group}</span>
                <span className="text-[11.5px]" style={{ color: r.ok ? '#248a3d' : 'var(--alert)' }}>
                  {r.ok ? '✓ verificado' : '✗ no coincide'} · partida {r.seed} · {r.weeks} semanas
                </span>
              </span>
              <span className="w-[86px] text-right font-semibold tabular-nums">{usd(r.summary.result)}</span>
              <span className="w-[58px] text-right tabular-nums">{pct1(r.summary.fill)}</span>
            </div>
          ))}
        </div>
      )}
      {rows.some((r) => 'error' in r) && <p className="px-1 text-[12.5px] text-[var(--alert)]">Algún código no se pudo leer: revisá que esté completo.</p>}
    </div>
  )
}

/** Modo juego: cada semana el grupo decide y juega; al final obtiene un código para entregar. */
export default function GamePanel() {
  const game = useStore((s) => s.game)
  const running = useStore((s) => s.running)
  const stored = useStore((s) => s.decisions)
  const { startGame, playGameWeek, quitGame } = useStore.getState()
  const [group, setGroup] = useState('')
  const [seed, setSeed] = useState(1)
  const [compare, setCompare] = useState(false)
  const [dec, setDec] = useState(stored)
  const [code, setCode] = useState('')
  const week = game?.history.length ?? 0
  const done = !!game && week >= GAME_WEEKS
  useEffect(() => setDec(stored), [stored])
  useEffect(() => {
    if (done && game) encodeGame(game).then(setCode)
    else setCode('')
  }, [done, game])

  if (compare) return <Compare onBack={() => setCompare(false)} />

  if (!game)
    return (
      <div className="space-y-4">
        <p className="px-1 text-[14px] leading-snug text-[var(--ink-2)]">
          Ustedes manejan el centro logístico durante {GAME_WEEKS} semanas, de setiembre a fin de año. Cada semana deciden políticas, personal, flota y frecuencias, y ven qué pasa. Gana el mejor resultado: margen bruto menos costos logísticos.
        </p>
        <p className="px-1 text-[13px] leading-snug text-[var(--ink-3)]">Todos los grupos con el mismo número de partida tienen la misma demanda y los mismos imprevistos.</p>
        <div className="inset-list">
          <label className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-[15px]">Grupo</span>
            <input value={group} onChange={(e) => setGroup(e.target.value)} placeholder="Nombre del grupo" className="w-[170px] rounded-[8px] bg-[var(--fill)] px-2 py-1.5 text-right text-[15px] outline-none focus:ring-2 focus:ring-[var(--accent)]" />
          </label>
          <label className="flex items-center justify-between gap-3 px-3 py-2">
            <span className="text-[15px]">Partida n.º</span>
            <input inputMode="numeric" value={seed} onChange={(e) => setSeed(Math.max(1, Number(e.target.value) || 1))} className="w-[80px] rounded-[8px] bg-[var(--fill)] px-2 py-1.5 text-right text-[15px] tabular-nums outline-none focus:ring-2 focus:ring-[var(--accent)]" />
          </label>
        </div>
        <button onClick={() => startGame(group.trim() || 'Grupo sin nombre', seed)} className="h-11 w-full rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white">
          Empezar la partida
        </button>
        <button onClick={() => setCompare(true)} className="h-10 w-full rounded-[12px] bg-[var(--fill)] text-[15px] font-semibold text-[var(--accent)]">
          Comparar grupos (docente)
        </button>
      </div>
    )

  const total = week ? gameSummary(game) : null
  const last = week ? gameSummary(game, (week - 1) * 7, week * 7) : null
  const event = game.events.find((e) => week >= e.week && week < e.week + e.span)
  const from = dateLabel(week * 7, GAME_START_DAY)
  const to = dateLabel(week * 7 + 6, GAME_START_DAY)

  return (
    <div className="space-y-5">
      <div className="rounded-[16px] bg-[var(--ink)] px-4 py-3 text-white">
        <div className="text-[13px] opacity-75">
          {game.group} · partida {game.seed}
        </div>
        <div className="text-[22px] leading-tight font-bold">{done ? 'Partida terminada' : `Semana ${week + 1} de ${GAME_WEEKS}`}</div>
        {!done && (
          <div className="text-[13px] opacity-75">
            {from} al {to}
          </div>
        )}
        {total && (
          <div className="mt-2 flex justify-between text-[14px]">
            <span>Resultado acumulado</span>
            <span className="font-semibold tabular-nums">{usd(total.result)}</span>
          </div>
        )}
      </div>

      {event && !done && (
        <div className="rounded-[14px] bg-[#fff4e0] px-4 py-3 text-[#7a4a00]">
          <div className="text-[15px] font-semibold">{event.title}</div>
          <div className="text-[13.5px] leading-snug">{event.text}</div>
        </div>
      )}

      {last && (
        <div>
          <SectionTitle>{done ? 'Última semana' : 'La semana pasada'}</SectionTitle>
          <div className="inset-list">
            <Stat label="Resultado de la semana" value={usd(last.result)} tone={last.result < 0 ? 'bad' : undefined} />
            <Stat label="Fill rate" value={pct1(last.fill)} tone={last.fill < 0.95 ? 'bad' : 'good'} />
            <Stat label="Ventas perdidas" value={usd(last.lostSales)} tone={last.lostSales > 0 ? 'bad' : undefined} />
            <Stat label="Pedidos a tiempo" value={pct1(last.onTime)} tone={last.onTime < 0.97 ? 'bad' : undefined} />
            <Stat label="Costo logístico" value={usd(last.logisticsCost)} />
            <Stat label="Ocupación máxima" value={pct1(last.occupancyMax)} tone={last.occupancyMax > 1 ? 'bad' : undefined} />
          </div>
        </div>
      )}

      {done && total && (
        <div className="space-y-3">
          <div className="inset-list">
            <Stat label="Resultado final" value={usd(total.result)} />
            <Stat label="Fill rate" value={pct1(total.fill)} />
            <Stat label="Ventas perdidas" value={usd(total.lostSales)} />
            <Stat label="Costo logístico" value={usd(total.logisticsCost)} />
          </div>
          <SectionTitle>Código para entregar</SectionTitle>
          <textarea readOnly value={code} rows={4} className="w-full rounded-[12px] bg-white p-3 font-mono text-[11.5px] break-all" onFocus={(e) => e.target.select()} />
          <button onClick={() => navigator.clipboard?.writeText(code)} className="h-10 w-full rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white">
            Copiar el código
          </button>
        </div>
      )}

      {!done && (
        <>
          <DecisionsEditor dec={dec} onChange={setDec} reference={stored} />
          <button disabled={running} onClick={() => playGameWeek(dec)} className="h-11 w-full rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white disabled:opacity-40">
            {running ? 'Jugando…' : `Jugar la semana ${week + 1}`}
          </button>
        </>
      )}
      <div className="flex gap-2">
        <button onClick={quitGame} className="h-9 flex-1 rounded-[10px] bg-[var(--fill)] text-[14px] font-semibold text-[var(--alert)]">
          {done ? 'Cerrar la partida' : 'Abandonar'}
        </button>
        <button onClick={() => setCompare(true)} className="h-9 flex-1 rounded-[10px] bg-[var(--fill)] text-[14px] font-semibold text-[var(--accent)]">
          Comparar grupos
        </button>
      </div>
    </div>
  )
}
