import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { hashUniform } from '../sim/rng'
import { DOCKS, RACK, STAGING, aisleX, faceX } from '../sim/warehouse'
import { dayOf, useStore } from '../store'
import { openHours } from './Docks'

const SPEED = 2.6 // m/s
const LIFT = 0.45 // m/s
/** Los autoelevadores se mueven en tiempo real (acelerado), no al ritmo del reloj simulado, para que se vean. */
const REAL_SPEED = 3

interface Leg {
  /** Destino del tramo: x, z, rumbo (rad) y altura de las horquillas. */
  x: number
  z: number
  yaw: number
  fork: number
  /** Duración en segundos. */
  dt: number
}

/** Un ciclo: de un andén a una posición de la estantería y vuelta. Sorteado con semilla, por autoelevador y ciclo. */
function cycle(unit: number, n: number, use: number): { legs: Leg[]; start: [number, number, number] } {
  const u = (k: number) => hashUniform(unit + 1, n, k)
  const dock = DOCKS[Math.floor(u(1) * DOCKS.length)]
  const face = Math.floor(u(2) * RACK.doubles * 2)
  const double = Math.floor(face / 2)
  // Pasillo del lado de la cara: las caras pares dan al pasillo de la izquierda.
  const ax = face % 2 === 0 ? aisleX(double - 1) : aisleX(double)
  const toRack = Math.sign(faceX(face) - ax)
  const bayZ = RACK.front - (Math.floor(u(3) * RACK.bays) + 0.5) * RACK.bayLength
  const level = Math.floor(u(4) * RACK.levels)
  const forkTop = level === 0 ? 0.15 : RACK.firstBeam + (level - 1) * RACK.levelPitch + 0.1
  const stage: [number, number] = [dock.x + (u(5) - 0.5) * 3, STAGING.z0 + 3 + u(6) * 8]
  const cross = STAGING.z0 - 2.5
  const pts: [number, number, number, number][] = [
    [stage[0], cross, 0, 0],
    [ax, cross, 0, 0],
    [ax, bayZ, 0, 0],
    [ax, bayZ, toRack > 0 ? Math.PI / 2 : -Math.PI / 2, 0],
    [ax, bayZ, toRack > 0 ? Math.PI / 2 : -Math.PI / 2, forkTop],
    [ax, bayZ, toRack > 0 ? Math.PI / 2 : -Math.PI / 2, 0.15],
    [ax, bayZ, Math.PI, 0.15],
    [ax, cross, Math.PI, 0.15],
    [stage[0], cross, Math.PI, 0.15],
    [stage[0], stage[1], Math.PI, 0.15],
  ]
  const legs: Leg[] = []
  let [px, pz, pf] = [stage[0], stage[1], 0.15]
  for (const [x, z, yaw, fork] of pts) {
    const dist = Math.hypot(x - px, z - pz)
    const dt = Math.max(dist / SPEED, Math.abs(fork - pf) / LIFT, 1.2)
    legs.push({ x, z, yaw: x !== px || z !== pz ? Math.atan2(x - px, z - pz) : yaw, fork, dt })
    ;[px, pz, pf] = [x, z, fork]
  }
  // Tiempo parado según el uso del día: con poco trabajo, los autoelevadores esperan más en la playa.
  const busy = legs.reduce((s, l) => s + l.dt, 0)
  legs.push({ x: stage[0], z: stage[1], yaw: Math.PI, fork: 0.15, dt: Math.min(240, busy * (1 / Math.max(0.15, use) - 1)) })
  return { legs, start: [stage[0], stage[1], 0.15] }
}

