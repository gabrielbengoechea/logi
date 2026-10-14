import { useMemo, useRef } from 'react'
import { Html } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { DOCKS, HALL } from '../sim/warehouse'
import { Instances, type Box } from './Instances'
import Tag from './Tag'

const Y = -HALL.dockHeight
const HW = HALL.width / 2
/** Predio: x de −100 a 110, z de −60 a 125. La Ruta 5 corre de norte a sur al oeste. */
const LOT = { x0: -100, x1: 110, z0: -60, z1: 125 }
const RUTA5_X = -230

/** Asfalto del patio con las marcas: carriles de los andenes, estacionamiento de camiones y de autos. */
function yardTexture() {
  const ppm = 8
  const [w, h] = [LOT.x1 - LOT.x0, LOT.z1 - LOT.z0]
  const c = document.createElement('canvas')
  c.width = w * ppm
  c.height = h * ppm
  const g = c.getContext('2d')!
  g.setTransform(ppm, 0, 0, ppm, -LOT.x0 * ppm, -LOT.z0 * ppm)
  g.fillStyle = '#5a5f64'
  g.fillRect(LOT.x0, LOT.z0, w, h)
  const rand = (() => {
    let s = 3
    return () => ((s = (s * 16807) % 2147483647) / 2147483647)
  })()
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${0.012 + rand() * 0.02})`
    g.beginPath()
    g.ellipse(LOT.x0 + rand() * w, LOT.z0 + rand() * h, 1 + rand() * 4, 0.6 + rand() * 2, rand() * 3, 0, Math.PI * 2)
    g.fill()
  }
  // Losa de hormigón frente a los andenes.
  g.fillStyle = '#a7abae'
  g.fillRect(-HALL.length / 2, HW, HALL.length, 20)
  g.strokeStyle = 'rgba(70,72,75,0.5)'
  g.lineWidth = 0.05
  for (let x = -HALL.length / 2; x < HALL.length / 2; x += 5) (g.beginPath(), g.moveTo(x, HW), g.lineTo(x, HW + 20), g.stroke())
  // Guías amarillas de cada andén.
  g.strokeStyle = '#f2c12e'
  g.lineWidth = 0.15
  for (const d of DOCKS)
    for (const s of [-1, 1]) {
      g.beginPath()
      g.moveTo(d.x + s * 1.9, HW)
      g.lineTo(d.x + s * 1.9, HW + 18)
      g.stroke()
    }
  // Estacionamiento de camiones en espera (a la derecha) y de autos (a la izquierda).
  g.strokeStyle = 'rgba(255,255,255,0.85)'
  g.lineWidth = 0.15
  for (let i = 0; i <= 4; i++) (g.beginPath(), g.moveTo(67.5 + i * 5, HW + 18), g.lineTo(67.5 + i * 5, HW + 82), g.stroke())
  for (let i = 0; i <= 14; i++) (g.beginPath(), g.moveTo(-95, -55 + i * 2.6), g.lineTo(-90, -55 + i * 2.6), g.stroke())
  for (let i = 0; i <= 14; i++) (g.beginPath(), g.moveTo(-76, -55 + i * 2.6), g.lineTo(-71, -55 + i * 2.6), g.stroke())
  // Flechas de circulación.
  g.fillStyle = 'rgba(255,255,255,0.8)'
  g.font = 'bold 3px -apple-system, system-ui, sans-serif'
  g.textAlign = 'center'
  g.fillText('→', -40, 108)
  g.fillText('→', 20, 108)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Autos y camiones que pasan por la Ruta 5. */
function Traffic() {
  const ref = useRef<THREE.InstancedMesh>(null)
  const N = 40
  const cars = useMemo(
    () =>
      Array.from({ length: N }, (_, i) => ({
        lane: i % 4,
        offset: (i * 397) % 3000,
        speed: 22 + ((i * 7) % 9),
        truck: i % 5 === 0,
        color: ['#e9eaec', '#2c3e50', '#a93226', '#7f8c8d', '#1f3557', '#d4ac0d'][i % 6],
      })),
    [],
  )
  const m = useMemo(() => new THREE.Matrix4(), [])
  const unit = useMemo(() => new THREE.BoxGeometry(1, 1, 1), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), [])
  useFrame(({ clock }) => {
    const mesh = ref.current
    if (!mesh) return
    // Tránsito en tiempo real, aparte del reloj simulado.
    const t = clock.elapsedTime
    const c = new THREE.Color()
    cars.forEach((car, i) => {
      const dir = car.lane < 2 ? 1 : -1
      const z = ((((car.offset + dir * car.speed * t) % 3000) + 3000) % 3000) - 1500
      const x = RUTA5_X + (car.lane - 1.5) * 3.6 + (car.lane < 2 ? -1.5 : 1.5)
      const [len, hgt] = car.truck ? [16, 3.8] : [4.4, 1.5]
      m.makeScale(2.2, hgt, len).setPosition(x, Y + hgt / 2 + 0.3, z)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, c.set(car.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  })
  return <instancedMesh ref={ref} args={[unit, material, N]} castShadow frustumCulled={false} />
}

export default function Site() {
  const yard = useMemo(() => yardTexture(), [])
  const [trees, trunks, fence, cars, neighbors] = useMemo(() => {
    const trees: Box[] = []
    const trunks: Box[] = []
    const r = (k: number) => Math.abs(Math.sin(k * 12.9898) * 43758.5453) % 1
    const plant = (x: number, z: number, k: number) => {
      const s = 4 + r(k) * 3
      trees.push({ p: [x, Y + 2.5 + s / 2, z], s: [s, s, s], color: ['#5b8c4a', '#4f7d43', '#6c9a52'][k % 3] })
      trunks.push({ p: [x, Y + 1.4, z], s: [0.4, 2.8, 0.4] })
    }
    let k = 0
    for (let x = LOT.x0 + 6; x < LOT.x1; x += 11) plant(x, LOT.z0 - 6, k++)
    for (let z = LOT.z0; z < LOT.z1; z += 11) plant(LOT.x1 + 6, z, k++)
    for (let z = LOT.z0; z < 80; z += 11) plant(LOT.x0 - 6, z, k++)
    const fence: Box[] = [
      { p: [(LOT.x0 + LOT.x1) / 2, Y + 1, LOT.z0], s: [LOT.x1 - LOT.x0, 2, 0.05] },
      { p: [LOT.x1, Y + 1, (LOT.z0 + LOT.z1) / 2], s: [0.05, 2, LOT.z1 - LOT.z0] },
      { p: [(LOT.x0 + LOT.x1) / 2 + 10, Y + 1, LOT.z1], s: [LOT.x1 - LOT.x0 - 20, 2, 0.05] },
      { p: [LOT.x0, Y + 1, (LOT.z0 + LOT.z1) / 2 - 12], s: [0.05, 2, LOT.z1 - LOT.z0 - 24] },
    ]
    const cars: Box[] = []
    for (let i = 0; i < 22; i++) {
      if (r(i + 99) < 0.3) continue
      const x = i < 14 ? -92.5 : -73.5
      cars.push({ p: [x, Y + 0.75, -53.7 + (i % 14) * 2.6], s: [4.3, 1.45, 1.8], color: ['#e9eaec', '#2c3e50', '#a93226', '#7f8c8d', '#1f3557'][i % 5] })
    }
    // Otras naves del parque logístico, para dar contexto.
    const neighbors: Box[] = [
      { p: [260, Y + 6, -40], s: [140, 12, 70], color: '#d9dde1' },
      { p: [250, Y + 5, 140], s: [110, 10, 60], color: '#e3e6e9' },
      { p: [20, Y + 7, -190], s: [160, 14, 80], color: '#d4d9de' },
      { p: [-60, Y + 5, 260], s: [90, 10, 60], color: '#dde1e5' },
    ]
    return [trees, trunks, fence, cars, neighbors]
  }, [])
  const leaf = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.9 }), [])
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#6b4f35', roughness: 0.9 }), [])
  const wire = useMemo(() => new THREE.MeshStandardMaterial({ color: '#9aa1a8', transparent: true, opacity: 0.55, roughness: 0.6 }), [])
  const paint = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.4, metalness: 0.3 }), [])
  const panel = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.8 }), [])

  return (
    <group>
      {/* Campo alrededor. */}
      <mesh rotation-x={-Math.PI / 2} position={[0, Y - 0.05, 0]} receiveShadow>
        <planeGeometry args={[3000, 3000]} />
        <meshStandardMaterial color="#9db585" roughness={1} />
      </mesh>
      {/* Patio y estacionamientos. */}
      <mesh rotation-x={-Math.PI / 2} position={[(LOT.x0 + LOT.x1) / 2, Y, (LOT.z0 + LOT.z1) / 2]} receiveShadow>
        <planeGeometry args={[LOT.x1 - LOT.x0, LOT.z1 - LOT.z0]} />
        <meshStandardMaterial map={yard} roughness={0.85} />
      </mesh>
      {/* Ruta 5 (doble vía) y el camino de acceso. */}
      <mesh rotation-x={-Math.PI / 2} position={[RUTA5_X, Y + 0.02, 0]} receiveShadow>
        <planeGeometry args={[19, 3000]} />
        <meshStandardMaterial color="#4b5055" roughness={0.9} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[RUTA5_X, Y + 0.04, 0]}>
        <planeGeometry args={[2, 3000]} />
        <meshStandardMaterial color="#86a06c" roughness={1} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[(RUTA5_X + LOT.x0) / 2, Y + 0.03, 113]} receiveShadow>
        <planeGeometry args={[LOT.x0 - RUTA5_X, 9]} />
        <meshStandardMaterial color="#55595e" roughness={0.9} />
      </mesh>
      <Traffic />
      {/* Portería en la entrada. */}
      <mesh position={[LOT.x0 + 5, Y + 1.5, 103]} castShadow>
        <boxGeometry args={[4, 3, 5]} />
        <meshStandardMaterial color="#f4f5f6" />
      </mesh>
      <mesh position={[LOT.x0 + 5, Y + 3.1, 103]}>
        <boxGeometry args={[4.6, 0.2, 5.6]} />
        <meshStandardMaterial color="#1f3557" />
      </mesh>
      <Instances boxes={trees} material={leaf} castShadow />
      <Instances boxes={trunks} material={wood} />
      <Instances boxes={fence} material={wire} />
      <Instances boxes={cars} material={paint} castShadow />
      <Instances boxes={neighbors} material={panel} castShadow />
      <Html position={[RUTA5_X, 8, -60]} center zIndexRange={[10, 0]}>
        <Tag tone="muted">Ruta 5</Tag>
      </Html>
    </group>
  )
}
