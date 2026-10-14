import { useEffect, useMemo, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { LineMaterial } from 'three/examples/jsm/lines/LineMaterial.js'
import { LineSegments2 } from 'three/examples/jsm/lines/LineSegments2.js'
import { LineSegmentsGeometry } from 'three/examples/jsm/lines/LineSegmentsGeometry.js'
import { CLIENTS } from '../sim/clients'
import { dayOf, useStore } from '../store'
import { dockSchedule } from './Docks'
import Tag from './Tag'

type Pt = [number, number]

export interface Geo {
  source: string
  depot: Pt
  cities: { key: string; name: string; at: Pt }[]
  country: Pt[][]
  neighbors?: Pt[][]
  departments: { name: string | null; ring: Pt[] }[]
  roads: { class: string; ref: string | null; pts: Pt[] }[]
  routes: { key: string; km: number; path: Pt[] }[]
}

let geoPromise: Promise<Geo> | null = null

/** Mapa de Uruguay (tools/geo/build-uruguay.ts), en km desde el centro; se baja la primera vez que se abre. */
export function useGeo(): Geo | null {
  const [geo, setGeo] = useState<Geo | null>(null)
  useEffect(() => {
    geoPromise ??= fetch(`${import.meta.env.BASE_URL}geo/uruguay.json`).then((r) => r.json())
    let alive = true
    geoPromise.then((g) => alive && setGeo(g))
    return () => {
      alive = false
    }
  }, [])
  return geo
}

/** Velocidad media en ruta, con descansos del chofer (km/h), y horas de descarga en el cliente. */
const TRIP_KMH = 58
const UNLOAD_H = 1.5

/** Un camión en viaje: hacia dónde va, si es propio y en qué punto del recorrido está. */
export interface Trip {
  client: number
  own: boolean
  pallets: number
  /** 0 a 1 de ida, 1 en el cliente, 1 a 2 de vuelta. */
  phase: number
}

/** Camiones en ruta en un instante: los despachos de los últimos días que todavía no volvieron. */
export function tripsAt(t: number, routesKm: number[], schedule: (day: number) => ReturnType<typeof dockSchedule>): Trip[] {
  const day = dayOf(t)
  const trips: Trip[] = []
  for (let d = Math.max(0, day - 3); d <= day; d++)
    for (const v of schedule(d)) {
      if (v.inbound) continue
      const go = routesKm[v.client] / TRIP_KMH
      const elapsed = t - (d * 24 + v.end)
      if (elapsed < 0 || elapsed > 2 * go + UNLOAD_H) continue
      const phase = elapsed < go ? elapsed / go : elapsed < go + UNLOAD_H ? 1 : 1 + (elapsed - go - UNLOAD_H) / go
      trips.push({ client: v.client, own: v.own, pallets: v.pallets, phase })
    }
  return trips
}

/** Polígono plano en el piso (x, z en km). */
function landGeometry(rings: Pt[][]) {
  const shapes = rings.map((r) => new THREE.Shape(r.map(([x, z]) => new THREE.Vector2(x, -z))))
  const g = new THREE.ShapeGeometry(shapes)
  g.rotateX(-Math.PI / 2)
  return g
}

/** Líneas gruesas (en píxeles) a partir de polilíneas. */
function useLines(lines: Pt[][], y: number, color: string, width: number, dashed = false) {
  const size = useThree((s) => s.size)
  const obj = useMemo(() => {
    const pos: number[] = []
    for (const l of lines) for (let i = 1; i < l.length; i++) pos.push(l[i - 1][0], y, l[i - 1][1], l[i][0], y, l[i][1])
    const geo = new LineSegmentsGeometry().setPositions(pos)
    const mat = new LineMaterial({ color, linewidth: width, dashed, dashSize: 3, gapSize: 2, worldUnits: false, toneMapped: false })
    const seg = new LineSegments2(geo, mat)
    if (dashed) seg.computeLineDistances()
    return seg
  }, [lines, y, color, width, dashed])
  useEffect(() => void obj.material.resolution.set(size.width, size.height), [obj, size])
  return obj
}

/** Recorrido de cada cliente con sus distancias acumuladas, para ubicar un camión a cierta fracción del camino. */
function routeSampler(path: Pt[]) {
  const acc = [0]
  for (let i = 1; i < path.length; i++) acc.push(acc[i - 1] + Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]))
  const total = acc[acc.length - 1]
  return (f: number): { x: number; z: number; yaw: number } => {
    const target = Math.min(1, Math.max(0, f)) * total
    let i = 1
    while (i < acc.length - 1 && acc[i] < target) i++
    const k = (target - acc[i - 1]) / Math.max(1e-9, acc[i] - acc[i - 1])
    const [a, b] = [path[i - 1], path[i]]
    return { x: a[0] + (b[0] - a[0]) * k, z: a[1] + (b[1] - a[1]) * k, yaw: Math.atan2(b[0] - a[0], b[1] - a[1]) }
  }
}

const MAX_TRUCKS = 120

