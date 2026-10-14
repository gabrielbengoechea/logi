import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { CLIENTS } from '../sim/clients'
import type { DayStats, Decisions } from '../sim/engine'
import { FAMILIES } from '../sim/catalog'
import { DOCKS, HALL, PALLET, STAGING } from '../sim/warehouse'
import { dayOf, useStore } from '../store'

/** Un camión en un andén: cuándo llega, cuándo se va y qué lleva. */
export interface Visit {
  dock: number
  /** Llegada al predio; si la puerta está ocupada, espera en el patio hasta `start`. */
  arrive: number
  start: number
  end: number
  inbound: boolean
  /** Cliente de destino (despacho) o −1 (recepción). */
  client: number
  own: boolean
  pallets: number
}

/** Horario de trabajo según los turnos: 1 turno de 6 a 14, 2 de 6 a 22, 3 todo el día. */
export function openHours(shifts: number): [number, number] {
  return shifts >= 3 ? [0, 24] : shifts === 2 ? [6, 22] : [6, 14]
}

/**
 * Horario de andenes de un día (ilustrativo): los camiones del día se reparten en el horario de trabajo y cada uno
 * ocupa la primera puerta libre de su lado. Si no hay puerta, espera en el patio.
 */
export function dockSchedule(day: DayStats, decisions: Decisions): Visit[] {
  const [open, close] = openHours(decisions.shifts)
  const visits: Visit[] = []
  const trucks: Omit<Visit, 'dock' | 'arrive' | 'start' | 'end'>[] = []
  const inTrucks = Math.ceil(day.palletsIn / 22)
  for (let i = 0; i < inTrucks; i++) trucks.push({ inbound: true, client: -1, own: false, pallets: Math.min(22, day.palletsIn - i * 22) })
  for (const s of day.shipments)
    for (let i = 0; i < s.trucks; i++) trucks.push({ inbound: false, client: s.client, own: i < s.own, pallets: Math.min(26, s.pallets - i * 26) })
  const free = DOCKS.map(() => open)
  const inbound = trucks.filter((t) => t.inbound)
  const outbound = trucks.filter((t) => !t.inbound)
  for (const [list, docks, stay] of [
    [inbound, DOCKS.map((d, i) => (d.inbound ? i : -1)).filter((i) => i >= 0), 2.5],
    [outbound, DOCKS.map((d, i) => (d.inbound ? -1 : i)).filter((i) => i >= 0), 3],
  ] as const) {
    const gap = list.length ? (close - open - stay) / list.length : 0
    list.forEach((t, i) => {
      const want = open + i * gap
      const dock = docks.reduce((best, d) => (free[d] < free[best] ? d : best), docks[0])
      const start = Math.max(want, free[dock])
      free[dock] = start + stay
      visits.push({ ...t, dock, arrive: want, start, end: start + stay })
    })
  }
  return visits
}

const POOL = 16
const STAGE_MAX = 260
const HW = HALL.width / 2
const GROUND = -HALL.dockHeight
const TRAILER = 13.6
const HIRED = ['#c0392b', '#2d6a4f', '#6b4f9e', '#d4a017', '#34495e', '#8e5a2b']

/** Semirremolque con tractor. La cola mira a la puerta; z crece hacia el patio. */
function Truck({ index }: { index: number }) {
  return (
    <group name={`truck-${index}`} visible={false}>
      {/* Caja del semirremolque (la pinta useFrame), con la cola en z = 0. */}
      <mesh name="box" position={[0, 1.45, TRAILER / 2]} castShadow receiveShadow>
        <boxGeometry args={[2.55, 2.8, TRAILER]} />
        <meshStandardMaterial color="#f4f5f6" roughness={0.6} />
      </mesh>
      <mesh name="stripe" position={[0, 0.55, TRAILER / 2]}>
        <boxGeometry args={[2.57, 0.3, TRAILER - 0.4]} />
        <meshStandardMaterial color="#1f3557" roughness={0.5} />
      </mesh>
      {/* Chasis y ruedas. */}
      <mesh position={[0, -0.25, TRAILER / 2]}>
        <boxGeometry args={[1.2, 0.3, TRAILER - 1]} />
        <meshStandardMaterial color="#2a2d31" />
      </mesh>
      {[1.6, 2.9, 4.2, TRAILER + 2.4, TRAILER + 5.2].map((z) => (
        <mesh key={z} position={[0, GROUND + 0.5, z]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.5, 0.5, 2.45, 16]} />
          <meshStandardMaterial color="#1b1c1e" roughness={0.9} />
        </mesh>
      ))}
      {/* Tractor. */}
      <mesh name="cab" position={[0, GROUND + 2.1, TRAILER + 4.6]} castShadow>
        <boxGeometry args={[2.5, 2.8, 2.3]} />
        <meshStandardMaterial color="#ffffff" roughness={0.4} metalness={0.2} />
      </mesh>
      <mesh position={[0, GROUND + 2.6, TRAILER + 5.78]}>
        <boxGeometry args={[2.2, 1.0, 0.05]} />
        <meshStandardMaterial color="#26323f" roughness={0.1} metalness={0.6} />
      </mesh>
      <mesh position={[0, GROUND + 1.0, TRAILER + 3.4]}>
        <boxGeometry args={[2.4, 0.6, 4.6]} />
        <meshStandardMaterial color="#2a2d31" />
      </mesh>
    </group>
  )
}

