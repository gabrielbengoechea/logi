import { useLayoutEffect, useMemo, useRef } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { FAMILIES, type AbcClass } from '../sim/catalog'
import { PALLET, RACK, faceX } from '../sim/warehouse'
import { dayOf, useStore } from '../store'
import { Instances, type Box } from './Instances'
import { assignSlots, occupancy } from './slotting'

export const ABC_COLORS: Record<AbcClass, string> = { A: '#e8702a', B: '#2f7de1', C: '#a3abb4' }
const FAMILY_COLOR = Object.fromEntries(FAMILIES.map((f) => [f.key, f.color]))
const TOP = RACK.firstBeam + (RACK.levels - 2) * RACK.levelPitch + 1.75

/** Estructura de las estanterías: puntales azules, largueros naranjas y protecciones amarillas en las puntas. */
function Structure() {
  const [posts, beams, guards] = useMemo(() => {
    const posts: Box[] = []
    const beams: Box[] = []
    const guards: Box[] = []
    for (let k = 0; k < RACK.doubles * 2; k++) {
      const x = faceX(k)
      for (let b = 0; b <= RACK.bays; b++) {
        const z = RACK.front - b * RACK.bayLength
        for (const dx of [-RACK.depth / 2, RACK.depth / 2]) posts.push({ p: [x + dx, TOP / 2, z], s: [0.09, TOP, 0.09] })
        // Diagonales del bastidor, sugeridas con una barra fina.
        posts.push({ p: [x, TOP / 2, z], s: [RACK.depth, 0.04, 0.04] })
      }
      for (let b = 0; b < RACK.bays; b++) {
        const z = RACK.front - (b + 0.5) * RACK.bayLength
        for (let l = 1; l < RACK.levels; l++) {
          const y = RACK.firstBeam + (l - 1) * RACK.levelPitch - 0.07
          for (const dx of [-RACK.depth / 2, RACK.depth / 2]) beams.push({ p: [x + dx, y, z], s: [0.06, 0.13, RACK.bayLength - 0.09] })
        }
      }
      guards.push({ p: [x, 0.2, RACK.front + 0.25], s: [RACK.depth + 0.1, 0.4, 0.25] })
    }
    return [posts, beams, guards]
  }, [])
  const blue = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2c5aa0', roughness: 0.45, metalness: 0.4 }), [])
  const orange = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f08a24', roughness: 0.45, metalness: 0.3 }), [])
  const yellow = useMemo(() => new THREE.MeshStandardMaterial({ color: '#f2c12e', roughness: 0.6 }), [])
  return (
    <group>
      <Instances boxes={posts} material={blue} castShadow />
      <Instances boxes={beams} material={orange} castShadow />
      <Instances boxes={guards} material={yellow} />
    </group>
  )
}

const UNIT = new THREE.BoxGeometry(1, 1, 1)

/** Pallets del día: base de madera y carga envuelta, con el color de la familia o de la clase ABC. */
function Pallets() {
  const run = useStore((s) => s.run)
  const day = useStore((s) => dayOf(s.t))
  const colorMode = useStore((s) => s.colorMode)
  const selection = useStore((s) => s.selection)
  const select = useStore((s) => s.select)
  const slotting = useMemo(() => assignSlots(run.products, run.days), [run])
  const occ = useMemo(() => occupancy(slotting, run.days[day]), [slotting, run, day])
  const bases = useRef<THREE.InstancedMesh>(null)
  const loads = useRef<THREE.InstancedMesh>(null)
  const count = slotting.slots.length
  const wood = useMemo(() => new THREE.MeshStandardMaterial({ color: '#b08455', roughness: 0.9 }), [])
  const wrap = useMemo(() => new THREE.MeshStandardMaterial({ roughness: 0.42, metalness: 0.02 }), [])

  useLayoutEffect(() => {
    const b = bases.current
    const l = loads.current
    if (!b || !l) return
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    const dim = new THREE.Color('#d5d9dd')
    const selected = selection?.kind === 'product' ? selection.id : -1
    for (let i = 0; i < count; i++) {
      const s = occ.sku[i]
      const slot = slotting.slots[i]
      if (s < 0) {
        m.makeScale(0, 0, 0)
        b.setMatrixAt(i, m)
        l.setMatrixAt(i, m)
        continue
      }
      const p = run.products[s]
      // Altura de la carga según el producto (1,0 a 1,5 m), siempre la misma.
      const h = 1.0 + ((p.id * 37) % 11) / 20
      m.makeScale(PALLET.d, PALLET.base, PALLET.w).setPosition(slot.x, slot.y + PALLET.base / 2 + 0.01, slot.z)
      b.setMatrixAt(i, m)
      m.makeScale(PALLET.d - 0.06, h, PALLET.w - 0.05).setPosition(slot.x, slot.y + PALLET.base + h / 2 + 0.01, slot.z)
      l.setMatrixAt(i, m)
      c.set(colorMode === 'abc' ? ABC_COLORS[p.abc] : FAMILY_COLOR[p.family])
      if (selected >= 0 && s !== selected) c.lerp(dim, 0.82)
      l.setColorAt(i, c)
    }
    b.instanceMatrix.needsUpdate = true
    l.instanceMatrix.needsUpdate = true
    if (l.instanceColor) l.instanceColor.needsUpdate = true
    b.computeBoundingSphere()
    l.computeBoundingSphere()
  }, [occ, slotting, run, count, colorMode, selection])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.instanceId === undefined) return
    const s = occ.sku[e.instanceId]
    if (s < 0) return
    e.stopPropagation()
    select({ kind: 'product', id: s })
  }

  return (
    <group>
      <instancedMesh ref={bases} args={[UNIT, wood, count]} castShadow receiveShadow />
      <instancedMesh ref={loads} args={[UNIT, wrap, count]} castShadow receiveShadow onClick={onClick} />
    </group>
  )
}

export default function Racks() {
  return (
    <group>
      <Structure />
      <Pallets />
    </group>
  )
}
