import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useEnXR } from '../vr/r3f'
import { DOCKS, HALL } from '../sim/warehouse'
import { registerGlow } from './environment'
import { Instances, type Box } from './Instances'
import Tag from './Tag'
import { asphaltColor, grassColor, ribColor, ribNormal } from './textures'

const Y = -HALL.dockHeight
const HL = HALL.length / 2
const HW = HALL.width / 2
const RUTA5_X = -235
/** Cerco del predio. */
const LOT = { x0: -110, x1: 112, z0: -70, z1: 132 }

interface Rect {
  x0: number
  x1: number
  z0: number
  z1: number
}

/** Superficies de asfalto: patio de camiones, calles internas, acceso y estacionamientos. */
const PAVED: Rect[] = [
  { x0: -HL - 4, x1: 98, z0: HW, z1: 104 }, // patio de maniobras
  { x0: -104, x1: 98, z0: 104, z1: 116 }, // calle de acceso
  { x0: -104, x1: -92, z0: -62, z1: 116 }, // calle oeste
  { x0: -92, x1: -78, z0: -62, z1: -6 }, // estacionamiento de autos
  { x0: 70, x1: 98, z0: -62, z1: HW }, // estacionamiento de semirremolques
  { x0: -HL - 4, x1: 98, z0: -62, z1: -HW - 0.2 }, // calle norte
  { x0: HL + 0.2, x1: 70, z0: -62, z1: HW }, // calle este
]

/** Plano horizontal con UV en metros (para texturas que repiten). */
function Ground({ r, y, material, scale }: { r: Rect; y: number; material: THREE.Material; scale: number }) {
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(r.x1 - r.x0, r.z1 - r.z0)
    g.rotateX(-Math.PI / 2)
    g.translate((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2)
    const pos = g.attributes.position as THREE.BufferAttribute
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / scale, -pos.getZ(i) / scale)
    return g
  }, [r, scale])
  return <mesh geometry={geo} material={material} position-y={y} receiveShadow />
}

/** Marcas pintadas del patio: guías de los andenes, cajones de estacionamiento y cebra. */
function marks(): Box[] {
  const b: Box[] = []
  const paint = (x: number, z: number, w: number, d: number, color = '#f4f4f0') => b.push({ p: [x, Y + 0.025, z], s: [w, 0.02, d], color })
  for (const d of DOCKS) for (const s of [-1, 1]) paint(d.x + s * 1.9, HW + 10, 0.15, 18, '#f2c12e')
  paint(0, HW + 20.5, HALL.length, 0.25)
  for (let x = -HL; x < 96; x += 6) paint(x, 110, 3, 0.18)
  for (let i = 0; i <= 20; i++) paint(-85, -60 + i * 2.6, 6, 0.12)
  for (let i = 0; i <= 5; i++) paint(70 + i * 4.6, -26, 0.15, 30)
  for (let i = 0; i < 6; i++) paint(-98, -30 + i * 1.1, 10, 0.5)
  return b
}

/** Árboles: copa redondeada de dos o tres esferas, en tonos de verde, con tronco. */
function Trees({ spots }: { spots: [number, number, number][] }) {
  const crowns = useRef<THREE.InstancedMesh>(null)
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crownGeo = useMemo(() => new THREE.IcosahedronGeometry(1, 2), [])
  const trunkGeo = useMemo(() => new THREE.CylinderGeometry(0.7, 1, 1, 6).translate(0, 0.5, 0), [])
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.95, flatShading: true }), [])
  const bark = useMemo(() => new THREE.MeshStandardMaterial({ color: '#5d4630', roughness: 1 }), [])
  const parts = useMemo(() => {
    const out: { p: THREE.Vector3; s: number; c: string }[] = []
    spots.forEach(([x, z, size], i) => {
      const r = (k: number) => Math.abs(Math.sin((i + 1) * 12.9898 + k * 78.233) * 43758.5453) % 1
      const n = 2 + Math.floor(r(1) * 2)
      for (let j = 0; j < n; j++) {
        const s = size * (0.55 + r(j + 2) * 0.35)
        out.push({
          p: new THREE.Vector3(x + (r(j + 5) - 0.5) * size * 0.8, Y + size * 0.9 + s * 0.6 + j * size * 0.25, z + (r(j + 9) - 0.5) * size * 0.8),
          s,
          c: ['#5f8f45', '#527f3d', '#6d9a4c', '#486f36'][Math.floor(r(j + 13) * 4)],
        })
      }
    })
    return out
  }, [spots])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    parts.forEach((p, i) => {
      m.makeScale(p.s, p.s * 0.9, p.s).setPosition(p.p)
      crowns.current!.setMatrixAt(i, m)
      crowns.current!.setColorAt(i, c.set(p.c))
    })
    spots.forEach(([x, z, size], i) => {
      m.makeScale(size * 0.09, size * 1.2, size * 0.09).setPosition(x, Y, z)
      trunks.current!.setMatrixAt(i, m)
    })
    for (const r of [crowns.current!, trunks.current!]) {
      r.instanceMatrix.needsUpdate = true
      r.computeBoundingSphere()
    }
    if (crowns.current!.instanceColor) crowns.current!.instanceColor.needsUpdate = true
  }, [parts, spots])
  return (
    <group>
      <instancedMesh ref={crowns} args={[crownGeo, leaf, parts.length]} castShadow receiveShadow />
      <instancedMesh ref={trunks} args={[trunkGeo, bark, spots.length]} castShadow />
    </group>
  )
}