/** Camiones que llegan, se acoplan a su puerta, esperan la carga y se van. Semáforos de cada andén. */
export default function Docks() {
  const run = useStore((s) => s.run)
  const decisions = useStore((s) => s.decisions)
  const group = useRef<THREE.Group>(null)
  const lights = useRef<THREE.Group>(null)
  const cache = useRef<{ day: number; visits: Visit[] }>({ day: -1, visits: [] })
  const lightMats = useMemo(() => DOCKS.map(() => new THREE.MeshStandardMaterial({ color: '#34c759', emissive: '#34c759', emissiveIntensity: 1.6 })), [])
  const staged = useRef<THREE.InstancedMesh>(null)
  const stagedGeo = useMemo(() => new THREE.BoxGeometry(PALLET.w - 0.05, 1.35, PALLET.d - 0.05).translate(0, 0.675 + PALLET.base, 0), [])
  const stagedMat = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.45 }), [])

  useFrame(() => {
    const g = group.current
    if (!g) return
    const t = useStore.getState().t
    const day = dayOf(t)
    if (cache.current.day !== day) cache.current = { day, visits: dockSchedule(run.days[day], decisions) }
    const h = t - day * 24
    const busy = DOCKS.map(() => false)
    let used = 0
    let waiting = 0
    for (const v of cache.current.visits) {
      // Maniobra de 15 minutos antes y después: entra marcha atrás desde el patio y sale hacia adelante.
      const waits = h >= v.arrive && h < v.start - 0.25
      if ((!waits && (h < v.start - 0.25 || h > v.end + 0.25)) || used >= POOL) continue
      const truck = g.children[used++] as THREE.Group
      truck.visible = true
      if (waits) {
        // Fila de espera en el estacionamiento del patio, a la derecha.
        truck.position.set(70 + (waiting % 4) * 5, 0, HW + 26 + Math.floor(waiting / 4) * 22)
        waiting++
      } else {
        const approach = h < v.start ? (v.start - h) / 0.25 : h > v.end ? (h - v.end) / 0.25 : 0
        truck.position.set(DOCKS[v.dock].x, 0, HW + 0.4 + approach * approach * 22)
      }
      if (h >= v.start && h <= v.end) busy[v.dock] = true
      const box = truck.getObjectByName('box') as THREE.Mesh
      const cab = truck.getObjectByName('cab') as THREE.Mesh
      const stripe = truck.getObjectByName('stripe') as THREE.Mesh
      const k = v.inbound ? v.dock + Math.round(v.start * 7) : v.client
      ;(box.material as THREE.MeshStandardMaterial).color.set(v.inbound ? ['#b5523b', '#3f6fa8', '#5b8c5a', '#c98a2b'][k % 4] : '#f4f5f6')
      ;(cab.material as THREE.MeshStandardMaterial).color.set(v.own ? '#1f3557' : HIRED[k % HIRED.length])
      stripe.visible = !v.inbound && v.own
      truck.userData.visit = v
    }
    for (let i = used; i < POOL; i++) g.children[i].visible = false
    // Pallets en la playa de cada andén: los de despacho esperan armados y se van cargando; los de recepción se
    // descargan y después los autoelevadores los llevan a las estanterías.
    const sm = staged.current
    if (sm) {
      const m = new THREE.Matrix4()
      const c = new THREE.Color()
      let n = 0
      for (const v of cache.current.visits) {
        if (h < v.start || h > v.end) continue
        const k = (h - v.start) / (v.end - v.start)
        const count = Math.round(v.inbound ? v.pallets * Math.min(1, 2 * k) * Math.min(1, 2 - 2 * k + 0.2) : v.pallets * (1 - k))
        for (let i = 0; i < Math.min(count, 26) && n < STAGE_MAX; i++, n++) {
          const col = i % 2
          const row = Math.floor(i / 2)
          m.makeTranslation(DOCKS[v.dock].x + (col ? 1.05 : -1.05), 0, STAGING.z1 - 3.2 - row * 1.3)
          sm.setMatrixAt(n, m)
          sm.setColorAt(n, c.set(FAMILIES[(v.dock * 7 + i * 3 + v.client) % FAMILIES.length].color))
        }
      }
      sm.count = n
      sm.instanceMatrix.needsUpdate = true
      if (sm.instanceColor) sm.instanceColor.needsUpdate = true
    }
    busy.forEach((b, i) => {
      const m = lightMats[i]
      const c = b ? '#ff3b30' : '#34c759'
      m.color.set(c)
      m.emissive.set(c)
    })
  })

  return (
    <group>
      <group ref={group}>
        {Array.from({ length: POOL }, (_, i) => (
          <Truck key={i} index={i} />
        ))}
      </group>
      <instancedMesh ref={staged} args={[stagedGeo, stagedMat, STAGE_MAX]} castShadow receiveShadow frustumCulled={false} />
      <group ref={lights}>
        {DOCKS.map((d, i) => (
          <mesh key={i} position={[d.x + 2.3, 2.4, HW + 0.12]} material={lightMats[i]}>
            <boxGeometry args={[0.28, 0.28, 0.12]} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

/** Nombre del destino de una visita, para mostrarlo en la interfaz. */
export const visitLabel = (v: Visit) => (v.inbound ? 'Recepción de un proveedor' : `Despacho a ${CLIENTS[v.client].name}`)
