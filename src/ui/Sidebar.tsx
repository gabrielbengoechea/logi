import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import { SectionTitle } from './controls'
import { Icon, type IconName } from './icons'
import Deliveries from './Deliveries'
import Legend from './Legend'
import ProductCard from './ProductCard'
import Today from './Today'

/** Fila de lista para lo que todavía no está (se muestra, pero sin entrar). */
function SoonRow({ icon, label, detail }: { icon: IconName; label: string; detail: string }) {
  return (
    <div className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[15px] text-[var(--ink-3)]">
      <Icon name={icon} size={20} />
      <span className="flex-1">{label}</span>
      <span className="text-[13px]">{detail}</span>
    </div>
  )
}

/**
 * Barra lateral: el centro logístico, los indicadores del día y la mercadería. Lo que se toca en la escena (un pallet)
 * muestra su ficha acá mismo.
 */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const selection = useStore((s) => s.selection)
  const view = useStore((s) => s.view)

  let body: ReactNode
  if (selection?.kind === 'product') body = <ProductCard id={selection.id} />
  else if (view === 'mapa') body = <Deliveries />
  else
    body = (
      <div className="space-y-5">
        <Today />
        <Legend />
        <div>
          <SectionTitle>Explorar</SectionTitle>
          <div className="inset-list">
            <SoonRow icon="juego" label="Modo juego" detail="Próximamente" />
            <SoonRow icon="ajustes" label="Simulador" detail="Próximamente" />
          </div>
        </div>
      </div>
    )

  const home = !selection
  return (
    <aside className="material pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-[22px] sm:w-[340px]">
      <header className="flex items-start gap-2 px-5 pt-4 pb-3">
        <div className="flex flex-1 flex-col">
          <span className="text-[13px] font-medium text-[var(--ink-2)]">Centro Logístico 3D</span>
          <span className="text-[26px] leading-tight font-bold tracking-tight">Ruta 5</span>
          {!collapsed && home && <span className="text-[13px] text-[var(--ink-2)]">Montevideo · 10.000 m² · operación simulada</span>}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Mostrar el panel' : 'Achicar el panel'}
          className="mt-1 flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[var(--fill)] text-[var(--ink-2)]"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden style={{ transform: collapsed ? 'rotate(180deg)' : undefined }}>
            <path d="M6 15l6-6 6 6" />
          </svg>
        </button>
      </header>
      {!collapsed && (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">{body}</div>
          {home && <p className="px-5 pb-4 text-[11px] leading-snug text-[var(--ink-3)]">Nave, catálogo, demanda y costos simulados. Los costos son estimados (USD).</p>}
        </>
      )}
    </aside>
  )
}
