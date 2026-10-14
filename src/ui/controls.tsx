import type { ReactNode } from 'react'

/** Control segmentado al estilo iOS: riel gris y el segmento elegido en blanco, con sombra. */
export function Segmented<T extends string | number>({
  items,
  value,
  onChange,
  label,
  size = 'md',
}: {
  items: readonly T[]
  value: T
  onChange: (v: T) => void
  label: (v: T) => string
  size?: 'sm' | 'md'
}) {
  return (
    <div className="flex rounded-[10px] p-[3px]" style={{ background: 'var(--fill)' }}>
      {items.map((it) => (
        <button
          key={String(it)}
          onClick={() => onChange(it)}
          className={`flex-1 whitespace-nowrap rounded-[8px] ${size === 'sm' ? 'h-7 px-2.5 text-[12.5px]' : 'h-8 px-4 text-[13px]'} ${it === value ? 'bg-white font-semibold shadow-[0_2px_6px_rgba(0,0,0,0.12)]' : 'text-[var(--ink)]'}`}
        >
          {label(it)}
        </button>
      ))}
    </div>
  )
}

/** Interruptor al estilo iOS. */
export function Toggle({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={`relative h-[28px] w-[46px] shrink-0 rounded-full transition-colors ${on ? 'bg-[#34c759]' : 'bg-[rgba(120,120,128,0.22)]'}`}>
      <span className={`absolute top-[2px] h-6 w-6 rounded-full bg-white shadow-[0_2px_5px_rgba(0,0,0,0.2)] transition-all ${on ? 'left-[20px]' : 'left-[2px]'}`} />
    </button>
  )
}

/** Título de sección de una lista agrupada. */
export function SectionTitle({ children }: { children: ReactNode }) {
  return <div className="px-1 pb-1.5 text-[13px] font-semibold text-[var(--ink-2)]">{children}</div>
}

/** Paso a paso al estilo iOS: − valor +. */
export function Stepper({ value, onChange, min, max, step = 1, format = (v) => String(v), label }: { value: number; onChange: (v: number) => void; min: number; max: number; step?: number; format?: (v: number) => string; label: string }) {
  const fix = (v: number) => Math.round(Math.min(max, Math.max(min, v)) / step) * step
  const btn = 'flex h-8 w-9 items-center justify-center text-[20px] font-light text-[var(--ink)] disabled:opacity-30'
  return (
    <div className="flex items-center gap-2">
      <span className="min-w-[56px] text-right text-[15px] font-semibold tabular-nums">{format(value)}</span>
      <div className="flex overflow-hidden rounded-[9px] bg-[var(--fill)] [&>*+*]:border-l [&>*+*]:border-[rgba(60,60,67,0.18)]">
        <button className={btn} aria-label={`Menos ${label}`} disabled={value <= min} onClick={() => onChange(fix(value - step))}>
          −
        </button>
        <button className={btn} aria-label={`Más ${label}`} disabled={value >= max} onClick={() => onChange(fix(value + step))}>
          +
        </button>
      </div>
    </div>
  )
}

/** Fila de lista agrupada: rótulo (con detalle opcional) y un control a la derecha. */
export function Row({ label, detail, children }: { label: string; detail?: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2">
      <span className="flex flex-col">
        <span className="text-[15px]">{label}</span>
        {detail && <span className="text-[12px] leading-snug text-[var(--ink-2)]">{detail}</span>}
      </span>
      {children}
    </div>
  )
}
