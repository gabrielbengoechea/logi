import { useEffect, useState } from 'react'
import { ACTIVITIES, ACTIVITY_DECISIONS, ACTIVITY_SCENARIO, correctOption, type Activity } from '../didactic/activities'
import { useStore } from '../store'
import { SectionTitle } from './controls'

/** Una actividad: contexto, pregunta, predicción, simulación y resultado. */
function ActivityView({ a, onBack }: { a: Activity; onBack: () => void }) {
  const running = useStore((s) => s.running)
  const run = useStore((s) => s.run)
  const base = useStore((s) => s.base)
  const inGame = useStore((s) => s.game !== null)
  const [guess, setGuess] = useState<number | null>(null)
  const [asked, setAsked] = useState(false)
  const [done, setDone] = useState(false)
  // Cuando termina la simulación pedida, se muestra el resultado.
  useEffect(() => {
    if (asked && !running) setDone(true)
  }, [asked, running])
  const correct = done ? correctOption(a, base.summary, run.summary) : -1

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[13px] font-semibold text-[var(--accent)]">{a.unit}</div>
        <div className="text-[22px] leading-tight font-bold tracking-tight">{a.title}</div>
      </div>
      <p className="text-[14.5px] leading-snug">{a.context}</p>
      <div>
        <SectionTitle>{a.question}</SectionTitle>
        <div className="inset-list">
          {a.options.map((o, i) => {
            const mark = done ? (i === correct ? '#248a3d' : i === guess ? 'var(--alert)' : undefined) : undefined
            return (
              <button key={o.label} disabled={asked} onClick={() => setGuess(i)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[15px]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2" style={{ borderColor: mark ?? (guess === i ? 'var(--accent)' : '#c7c7cc'), background: guess === i ? (mark ?? 'var(--accent)') : 'transparent' }} />
                <span className="flex-1" style={{ color: mark }}>
                  {o.label}
                </span>
                {done && i === correct && <span className="text-[13px] font-semibold text-[#248a3d]">correcta</span>}
              </button>
            )
          })}
        </div>
      </div>
      {!done && (
        <button
          disabled={guess === null || running || inGame}
          onClick={() => {
            setAsked(true)
            useStore.getState().runActivity([ACTIVITY_DECISIONS, ACTIVITY_SCENARIO], a.change(ACTIVITY_DECISIONS, ACTIVITY_SCENARIO))
          }}
          className="h-11 w-full rounded-[12px] bg-[var(--accent)] text-[15px] font-semibold text-white disabled:opacity-40"
        >
          {running ? 'Simulando dos años…' : guess === null ? 'Elegí una predicción' : 'Simular'}
        </button>
      )}
      {inGame && <p className="px-1 text-[12.5px] text-[var(--alert)]">Cerrá la partida del modo juego para hacer actividades.</p>}
      {done && (
        <div className="space-y-3">
          <p className={`rounded-[12px] px-3 py-2.5 text-[14px] font-semibold ${guess === correct ? 'bg-[#e3f5e6] text-[#1d6b30]' : 'bg-[#fdecea] text-[#9b1c13]'}`}>{guess === correct ? 'La predicción fue correcta.' : 'La simulación dice otra cosa.'}</p>
          <p className="text-[14.5px] leading-snug">{a.explain(base.summary, run.summary)}</p>
          <p className="rounded-[12px] bg-[#fff4e0] px-3 py-2.5 text-[14px] leading-snug text-[#7a4a00]">{a.takeaway}</p>
          <div>
            <SectionTitle>Para discutir</SectionTitle>
            <ul className="list-disc space-y-1 pl-6 text-[14px] leading-snug">
              {a.discuss.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          <p className="px-1 text-[12.5px] text-[var(--ink-3)]">La comparación quedó armada en el Simulador: base = operación normal, ahora = la variante.</p>
        </div>
      )}
      <button onClick={onBack} className="h-9 w-full rounded-[10px] bg-[var(--fill)] text-[14px] font-semibold text-[var(--accent)]">
        Otra actividad
      </button>
    </div>
  )
}

/** Actividades de clase, una por tema del curso. */
export default function Activities() {
  const [open, setOpen] = useState<string | null>(null)
  const a = ACTIVITIES.find((x) => x.key === open)
  if (a) return <ActivityView key={a.key} a={a} onBack={() => setOpen(null)} />
  return (
    <div className="space-y-3">
      <p className="px-1 text-[14px] leading-snug text-[var(--ink-2)]">Cada actividad cambia una sola cosa. Primero se predice, después se simula un año y se compara con la operación normal.</p>
      <div className="inset-list">
        {ACTIVITIES.map((x, i) => (
          <button key={x.key} onClick={() => setOpen(x.key)} className="flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-[#f7f7fa]">
            <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--accent)] text-[14px] font-semibold text-white">{i + 1}</span>
            <span className="flex flex-1 flex-col">
              <span className="text-[15px] font-medium">{x.title}</span>
              <span className="text-[12.5px] text-[var(--ink-2)]">{x.unit}</span>
            </span>
            <span className="text-[18px] leading-none text-[#c7c7cc]">›</span>
          </button>
        ))}
      </div>
    </div>
  )
}