/** Autos estacionados: carrocería y habitáculo. */
function Cars({ spots }: { spots: { x: number; z: number; yaw: number; color: string }[] }) {
  const body = useRef<THREE.InstancedMesh>(null)
  const cabin = useRef<THREE.InstancedMesh>(null)
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.3, metalness: 0.5 }), [])
  const glass = useMemo(() => new THREE.MeshStandardMaterial({ color: '#27313b', roughness: 0.1, metalness: 0.6 }), [])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    const up = new THREE.Vector3(0, 1, 0)
    spots.forEach((s, i) => {
      q.setFromAxisAngle(up, s.yaw)
      m.compose(new THREE.Vector3(s.x, Y + 0.55, s.z), q, new THREE.Vector3(1.8, 0.7, 4.3))
      body.current!.setMatrixAt(i, m)
      body.current!.setColorAt(i, c.set(s.color))
      m.compose(new THREE.Vector3(s.x, Y + 1.15, s.z), q, new THREE.Vector3(1.6, 0.55, 2.2))
      cabin.current!.setMatrixAt(i, m)
    })
    for (const r of [body.current!, cabin.current!]) {
      r.instanceMatrix.needsUpdate = true
      r.computeBoundingSphere()
    }
    if (body.current!.instanceColor) body.current!.instanceColor.needsUpdate = true
  }, [spots])
  return (
    <group>
      <instancedMesh ref={body} args={[unit, paint, spots.length]} castShadow />
      <instancedMesh ref={cabin} args={[unit, glass, spots.length]} castShadow />
    </group>
  )
}

/** Autos y camiones que pasan por la Ruta 5, en tiempo real. */
function Traffic() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const N = 36
  const cars = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        lane: i % 4,
        offset: (i * 397) % 3000,
        speed: 20 + ((i * 7) % 9),
        truck: i % 5 === 0,
        color: ['#e9eaec', '#2c3e50', '#a93226', '#7f8c8d', '#1f3557', '#d4ac0d'][i % 6],
      })),
    [],
  )
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.4 }), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    cars.forEach((car, i) => {
      const dir = car.lane < 2 ? 1 : -1
      const z = ((((car.offset + dir * car.speed * clock.elapsedTime) % 3000) + 3000) % 3000) - 1500
      const x = RUTA5_X + (car.lane - 1.5) * 3.5 + (car.lane < 2 ? -1.2 : 1.2)
      const [len, hgt] = car.truck ? [16, 3.8] : [4.4, 1.45]
      m.makeScale(2.1, hgt, len).setPosition(x, Y + hgt / 2 + 0.35, z)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, c.set(car.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[unit, material, N]} castShadow frustumCulled={false} />
}

/** Columnas de iluminación del patio, con luminaria que se enciende de noche. */
function LightPoles({ at }: { at: [number, number][] }) {
  const poles = useMemo(() => at.map(([x, z]) => ({ p: [x, Y + 6, z] as [number, number, number], s: [0.22, 12, 0.22] as [number, number, number] })), [at])
  const heads = useMemo(() => at.map(([x, z]) => ({ p: [x, Y + 12, z] as [number, number, number], s: [0.9, 0.25, 1.6] as [number, number, number] })), [at])
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8f979e', roughness: 0.5, metalness: 0.6 }), [])
  const lamp = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f7f7f2', emissive: '#ffe7b8', emissiveIntensity: 0 }), [])
  useEffect(() => registerGlow(lamp, 0, 4), [lamp])
  return (
    <group>
      <Instances boxes={poles} material={steel} castShadow />
      <Instances boxes={heads} material={lamp} />
    </group>
  )
}

/** Otra nave del parque logístico, con la misma chapa nervada. */
function Neighbor({ x, z, w, d, h }: { x: number; z: number; w: number; d: number; h: number }) {
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: ribColor('#d9dee2'), normalMap: ribNormal(), roughness: 0.6, metalness: 0.2 }), [])
  const geo = useMemo(() => {
    const g = new THREE.BoxGeometry(w, h, d)
    const pos = g.attributes.position as THREE.BufferAttribute
    const nor = g.attributes.normal as THREE.BufferAttribute
    const uv = g.attributes.uv as THREE.BufferAttribute
    for (let i = 0; i < pos.count; i++) uv.setXY(i, Math.abs(nor.getX(i)) > 0.5 ? pos.getZ(i) : pos.getX(i), pos.getY(i))
    return g
  }, [w, d, h])
  return (
    <group position={[x, Y, z]}>
      <mesh geometry={geo} material={material} position-y={h / 2} castShadow receiveShadow />
      <mesh position={[0, h + 0.05, 0]} receiveShadow>
        <boxGeometry args={[w + 0.3, 0.1, d + 0.3]} />
        <meshStandardMaterial color="#cfd5da" roughness={0.6} metalness={0.3} />
      </mesh>
      <mesh position={[0, h - 0.8, d / 2 + 0.06]}>
        <boxGeometry args={[w, 1.4, 0.05]} />
        <meshStandardMaterial color="#6b7c8f" roughness={0.6} />
      </mesh>
    </group>
  )
}