/** Camiones en viaje: azul marino los propios, naranja los fletes; se mueven con el reloj simulado. */
function Trucks({ geo }: { geo: Geo }) {
  const run = useStore((s) => s.run)
  const decisions = useStore((s) => s.decisions)
  const mesh = useRef<THREE.InstancedMesh>(null)
  const samplers = useMemo(() => CLIENTS.map((c) => routeSampler(geo.routes.find((r) => r.key === c.key)!.path)), [geo])
  const kms = useMemo(() => CLIENTS.map((c) => geo.routes.find((r) => r.key === c.key)!.km), [geo])
  const cache = useRef(new Map<number, ReturnType<typeof dockSchedule>>())
  useEffect(() => cache.current.clear(), [run, decisions])
  // Marcador redondo con borde blanco, como un vehículo en un mapa.
  const ring = useRef<THREE.InstancedMesh>(null)
  const unit = useMemo(() => new THREE.CylinderGeometry(1, 1, 1, 24), [])
  const material = useMemo(() => new THREE.MeshBasicMaterial({ toneMapped: false }), [])
  const white = useMemo(() => new THREE.MeshBasicMaterial({ color: '#ffffff', toneMapped: false }), [])
  useFrame(() => {
    const m = mesh.current
    const w = ring.current
    if (!m || !w) return
    const schedule = (d: number) => {
      let s = cache.current.get(d)
      if (!s) cache.current.set(d, (s = dockSchedule(run.days[d], decisions)))
      return s
    }
    const trips = tripsAt(useStore.getState().t, kms, schedule)
    const mat = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    const up = new THREE.Vector3(0, 1, 0)
    const n = Math.min(MAX_TRUCKS, trips.length)
    for (let i = 0; i < n; i++) {
      const tr = trips[i]
      const p = samplers[tr.client](tr.phase <= 1 ? tr.phase : 2 - tr.phase)
      // Los que van y vienen por la misma ruta se separan un poco a cada lado.
      const side = tr.phase <= 1 ? 1 : -1
      q.setFromAxisAngle(up, p.yaw + (tr.phase > 1 ? Math.PI : 0))
      const off = new THREE.Vector3(side * 3, 0, 0).applyQuaternion(q)
      mat.compose(new THREE.Vector3(p.x + off.x, 1.6, p.z + off.z), q, new THREE.Vector3(4.2, 1.2, 4.2))
      m.setMatrixAt(i, mat)
      mat.compose(new THREE.Vector3(p.x + off.x, 1.2, p.z + off.z), q, new THREE.Vector3(5.8, 1.2, 5.8))
      w.setMatrixAt(i, mat)
      m.setColorAt(i, c.set(tr.own ? '#1f3557' : '#e8702a'))
    }
    m.count = n
    w.count = n
    w.instanceMatrix.needsUpdate = true
    m.instanceMatrix.needsUpdate = true
    if (m.instanceColor) m.instanceColor.needsUpdate = true
  })
  return (
    <group>
      <instancedMesh ref={ring} args={[unit, white, MAX_TRUCKS]} frustumCulled={false} />
      <instancedMesh ref={mesh} args={[unit, material, MAX_TRUCKS]} frustumCulled={false} />
    </group>
  )
}

function MapContent({ geo }: { geo: Geo }) {
  const land = useMemo(() => landGeometry(geo.country), [geo])
  const neighbors = useMemo(() => landGeometry(geo.neighbors ?? []), [geo])
  const borders = useLines(
    useMemo(() => geo.departments.map((d) => d.ring.concat([d.ring[0]])), [geo]),
    0.25,
    '#c8bfae',
    1,
    true,
  )
  const coast = useLines(useMemo(() => geo.country.map((r) => r.concat([r[0]])), [geo]), 0.3, '#9db6c9', 1.5)
  const primary = useLines(useMemo(() => geo.roads.filter((r) => r.class === 'primary').map((r) => r.pts), [geo]), 0.4, '#ffffff', 1.4)
  const trunk = useLines(useMemo(() => geo.roads.filter((r) => r.class !== 'primary').map((r) => r.pts), [geo]), 0.5, '#f3c164', 2.4)
  const routes = useLines(useMemo(() => geo.routes.map((r) => r.path), [geo]), 0.6, '#007aff', 2.2)
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.5, 0]}>
        <planeGeometry args={[4000, 4000]} />
        <meshBasicMaterial color="#a9cbe3" toneMapped={false} />
      </mesh>
      <mesh geometry={neighbors} position-y={0}>
        <meshBasicMaterial color="#e6e3db" toneMapped={false} />
      </mesh>
      <mesh geometry={land} position-y={0.1}>
        <meshBasicMaterial color="#f5f2ea" toneMapped={false} />
      </mesh>
      <primitive object={borders} />
      <primitive object={coast} />
      <primitive object={primary} />
      <primitive object={trunk} />
      <primitive object={routes} />
      {geo.cities.map((c) => (
        <group key={c.key} position={[c.at[0], 0.8, c.at[1]]}>
          <mesh>
            <cylinderGeometry args={[2.2, 2.2, 1.2, 20]} />
            <meshBasicMaterial color="#ffffff" toneMapped={false} />
          </mesh>
          <mesh position-y={0.1}>
            <cylinderGeometry args={[1.4, 1.4, 1.3, 20]} />
            <meshBasicMaterial color="#007aff" toneMapped={false} />
          </mesh>
          <Html position={[0, 4, 0]} center zIndexRange={[10, 0]}>
            <Tag tone="muted">{c.name}</Tag>
          </Html>
        </group>
      ))}
      <group position={[geo.depot[0], 1, geo.depot[1]]}>
        <mesh>
          <boxGeometry args={[5, 2.5, 5]} />
          <meshBasicMaterial color="#1f3557" toneMapped={false} />
        </mesh>
        <Html position={[0, 6, 0]} center zIndexRange={[11, 0]}>
          <Tag tone="accent">Centro logístico</Tag>
        </Html>
      </group>
      <Trucks geo={geo} />
    </group>
  )
}

/** Uruguay con las rutas nacionales, las ciudades cliente y los camiones en viaje (1 unidad = 1 km). */
export default function MapScene() {
  const geo = useGeo()
  if (!geo) return null
  return <MapContent geo={geo} />
}
