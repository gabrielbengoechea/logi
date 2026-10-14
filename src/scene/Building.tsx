import { useEffect, useMemo } from 'react'
import * as THREE from 'three'
import { DOCKS, HALL, RACK, STAGING, aisleX, faceX } from '../sim/warehouse'
import { useStore } from '../store'
import { registerGlow } from './environment'
import { Instances } from './Instances'

const HL = HALL.length / 2
const HW = HALL.width / 2
const DOOR = { w: 3.4, h: 3.8 }
/** Ancho de la zona de la izquierda (oficinas, baterías, consolidación) y de la derecha (piso, devoluciones). */
const WEST = -38.5
const EAST = 37.5

/** Piso de hormigón pulido con las marcas pintadas: pasillos, playa de andenes, zonas y juntas. */
function floorTexture() {
  const ppm = 16
  const c = document.createElement('canvas')
  c.width = HALL.length * ppm
  c.height = HALL.width * ppm
  const g = c.getContext('2d')!
  g.setTransform(ppm, 0, 0, ppm, HL * ppm, HW * ppm)
  g.fillStyle = '#c9cbcd'
  g.fillRect(-HL, -HW, HALL.length, HALL.width)
  // Manchas suaves del hormigón.
  const rand = (() => {
    let s = 7
    return () => ((s = (s * 16807) % 2147483647) / 2147483647)
  })()
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '90,95,100'},${0.025 + rand() * 0.03})`
    const r = 0.6 + rand() * 3.5
    g.beginPath()
    g.ellipse(-HL + rand() * HALL.length, -HW + rand() * HALL.width, r, r * (0.4 + rand() * 0.6), rand() * 3, 0, Math.PI * 2)
    g.fill()
  }
  // Juntas de la losa cada 6 m.
  g.strokeStyle = 'rgba(80,85,90,0.28)'
  g.lineWidth = 0.05
  for (let x = -HL + 6; x < HL; x += 6) (g.beginPath(), g.moveTo(x, -HW), g.lineTo(x, HW), g.stroke())
  for (let z = -HW + 6; z < HW; z += 6) (g.beginPath(), g.moveTo(-HL, z), g.lineTo(HL, z), g.stroke())

  // Líneas amarillas al pie de cada cara de estantería.
  g.strokeStyle = '#e6b422'
  g.lineWidth = 0.1
  const back = RACK.front - RACK.bays * RACK.bayLength
  for (let k = 0; k < RACK.doubles * 2; k++) {
    const x = faceX(k) + (k % 2 === 0 ? -RACK.depth / 2 - 0.1 : RACK.depth / 2 + 0.1)
    g.beginPath()
    g.moveTo(x, RACK.front + 0.1)
    g.lineTo(x, back - 0.1)
    g.stroke()
  }
  // Pasillo peatonal verde a lo largo del pasillo central.
  g.fillStyle = '#3f9b5a'
  g.fillRect(WEST, STAGING.z0 - 1.6, EAST - WEST, 1.2)
  g.fillStyle = 'rgba(255,255,255,0.85)'
  for (let x = WEST + 1; x < EAST; x += 3) g.fillRect(x, STAGING.z0 - 1.1, 1.2, 0.2)

  // Playa de andenes: un carril por puerta, con su número. Recepción en azul, despacho en naranja.
  g.textAlign = 'center'
  g.textBaseline = 'middle'
  DOCKS.forEach((d, i) => {
    g.strokeStyle = d.inbound ? '#2f7de1' : '#e8702a'
    g.lineWidth = 0.14
    g.strokeRect(d.x - 2.6, STAGING.z0, 5.2, STAGING.z1 - STAGING.z0)
    g.fillStyle = d.inbound ? 'rgba(47,125,225,0.10)' : 'rgba(232,112,42,0.10)'
    g.fillRect(d.x - 2.6, STAGING.z0, 5.2, STAGING.z1 - STAGING.z0)
    g.fillStyle = d.inbound ? '#2f7de1' : '#e8702a'
    g.font = 'bold 1.6px -apple-system, system-ui, sans-serif'
    g.fillText(d.inbound ? `R${i + 1}` : `D${i - 3}`, d.x, STAGING.z1 - 1.6)
  })
  g.fillStyle = 'rgba(29,29,31,0.55)'
  g.font = '600 1.3px -apple-system, system-ui, sans-serif'
  g.fillText('RECEPCIÓN', (DOCKS[0].x + DOCKS[3].x) / 2, STAGING.z0 + 2)
  g.fillText('DESPACHO', (DOCKS[4].x + DOCKS[9].x) / 2, STAGING.z0 + 2)

  // Zona de baterías (piso azul), consolidación y piso de bloques.
  g.fillStyle = 'rgba(47,125,225,0.18)'
  g.fillRect(-61, -14, 13, 12)
  g.fillStyle = 'rgba(29,29,31,0.55)'
  g.fillText('CARGA DE BATERÍAS', -54.5, -12.6)
  g.strokeStyle = '#e6b422'
  g.setLineDash([0.6, 0.4])
  g.strokeRect(-61, 2, 20, 18)
  g.setLineDash([])
  g.fillText('CONSOLIDACIÓN', -51, 3.4)
  g.strokeStyle = 'rgba(29,29,31,0.4)'
  g.lineWidth = 0.08
  for (let x = EAST + 3; x < HL - 4; x += 5) for (let z = -36; z < 14; z += 6) g.strokeRect(x, z, 4.2, 5.2)
  g.fillText('ALMACENAJE EN PISO', (EAST + HL) / 2, 16)

  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.anisotropy = 8
  return t
}

/** Paneles de pared: chapa con nervios verticales y zócalo de hormigón. */
function wallTexture(inside: boolean) {
  const c = document.createElement('canvas')
  c.width = 256
  c.height = 256
  const g = c.getContext('2d')!
  g.fillStyle = inside ? '#eef0f2' : '#dfe3e7'
  g.fillRect(0, 0, 256, 256)
  for (let x = 0; x < 256; x += 32) {
    g.fillStyle = inside ? 'rgba(0,0,0,0.06)' : 'rgba(0,0,0,0.09)'
    g.fillRect(x, 0, 3, 256)
    g.fillStyle = 'rgba(255,255,255,0.5)'
    g.fillRect(x + 3, 0, 2, 256)
  }
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  return t
}

/** Una pared plana con huecos opcionales, mirando hacia `normal` (en el plano xz). */
function wallGeometry(length: number, height: number, holes: { x: number; w: number; h: number }[] = []) {
  const shape = new THREE.Shape([new THREE.Vector2(-length / 2, 0), new THREE.Vector2(length / 2, 0), new THREE.Vector2(length / 2, height), new THREE.Vector2(-length / 2, height)])
  for (const h of holes) shape.holes.push(new THREE.Path([new THREE.Vector2(h.x - h.w / 2, 0.001), new THREE.Vector2(h.x - h.w / 2, h.h), new THREE.Vector2(h.x + h.w / 2, h.h), new THREE.Vector2(h.x + h.w / 2, 0.001)]))
  const g = new THREE.ShapeGeometry(shape)
  // UV en metros, para repetir la textura de paneles cada 4 m.
  const pos = g.attributes.position as THREE.BufferAttribute
  const uv = new Float32Array(pos.count * 2)
  for (let i = 0; i < pos.count; i++) {
    uv[i * 2] = pos.getX(i) / 4
    uv[i * 2 + 1] = pos.getY(i) / 4
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
  return g
}

/**
 * Paredes en corte: cada pared se dibuja mirando hacia adentro, así la que queda entre la cámara y la nave no se ve
 * y se puede mirar el interior desde cualquier lado. En la vista exterior las paredes se ven de los dos lados.
 */
function Walls({ outside }: { outside: boolean }) {
  const [inner, outer] = useMemo(() => [wallTexture(true), wallTexture(false)], [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ map: inner, roughness: 0.85 }), [inner])
  const outerMaterial = useMemo(() => new THREE.MeshStandardMaterial({ map: outer, roughness: 0.8, side: THREE.BackSide }), [outer])
  const dockHoles = DOCKS.map((d) => ({ x: -d.x, w: DOOR.w, h: DOOR.h }))
  const walls = useMemo(
    () => [
      // [geometría, posición, giro]: el giro deja la cara de adelante mirando al interior.
      { g: wallGeometry(HALL.length, HALL.height, dockHoles), p: [0, 0, HW] as const, r: Math.PI },
      { g: wallGeometry(HALL.length, HALL.height), p: [0, 0, -HW] as const, r: 0 },
      { g: wallGeometry(HALL.width, HALL.height), p: [-HL, 0, 0] as const, r: Math.PI / 2 },
      { g: wallGeometry(HALL.width, HALL.height), p: [HL, 0, 0] as const, r: -Math.PI / 2 },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  )
  return (
    <group>
      {walls.map((w, i) => (
        <group key={i} position={w.p as unknown as THREE.Vector3Tuple} rotation-y={w.r}>
          <mesh geometry={w.g} material={material} receiveShadow />
          {outside && <mesh geometry={w.g} material={outerMaterial} castShadow />}
        </group>
      ))}
      {/* Franja azul arriba, por fuera. */}
      {outside && (
        <mesh position={[0, HALL.height - 0.9, HW + 0.06]}>
          <boxGeometry args={[HALL.length + 0.2, 1.4, 0.05]} />
          <meshStandardMaterial color="#1f3557" roughness={0.6} />
        </mesh>
      )}
    </group>
  )
}

/** Pórticos de acero cada 8 m, correas y luminarias. El techo de chapa solo se ve en la vista exterior. */
function Roof({ outside }: { outside: boolean }) {
  const steel = useMemo(() => new THREE.MeshStandardMaterial({ color: '#8d969f', roughness: 0.5, metalness: 0.5 }), [])
  const frames = useMemo(() => {
    const boxes: { p: [number, number, number]; s: [number, number, number] }[] = []
    for (let x = -HL + 4; x <= HL - 3; x += 8) {
      // Viga reticulada (cordón superior e inferior) y pilares en las paredes.
      boxes.push({ p: [x, HALL.height + 0.9, 0], s: [0.25, 0.25, HALL.width] })
      boxes.push({ p: [x, HALL.height - 0.1, 0], s: [0.2, 0.2, HALL.width] })
      for (let z = -HW + 2; z < HW; z += 4) boxes.push({ p: [x, HALL.height + 0.4, z], s: [0.08, 1, 0.08] })
      for (const z of [-HW + 0.3, HW - 0.3]) boxes.push({ p: [x, HALL.height / 2, z], s: [0.4, HALL.height, 0.4] })
    }
    for (let z = -HW + 4; z < HW; z += 4) boxes.push({ p: [0, HALL.height + 1.1, z], s: [HALL.length, 0.15, 0.1] })
    return boxes
  }, [])
  const lamps = useMemo(() => {
    const out: { p: [number, number, number]; s: [number, number, number] }[] = []
    for (let d = -1; d < RACK.doubles; d++) for (let z = 18; z > -36; z -= 9) out.push({ p: [aisleX(d), 11.6, z], s: [0.5, 0.12, 1.4] })
    for (const d of DOCKS) out.push({ p: [d.x, 11.6, 31], s: [0.5, 0.12, 1.4] })
    return out
  }, [])
  const lampMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#ffffff', emissive: '#fff6e0', emissiveIntensity: 0.6 }), [])
  useEffect(() => registerGlow(lampMaterial, 0.6, 3), [lampMaterial])
  const roofMaterial = useMemo(() => new THREE.MeshStandardMaterial({ color: '#c4cad0', roughness: 0.6, metalness: 0.3 }), [])

  return (
    <group>
      <Instances boxes={frames} material={steel} castShadow />
      <Instances boxes={lamps} material={lampMaterial} />
      {outside && (
        <mesh material={roofMaterial} position={[0, HALL.height + 1.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[HALL.length + 1, 0.2, HALL.width + 1]} />
        </mesh>
      )}
    </group>
  )
}

/** Puertas de los andenes: marco con burletes, persiana y niveladora. */
function DockDoors() {
  return (
    <group>
      {DOCKS.map((d, i) => (
        <group key={i} position={[d.x, 0, HW]}>
          {/* Marco y burletes por fuera. */}
          <mesh position={[0, DOOR.h + 0.25, 0.35]} castShadow>
            <boxGeometry args={[DOOR.w + 1, 0.5, 0.7]} />
            <meshStandardMaterial color="#1d1f22" roughness={0.9} />
          </mesh>
          {[-1, 1].map((s) => (
            <mesh key={s} position={[(s * (DOOR.w + 0.5)) / 2, DOOR.h / 2, 0.35]} castShadow>
              <boxGeometry args={[0.5, DOOR.h, 0.7]} />
              <meshStandardMaterial color="#1d1f22" roughness={0.9} />
            </mesh>
          ))}
          {/* Persiana enrollada arriba y niveladora en el piso. */}
          <mesh position={[0, DOOR.h - 0.25, -0.3]}>
            <boxGeometry args={[DOOR.w, 0.5, 0.5]} />
            <meshStandardMaterial color="#a9b1b9" metalness={0.4} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.02, -1.2]} receiveShadow>
            <boxGeometry args={[2.2, 0.04, 2.4]} />
            <meshStandardMaterial color="#4a4f55" metalness={0.5} roughness={0.6} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

/** Oficinas de dos pisos con ventanal hacia la nave. */
function Offices() {
  return (
    <group position={[-56, 0, -31]}>
      <mesh position={[0, 3.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 6.5, 18]} />
        <meshStandardMaterial color="#f4f5f6" roughness={0.8} />
      </mesh>
      {[1.8, 5].map((y) => (
        <mesh key={y} position={[6.01, y, 0]}>
          <boxGeometry args={[0.05, 1.4, 16]} />
          <meshStandardMaterial color="#5d7fa3" roughness={0.15} metalness={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 6.6, 0]}>
        <boxGeometry args={[12.2, 0.2, 18.2]} />
        <meshStandardMaterial color="#1f3557" />
      </mesh>
    </group>
  )
}

/** Cargadores de baterías contra la pared. */
function Chargers() {
  const boxes = useMemo(() => Array.from({ length: 8 }, (_, i) => ({ p: [-62, 1, -13 + i * 1.5] as [number, number, number], s: [0.6, 1.4, 0.9] as [number, number, number] })), [])
  const material = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3b4a63', roughness: 0.5 }), [])
  return <Instances boxes={boxes} material={material} castShadow />
}

export default function Building() {
  const view = useStore((s) => s.view)
  const outside = view === 'exterior'
  const floor = useMemo(() => floorTexture(), [])
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[HALL.length, HALL.width]} />
        <meshStandardMaterial map={floor} roughness={0.55} metalness={0.05} />
      </mesh>
      {/* Plataforma: la nave está a 1,2 m sobre el patio. */}
      <mesh position={[0, -HALL.dockHeight / 2 - 0.01, 0]} receiveShadow castShadow>
        <boxGeometry args={[HALL.length + 0.4, HALL.dockHeight, HALL.width + 0.4]} />
        <meshStandardMaterial color="#9da3a8" roughness={0.9} />
      </mesh>
      <Walls outside={outside} />
      <Roof outside={outside} />
      <DockDoors />
      <Offices />
      <Chargers />
    </group>
  )
}