export default function Site() {
  const enXR = useEnXR()
  const asphalt = useMemo(() => new THREE.MeshStandardMaterial({ map: asphaltColor(), roughness: 0.92 }), [])
  const grass = useMemo(() => new THREE.MeshStandardMaterial({ map: grassColor(), roughness: 1 }), [])
  const curb = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c3c6c8', roughness: 0.9 }), [])
  const concrete = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b2b5b7', roughness: 0.85 }), [])
  const markMaterial = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.7 }), [])
  const fenceMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#7d868e', roughness: 0.6, metalness: 0.5 }), [])
  const meshMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9aa1a8', transparent: true, opacity: 0.35, roughness: 0.6, depthWrite: false }), [])
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.6 }), [])

  const [trees, cars, poles, fencePosts, fenceMesh, trailers] = useMemo(() => {
    const trees: [number, number, number][] = []
    const r = (k: number) => Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1
    let k = 0
    // Cortina de árboles por dentro del cerco y algunos sueltos en los canteros.
    for (let x = LOT.x0 + 4; x < LOT.x1; x += 7 + r(k) * 3) trees.push([x, LOT.z0 + 4, 3 + r(k++) * 1.5])
    for (let z = LOT.z0 + 8; z < LOT.z1 - 4; z += 7 + r(k) * 3) trees.push([LOT.x1 - 4, z, 3 + r(k++) * 1.5])
    for (let z = LOT.z0 + 8; z < 100; z += 8 + r(k) * 3) trees.push([LOT.x0 + 3, z, 2.6 + r(k++) * 1.2])
    for (let x = -60; x < 90; x += 12) trees.push([x, LOT.z1 - 6, 2.4 + r(k++)])
    for (const [x, z] of [
      [-75, 0],
      [-72, 20],
      [-72, 45],
      [-80, 80],
      [104, 50],
      [104, 80],
    ])
      trees.push([x, z, 3.2 + r(k++)])
    // Más allá del cerco: árboles de campo, sueltos.
    for (let i = 0; i < 70; i++) {
      const a = r(k++) * Math.PI * 2
      const d = 190 + r(k++) * 300
      const x = Math.cos(a) * d
      const z = Math.sin(a) * d
      if (Math.abs(x - RUTA5_X) < 25 || (x > 200 && z > -100 && z < 20) || (z < -190 && x > -70 && x < 150)) continue
      trees.push([x, z, 3.5 + r(k++) * 2.5])
    }

    const colors = ['#e9eaec', '#2c3e50', '#a93226', '#7f8c8d', '#1f3557', '#c9ccd0', '#3b3f45']
    const cars: { x: number; z: number; yaw: number; color: string }[] = []
    for (let i = 0; i < 21; i++) if (r(i + 200) > 0.3) cars.push({ x: -85, z: -58.7 + i * 2.6, yaw: Math.PI / 2, color: colors[i % colors.length] })

    const poles: [number, number][] = []
    for (let x = -50; x <= 90; x += 28) poles.push([x, 102])
    for (let z = -50; z < 100; z += 30) poles.push([-91, z])
    poles.push([68, 0], [68, -40])

    const fencePosts: Box[] = []
    const fenceMesh: Box[] = []
    const run = (ax: number, az: number, bx: number, bz: number) => {
      const n = Math.floor(Math.hypot(bx - ax, bz - az) / 3)
      for (let i = 0; i <= n; i++) fencePosts.push({ p: [ax + ((bx - ax) * i) / n, Y + 1.1, az + ((bz - az) * i) / n], s: [0.08, 2.2, 0.08] })
      fenceMesh.push({ p: [(ax + bx) / 2, Y + 1.1, (az + bz) / 2], s: [Math.abs(bx - ax) || 0.03, 2.1, Math.abs(bz - az) || 0.03] })
    }
    run(LOT.x0, LOT.z0, LOT.x1, LOT.z0)
    run(LOT.x1, LOT.z0, LOT.x1, LOT.z1)
    run(LOT.x0, LOT.z1, LOT.x1, LOT.z1)
    run(LOT.x0, LOT.z0, LOT.x0, 103)

    // Semirremolques sueltos en el estacionamiento.
    const trailers: Box[] = (
      [
        [0, '#f4f5f6'],
        [1, '#b5523b'],
        [3, '#f4f5f6'],
        [4, '#3f6fa8'],
      ] as const
    ).map(([i, c]) => ({ p: [72.3 + i * 4.6, Y + 2.65, -26] as [number, number, number], s: [2.55, 2.8, 13.6] as [number, number, number], color: c }))
    return [trees, cars, poles, fencePosts, fenceMesh, trailers]
  }, [])

  const markBoxes = useMemo(() => marks(), [])

  return (
    <group>
      {/* Campo con pasto. */}
      <Ground r={{ x0: -1500, x1: 1500, z0: -1500, z1: 1500 }} y={Y - 0.06} material={grass} scale={20} />
      {/* Asfalto con cordón: un borde de hormigón apenas más ancho debajo. */}
      {PAVED.map((r, i) => (
        <group key={i}>
          <Ground r={{ x0: r.x0 - 0.35, x1: r.x1 + 0.35, z0: r.z0 - 0.35, z1: r.z1 + 0.35 }} y={Y - 0.02} material={curb} scale={10} />
          <Ground r={r} y={Y} material={asphalt} scale={10} />
        </group>
      ))}
      {/* Losa de hormigón frente a los andenes. */}
      <Ground r={{ x0: -HL - 2, x1: HL + 2, z0: HW, z1: HW + 20 }} y={Y + 0.01} material={concrete} scale={5} />
      <Instances boxes={markBoxes} material={markMaterial} />
      {/* Ruta 5: dos calzadas con cantero central, y el camino de acceso. */}
      <Ground r={{ x0: RUTA5_X - 9.5, x1: RUTA5_X + 9.5, z0: -1500, z1: 1500 }} y={Y + 0.01} material={asphalt} scale={10} />
      <mesh position={[RUTA5_X, Y + 0.03, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[2.2, 3000]} />
        <meshStandardMaterial color="#86a06c" roughness={1} />
      </mesh>
      {[-1, 1].map((s) =>
        [-1, 1].map((e) => (
          <mesh key={`${s}${e}`} position={[RUTA5_X + s * 5.3 + e * 4, Y + 0.03, 0]} rotation-x={-Math.PI / 2}>
            <planeGeometry args={[0.15, 3000]} />
            <meshStandardMaterial color="#f4f4f0" />
          </mesh>
        )),
      )}
      <Ground r={{ x0: RUTA5_X + 9.5, x1: LOT.x0, z0: 105, z1: 115 }} y={Y + 0.005} material={asphalt} scale={10} />
      <Traffic />
      {/* Portería con barrera. */}
      <group position={[LOT.x0 + 2, Y, 121]}>
        <mesh position={[0, 1.5, 0]} castShadow>
          <boxGeometry args={[4, 3, 4.5]} />
          <meshStandardMaterial color="#f2f3f4" />
        </mesh>
        <mesh position={[0, 3.15, 0]}>
          <boxGeometry args={[5, 0.3, 5.5]} />
          <meshStandardMaterial color="#1f3557" />
        </mesh>
        <mesh position={[2.6, 1.1, -6]}>
          <boxGeometry args={[0.12, 0.12, 9]} />
          <meshStandardMaterial color="#e8473b" />
        </mesh>
      </group>
      <Instances boxes={trailers} material={paint} castShadow />
      <Trees spots={trees} />
      <Cars spots={cars} />
      <LightPoles at={poles} />
      <Instances boxes={fencePosts} material={fenceMaterial} />
      <Instances boxes={fenceMesh} material={meshMaterial} receiveShadow={false} />
      <Neighbor x={300} z={-40} w={150} d={80} h={12} />
      <Neighbor x={40} z={-270} w={180} d={90} h={13} />
      {!enXR && (
        <Html position={[RUTA5_X, 8, -40]} center zIndexRange={[10, 0]}>
          <Tag tone="muted">Ruta 5</Tag>
        </Html>
      )}
    </group>
  )
}
