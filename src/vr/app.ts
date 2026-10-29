// Recorrido en VR del Centro Logístico: tutorial, punto de partida y zona caminable.
import * as THREE from 'three'
import type { ConfigRecorrido } from './recorrido'
import { tarjetaResumen, tarjetasControles, type Tarjeta } from './tarjetas'

export const TITULO = 'Centro Logístico 3D'

const portada: Tarjeta = {
  portada: true,
  etiqueta: 'Centro Logístico 3D · Recorrido en VR',
  titulo: 'Bienvenido a la nave',
  texto: 'Vas a recorrer a pie un centro de distribución sobre la Ruta 5, con el stock simulado del día.',
  items: [
    'Caminá entre las estanterías, la playa de andenes y el patio de camiones',
    'Apuntá a un pallet y apretá el gatillo para ver su producto y su política de inventario',
    'Mirá trabajar a los autoelevadores y la llegada de los camiones',
  ],
}

const pantalla: Tarjeta = {
  etiqueta: 'Sin visor',
  titulo: 'En la computadora',
  texto:
    'Botón con el muñeco (arriba a la derecha): recorrer a pie con las mismas paredes y estanterías.\n\nW A S D o flechas para caminar, Shift para correr y arrastrar para mirar. Esc para volver a la vista de siempre.',
}

const controles = tarjetasControles(
  'Apuntá con el control derecho a un pallet de las estanterías y apretá el gatillo: aparece su ficha con el producto, el stock y la política (ROP, Q, stock de seguridad).\n\nApretá el gatillo en otro lugar para cerrarla.',
)
const resumen = tarjetaResumen('ver la ficha del pallet')

/** Tutorial dentro del visor. */
export const TARJETAS: Tarjeta[] = [portada, ...controles, resumen]
/** Portada en la pantalla: suma cómo recorrer sin visor. */
export const TARJETAS_PANTALLA: Tarjeta[] = [portada, pantalla, ...controles, resumen]

/** Predio completo (cerco incluido) con margen. */
const LIMITES = new THREE.Box3(new THREE.Vector3(-115, -6, -75), new THREE.Vector3(117, 30, 137))

export function configRecorrido(escenario: React.RefObject<THREE.Object3D | null>): ConfigRecorrido {
  return {
    tarjetas: TARJETAS,
    // Sobre el pasillo peatonal verde, entre las estanterías y la playa de andenes, mirando hacia el este.
    inicio: { pos: new THREE.Vector3(-34, 0, 24), yaw: -Math.PI / 2 },
    limites: LIMITES,
    colisionables: () => (escenario.current ? [escenario.current] : []),
    excluir: (o) => 'isSky' in o || (o as THREE.Points).isPoints === true || (o as THREE.Line).isLine === true,
    velocidad: 2.2,
  }
}
