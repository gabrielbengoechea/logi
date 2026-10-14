import { useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'

export interface Box {
  p: [number, number, number]
  s: [number, number, number]
  color?: THREE.ColorRepresentation
}

const UNIT = new THREE.BoxGeometry(1, 1, 1)

/** Muchas cajas iguales en un solo mesh (estructura, luminarias, estanterías). */
export function Instances({ boxes, material, castShadow = false, receiveShadow = true }: { boxes: Box[]; material: THREE.Material; castShadow?: boolean; receiveShadow?: boolean }) {
  const ref = useRef<THREE.InstancedMesh>(null)
  const count = boxes.length
  const m = useMemo(() => new THREE.Matrix4(), [])
  useLayoutEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const color = new THREE.Color()
    boxes.forEach((b, i) => {
      m.makeScale(...b.s).setPosition(...b.p)
      mesh.setMatrixAt(i, m)
      if (b.color !== undefined) mesh.setColorAt(i, color.set(b.color))
    })
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [boxes, m])
  return <instancedMesh ref={ref} args={[UNIT, material, count]} castShadow={castShadow} receiveShadow={receiveShadow} />
}
