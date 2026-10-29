import { useEffect } from 'react'
import { useStore } from '../store'
import { BottomControls, TopControls, ViewSwitcher } from './MapControls'
import Player from './Player'
import Sidebar from './Sidebar'
import ProductCard from './ProductCard'
import { AvisoAPie, BotonesVR } from '../vr/ui'
import { useEnXR } from '../vr/r3f'
import { TARJETAS, TARJETAS_PANTALLA, TITULO } from '../vr/app'

/** En modo presentación la interfaz se agranda para leerse desde el fondo del aula. */
const PRESENT_ZOOM = 1.3

/**
 * Capa de interfaz sobre la escena: barra lateral a la izquierda, vistas arriba, controles a la derecha y el
 * reproductor abajo. Solo los paneles reciben clics; el resto pasa a la escena.
 */
export default function Hud() {
  const presenting = useStore((s) => s.presenting)
  const iconTint = useStore((s) => s.iconTint)
  const uiScale = useStore((s) => s.uiScale)
  useEffect(() => {
    document.documentElement.dataset.icons = iconTint
  }, [iconTint])
  const scale = uiScale * (presenting ? PRESENT_ZOOM : 1)
  const zoom = scale !== 1 ? { zoom: scale } : undefined

  return (
    <div className="pointer-events-none absolute inset-0 z-30" style={zoom}>
      <FichaParaVisor />
      <div className="absolute top-2 right-[60px] left-2 flex max-h-[52%] items-start sm:top-4 sm:right-auto sm:bottom-4 sm:left-4 sm:max-h-none">
        <Sidebar />
      </div>
      <div className="absolute top-4 right-20 left-[372px] hidden justify-center sm:flex">
        <ViewSwitcher />
      </div>
      <div className="absolute top-2 right-2 flex flex-col items-end gap-2.5 sm:top-4 sm:right-4">
        <TopControls />
        <BotonesVR titulo={TITULO} tarjetas={TARJETAS} tarjetasPantalla={TARJETAS_PANTALLA} />
      </div>
      <div className="absolute right-2 bottom-[84px] sm:right-4 sm:bottom-4">
        <BottomControls />
      </div>
      <div className="absolute right-2 bottom-2 left-2 flex flex-col items-center gap-3 sm:right-[76px] sm:bottom-4 sm:left-[372px]">
        <div className="sm:hidden">
          <ViewSwitcher />
        </div>
        <AvisoAPie />
        <div className="pointer-events-none w-full">
          <Player />
        </div>
      </div>
    </div>
  )
}

/** En el visor la barra lateral no se ve: la ficha del pallet se arma fuera de pantalla y el visor la lee. */
function FichaParaVisor() {
  const enXR = useEnXR()
  const selection = useStore((s) => s.selection)
  if (!enXR || selection?.kind !== 'product') return null
  return (
    <div data-vr-ficha aria-hidden style={{ position: 'fixed', left: -10000, top: 0, width: 360 }}>
      <ProductCard id={selection.id} />
    </div>
  )
}
