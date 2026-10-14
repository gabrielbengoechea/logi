import { useState, type ReactNode } from 'react'
import { useStore } from '../store'
import Calculator from './Calculator'
import { SectionTitle } from './controls'
import { Icon, type IconName } from './icons'
import Simulator from './Simulator'
import Activities from './Activities'
import Deliveries from './Deliveries'
import GamePanel from './Game'
import Legend from './Legend'
import ProductCard from './ProductCard'
import Today from './Today'

type Route = 'inicio' | 'simulador' | 'calculadora' | 'juego' | 'actividades'
const TITLES: Record<Exclude<Route, 'inicio'>, string> = { simulador: 'Simulador', calculadora: 'Calculadora del curso', juego: 'Modo juego', actividades: 'Actividades' }

/** Fila de lista que lleva a otra pantalla de la barra lateral. */
function LinkRow({ icon, label, detail, onClick }: { icon: IconName; label: string; detail?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex w-full items-center gap-3 px-3 py-2.5 text-left text-[15px] hover:bg-[#f7f7fa]">
      <span style={{ color: 'var(--icon-link)' }}>
        <Icon name={icon} size={20} />
      </span>
      <span className="flex flex-1 flex-col">
        <span>{label}</span>
        {detail && <span className="text-[12px] text-[var(--ink-2)]">{detail}</span>}
      </span>
      <span className="text-[18px] leading-none text-[#c7c7cc]">›</span>
    </button>
  )
}

/**
 * Barra lateral: el centro logístico, los indicadores del día y la mercadería. Lo que se toca en la escena (un pallet)
 * muestra su ficha acá mismo.
 */
export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 640)
  const [route, setRoute] = useState<Route>('inicio')
  const selection = useStore((s) => s.selection)
  const view = useStore((s) => s.view)
  const game = useStore((s) => s.game)

  let body: ReactNode
  if (selection?.kind === 'product') body = <ProductCard id={selection.id} />
  else if (route === 'simulador') body = <Simulator />
  else if (route === 'juego') body = <GamePanel />
  else if (route === 'actividades') body = <Activities />
  else if (route === 'calculadora') body = <Calculator />
  else if (view === 'mapa') body = <Deliveries />
  else
    body = (
      <div className="space-y-5">
        <Today />
        <Legend />
        <div>
          <SectionTitle>Explorar</SectionTitle>
          <div className="inset-list">
            <LinkRow icon="juego" label="Modo juego" detail={game ? `${game.group} · semana ${Math.min(16, game.history.length + 1)}` : 'Semana a semana, con competencia entre grupos'} onClick={() => setRoute('juego')} />
            <LinkRow icon="check" label="Actividades" detail="Predecir, simular y discutir" onClick={() => setRoute('actividades')} />
            <LinkRow icon="ajustes" label="Simulador" detail="Políticas, operación y escenario" onClick={() => setRoute('simulador')} />
            <LinkRow icon="tarea" label="Calculadora del curso" detail="EOQ, revisión continua y periódica, can-order" onClick={() => setRoute('calculadora')} />
          </div>
        </div>
      </div>
    )

  const home = !selection && route === 'inicio'
  return (
    <aside className="material pointer-events-auto flex max-h-full w-full flex-col overflow-hidden rounded-[22px] sm:w-[340px]">
      <header className="flex items-start gap-2 px-5 pt-4 pb-3">
        {route !== 'inicio' && !selection && !collapsed ? (
          <div className="flex flex-1 flex-col items-start">
            <button onClick={() => setRoute('inicio')} className="-ml-1.5 flex items-center gap-0.5 text-[15px] text-[var(--accent)]">
              <Icon name="atras" size={20} stroke={2.4} />
              Ruta 5
            </button>
            <span className="text-[26px] leading-tight font-bold tracking-tight">{TITLES[route]}</span>
          </div>
        ) : (
          <div className="flex flex-1 flex-col">
            <span className="text-[13px] font-medium text-[var(--ink-2)]">Centro Logístico 3D</span>
            <span className="text-[26px] leading-tight font-bold tracking-tight">Ruta 5</span>
            {!collapsed && home && <span className="text-[13px] text-[var(--ink-2)]">Montevideo · 10.000 m² · operación simulada</span>}
          </div>
        )}
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
          <div key={`${route}-${selection?.kind ?? ""}-${view === "mapa"}-${game?.history.length ?? -1}`} className="min-h-0 flex-1 overflow-y-auto px-4 pb-4">
            {body}
          </div>
          {home && <p className="px-5 pb-4 text-[11px] leading-snug text-[var(--ink-3)]">Nave, catálogo, demanda y costos simulados. Los costos son estimados (USD).</p>}
        </>
      )}
    </aside>
  )
}
