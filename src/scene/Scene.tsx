import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { CameraControls } from '@react-three/drei'
import * as THREE from 'three'
import { useStore, type View } from '../store'
import Building from './Building'
import Docks from './Docks'
import Effects from './Effects'
import Forklifts from './Forklifts'
import Lighting from './Lighting'
import MapScene from './MapScene'
import Racks from './Racks'
import Site from './Site'
import { listenKeyboard, nav } from './navInput'
import { configRecorrido } from '../vr/app'
import { Recorrido, modoVR, useEnXR, xrStore } from '../vr/r3f'

/** Cámara de cada vista: posición y punto mirado. */
export const VIEWS: Record<View, [number, number, number, number, number, number]> = {
  nave: [62, 58, 92, -4, 0, -2],
  andenes: [18, 13, 92, -6, 2, 30],
  planta: [0, 175, 0.1, 0, 0, 0],
  exterior: [-170, 70, 190, -10, 0, 10],
  // En el mapa, 1 unidad = 1 km.
  mapa: [20, 820, 520, 10, 0, 40],
}

function Clock() {
  const advance = useStore((s) => s.advance)
  useFrame((_, delta) => advance(Math.min(delta, 0.1)))
  return null
}

/** Movimiento libre con teclado y botones, plano cercano según la distancia y doble clic para ir a un punto. */
function FreeNav({ controls }: { controls: React.RefObject<CameraControls | null> }) {
  const { gl, camera, scene } = useThree()
  useEffect(() => listenKeyboard(() => true), [])

  useEffect(() => {
    const ray = new THREE.Raycaster()
    const ndc = new THREE.Vector2()
    const onDouble = (e: MouseEvent) => {
      const c = controls.current
      if (!c) return
      const r = gl.domElement.getBoundingClientRect()
      ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1)
      ray.setFromCamera(ndc, camera)
      const hit = ray.intersectObjects(scene.children, true).find((h) => (h.object as THREE.Mesh).isMesh && !('isSky' in h.object) && h.distance < 3000)
      if (!hit) return
      c.moveTo(hit.point.x, Math.max(0, hit.point.y), hit.point.z, true)
      if (c.distance > 60) c.dollyTo(60, true)
    }
    gl.domElement.addEventListener('dblclick', onDouble)
    return () => gl.domElement.removeEventListener('dblclick', onDouble)
  }, [gl, camera, scene, controls])

  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return
    const dt = Math.min(delta, 0.1)
    if (nav.forward || nav.right || nav.up || nav.turn || nav.tilt || nav.zoom) {
      const speed = Math.max(4, c.distance * 0.8) * (nav.fast ? 3 : 1) * dt
      if (nav.forward) c.forward(nav.forward * speed, false)
      if (nav.right) c.truck(nav.right * speed, 0, false)
      if (nav.up) c.elevate(nav.up * speed * 0.6, false)
      if (nav.turn) c.rotate(nav.turn * 1.2 * dt, 0, false)
      if (nav.tilt) c.rotate(0, nav.tilt * 0.8 * dt, false)
      if (nav.zoom) c.dolly(nav.zoom * speed, false)
    }
    const near = THREE.MathUtils.clamp(c.distance * 0.02, 0.1, 2)
    const cam = camera as THREE.PerspectiveCamera
    if (Math.abs(cam.near - near) / near > 0.05) {
      cam.near = near
      cam.updateProjectionMatrix()
    }
  })
  return null
}

/** Lo que había antes de entrar al recorrido (vista y calidad), para dejarlo igual al salir. */
let antesDelRecorrido: { view: View; quality: ReturnType<typeof useStore.getState>['quality']; locked: boolean } | null = null

function alEntrarRecorrido() {
  const s = useStore.getState()
  antesDelRecorrido = { view: s.view, quality: s.quality, locked: s.qualityLocked }
  // Vista exterior: las paredes se dibujan de los dos lados, así se ven al caminar por dentro y por fuera.
  if (s.view !== 'exterior') s.setView('exterior')
  // En el visor: sin posprocesado ni sombras (el Quest 2 necesita 72 cuadros por segundo estables).
  if (xrStore.getState().session) s.setQuality('baja', true)
}

function alSalirRecorrido() {
  const a = antesDelRecorrido
  antesDelRecorrido = null
  if (!a) return
  const s = useStore.getState()
  s.setView(a.view)
  if (s.quality !== a.quality) useStore.setState({ quality: a.quality, qualityLocked: a.locked })
}

export default function Scene() {
  const controls = useRef<CameraControls>(null)
  const escenario = useRef<THREE.Group>(null)
  const view = useStore((s) => s.view)
  const enXR = useEnXR()
  const aPie = modoVR((s) => s.aPie)
  // La cámara libre (órbita, teclado, doble clic) se apaga mientras se camina, en el visor o en la pantalla.
  const libre = !enXR && !aPie

  useEffect(() => {
    const c = controls.current
    if (!c) return
    c.setLookAt(...VIEWS[view], !libre ? false : true)
  }, [view, libre])

  return (
    <>
      <Lighting far={view === 'mapa'} />
      {libre && <CameraControls ref={controls} minDistance={3} maxDistance={view === 'mapa' ? 2500 : 900} maxPolarAngle={view === 'mapa' ? 1.2 : 1.52} dollyToCursor infinityDolly />}
      <Clock />
      {libre && <FreeNav controls={controls} />}
      {view === 'mapa' ? (
        <MapScene />
      ) : (
        <>
          {/* Todo lo que está quieto y se puede chocar caminando. Los autoelevadores se mueven: quedan afuera. */}
          <group ref={escenario}>
            <Site />
            <Building />
            <Racks />
            <Docks />
          </group>
          <Forklifts />
        </>
      )}
      <Recorrido config={() => configRecorrido(escenario)} cerca={0.08} lejos={9000} alEntrar={alEntrarRecorrido} alSalir={alSalirRecorrido} />
      {!enXR && <Effects />}
    </>
  )
}