function Unit({ index }: { index: number }) {
  return (
    <group name={`fork-${index}`}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[1.25, 0.9, 1.7]} />
        <meshStandardMaterial color="#f2a900" roughness={0.45} />
      </mesh>
      {/* Techo protector y columnas. */}
      <mesh position={[0, 2.25, -0.2]} castShadow>
        <boxGeometry args={[1.2, 0.08, 1.1]} />
        <meshStandardMaterial color="#26292d" />
      </mesh>
      {[-0.55, 0.55].map((x) => (
        <mesh key={x} position={[x, 1.6, -0.6]}>
          <boxGeometry args={[0.07, 1.3, 0.07]} />
          <meshStandardMaterial color="#26292d" />
        </mesh>
      ))}
      {/* Operario. */}
      <mesh position={[0, 1.45, -0.25]}>
        <capsuleGeometry args={[0.22, 0.5, 4, 8]} />
        <meshStandardMaterial color="#2f7de1" />
      </mesh>
      {/* Mástil y horquillas (suben con la carga). */}
      <mesh position={[0, 1.9, 0.95]} castShadow>
        <boxGeometry args={[0.9, 3.6, 0.12]} />
        <meshStandardMaterial color="#3d4248" metalness={0.5} roughness={0.4} />
      </mesh>
      <group name="forks" position={[0, 0.15, 1.05]}>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 0, 0.55]}>
            <boxGeometry args={[0.12, 0.05, 1.1]} />
            <meshStandardMaterial color="#3d4248" metalness={0.5} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

const MAX = 16

/** Autoelevadores retráctiles: ciclos ilustrativos entre los andenes y las estanterías, según el uso del día. */
export default function Forklifts() {
  const group = useRef<THREE.Group>(null)
  // Estado de cada unidad: ciclo actual, segundos dentro del ciclo y el ciclo ya calculado.
  const state = useRef(Array.from({ length: MAX }, (_, i) => ({ n: i * 7919, time: i * 13, c: null as ReturnType<typeof cycle> | null, total: 0 })))
  useFrame((_, delta) => {
    const g = group.current
    if (!g) return
    const { t, playing, run, decisions } = useStore.getState()
    const step = playing ? Math.min(delta, 0.1) * REAL_SPEED : 0
    const day = dayOf(t)
    const stats = run.days[day]
    const [open, close] = openHours(decisions.shifts)
    const h = t - day * 24
    const working = stats.weekday < 5 && h >= open && h < close
    g.children.forEach((unit, i) => {
      unit.visible = i < decisions.forklifts
      if (!unit.visible) return
      const forks = unit.getObjectByName('forks')!
      if (!working) {
        // Cargando baterías junto a la pared oeste.
        unit.position.set(-59.8, 0, -13 + i * 1.5)
        unit.rotation.y = Math.PI / 2
        forks.position.y = 0.15
        return
      }
      // Cada autoelevador recorre ciclos uno detrás de otro; se busca el ciclo y el tramo del instante actual.
      const st = state.current[i]
      st.time += step
      if (!st.c) {
        st.c = cycle(i, st.n, stats.forkliftUse)
        st.total = st.c.legs.reduce((s, l) => s + l.dt, 0)
      }
      while (st.time > st.total) {
        st.time -= st.total
        st.c = cycle(i, ++st.n, stats.forkliftUse)
        st.total = st.c.legs.reduce((s, l) => s + l.dt, 0)
      }
      const c = st.c
      let time = st.time
      let [x, z, f] = c.start
      let yaw = Math.PI
      for (const leg of c.legs) {
        if (time <= leg.dt) {
          const k = time / leg.dt
          const e = k * k * (3 - 2 * k)
          x += (leg.x - x) * e
          z += (leg.z - z) * e
          f += (leg.fork - f) * e
          yaw = leg.yaw
          break
        }
        time -= leg.dt
        ;[x, z, f, yaw] = [leg.x, leg.z, leg.fork, leg.yaw]
      }
      unit.position.set(x, 0, z)
      unit.rotation.y = yaw
      forks.position.y = f
    })
  })
  return (
    <group ref={group}>
      {Array.from({ length: MAX }, (_, i) => (
        <Unit key={i} index={i} />
      ))}
    </group>
  )
}
