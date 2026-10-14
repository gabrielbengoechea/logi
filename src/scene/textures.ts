import * as THREE from 'three'

/** Texturas dibujadas en el navegador (no se descarga ninguna imagen). Se crean una vez y se comparten. */
const cache = new Map<string, THREE.Texture>()

function canvas(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  draw(c.getContext('2d')!)
  return c
}

function once<T extends THREE.Texture>(key: string, make: () => T): T {
  let t = cache.get(key) as T | undefined
  if (!t) cache.set(key, (t = make()))
  return t
}

function repeat(t: THREE.Texture, srgb = true) {
  t.wrapS = t.wrapT = THREE.RepeatWrapping
  t.anisotropy = 8
  if (srgb) t.colorSpace = THREE.SRGBColorSpace
  return t
}

/** Perfil de la chapa nervada (trapezoidal) cada 0,25 m: pendiente según x, en [−1, 1]. */
function ribSlope(u: number) {
  const f = u % 1
  if (f < 0.1) return 1
  if (f < 0.4) return 0
  if (f < 0.5) return -1
  return 0
}

/** Mapa de normales de la chapa nervada: 1 m de ancho por textura (cuatro nervios). */
export const ribNormal = () =>
  once('ribNormal', () =>
    repeat(
      new THREE.CanvasTexture(
        canvas(256, 4, (g) => {
          for (let x = 0; x < 256; x++) {
            const s = ribSlope((x / 256) * 4) * 0.8
            const len = Math.hypot(s, 1)
            g.fillStyle = `rgb(${Math.round(((-s / len) * 0.5 + 0.5) * 255)},128,${Math.round((1 / len) * 0.5 * 255 + 127)})`
            g.fillRect(x, 0, 1, 4)
          }
        }),
      ),
      false,
    ),
  )

/** Color de la chapa nervada: leve sombreado en los nervios y algo de suciedad abajo. */
export const ribColor = (base: string) =>
  once(`ribColor-${base}`, () =>
    repeat(
      new THREE.CanvasTexture(
        canvas(256, 256, (g) => {
          g.fillStyle = base
          g.fillRect(0, 0, 256, 256)
          for (let x = 0; x < 256; x++) {
            const s = ribSlope((x / 256) * 4)
            if (s) {
              g.fillStyle = s > 0 ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)'
              g.fillRect(x, 0, 1, 256)
            }
          }
          const grad = g.createLinearGradient(0, 200, 0, 256)
          grad.addColorStop(0, 'rgba(90,80,70,0)')
          grad.addColorStop(1, 'rgba(90,80,70,0.06)')
          g.fillStyle = grad
          g.fillRect(0, 200, 256, 56)
        }),
      ),
    ),
  )

/** Techo de chapa con juntas engrapadas cada 0,6 m (textura de 6 m). */
export const roofColor = () =>
  once('roof', () =>
    repeat(
      new THREE.CanvasTexture(
        canvas(512, 64, (g) => {
          g.fillStyle = '#d3d8dc'
          g.fillRect(0, 0, 512, 64)
          for (let i = 0; i < 10; i++) {
            const x = (i * 512) / 10
            g.fillStyle = 'rgba(255,255,255,0.55)'
            g.fillRect(x, 0, 2, 64)
            g.fillStyle = 'rgba(0,0,0,0.12)'
            g.fillRect(x + 2, 0, 3, 64)
          }
        }),
      ),
    ),
  )

/** Pasto con manchas y franjas de corte, en una textura de 20 m. */
export const grassColor = () =>
  once('grass', () =>
    repeat(
      new THREE.CanvasTexture(
        canvas(512, 512, (g) => {
          g.fillStyle = '#8fae6f'
          g.fillRect(0, 0, 512, 512)
          let s = 11
          const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
          for (let i = 0; i < 2600; i++) {
            const tone = r()
            g.fillStyle = tone < 0.5 ? `rgba(70,110,50,${0.05 + r() * 0.08})` : `rgba(190,200,120,${0.04 + r() * 0.06})`
            g.beginPath()
            g.ellipse(r() * 512, r() * 512, 2 + r() * 14, 1 + r() * 8, r() * 3, 0, Math.PI * 2)
            g.fill()
          }
          for (let y = 0; y < 512; y += 64) {
            g.fillStyle = 'rgba(255,255,255,0.035)'
            g.fillRect(0, y, 512, 32)
          }
        }),
      ),
    ),
  )

/** Asfalto: gris con grano fino, en una textura de 10 m. */
export const asphaltColor = () =>
  once('asphalt', () =>
    repeat(
      new THREE.CanvasTexture(
        canvas(512, 512, (g) => {
          g.fillStyle = '#5b6065'
          g.fillRect(0, 0, 512, 512)
          let s = 5
          const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
          for (let i = 0; i < 22000; i++) {
            g.fillStyle = r() < 0.5 ? `rgba(255,255,255,${0.04 + r() * 0.06})` : `rgba(0,0,0,${0.05 + r() * 0.07})`
            g.fillRect(r() * 512, r() * 512, 1 + r() * 1.5, 1 + r() * 1.5)
          }
          for (let i = 0; i < 18; i++) {
            g.fillStyle = `rgba(30,32,35,${0.04 + r() * 0.05})`
            g.beginPath()
            g.ellipse(r() * 512, r() * 512, 20 + r() * 60, 10 + r() * 30, r() * 3, 0, Math.PI * 2)
            g.fill()
          }
        }),
      ),
    ),
  )

/** Portón seccional: paneles horizontales con una ventanita, 3,4 × 3,8 m. */
export const doorColor = () =>
  once('door', () => {
    const t = new THREE.CanvasTexture(
      canvas(128, 144, (g) => {
        g.fillStyle = '#e6e9ec'
        g.fillRect(0, 0, 128, 144)
        for (let i = 1; i < 6; i++) {
          g.fillStyle = 'rgba(0,0,0,0.18)'
          g.fillRect(0, i * 24, 128, 2)
          g.fillStyle = 'rgba(255,255,255,0.6)'
          g.fillRect(0, i * 24 + 2, 128, 1)
        }
        g.fillStyle = '#5b7a99'
        for (let x = 16; x < 120; x += 28) g.fillRect(x, 54, 18, 8)
      }),
    )
    t.colorSpace = THREE.SRGBColorSpace
    return t
  })

/** Cartel de la fachada: letras blancas sobre la banda azul. */
export const signTexture = (text: string) =>
  once(`sign-${text}`, () => {
    const t = new THREE.CanvasTexture(
      canvas(2048, 128, (g) => {
        g.fillStyle = '#1f3557'
        g.fillRect(0, 0, 2048, 128)
        g.fillStyle = '#e8702a'
        g.fillRect(0, 118, 2048, 10)
        g.fillStyle = '#ffffff'
        g.font = '700 74px -apple-system, "Helvetica Neue", Arial, sans-serif'
        g.textBaseline = 'middle'
        g.fillText(text, 60, 62)
      }),
    )
    t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 8
    return t
  })

/** Muro cortina de las oficinas: vidrio azulado con montantes cada 1,5 m y losas cada 4 m. */
export const glassColor = () =>
  once('glass', () =>
    repeat(
      new THREE.CanvasTexture(
        canvas(128, 256, (g) => {
          const grad = g.createLinearGradient(0, 0, 0, 256)
          grad.addColorStop(0, '#7f9bb8')
          grad.addColorStop(1, '#4d6a88')
          g.fillStyle = grad
          g.fillRect(0, 0, 128, 256)
          g.fillStyle = '#2b3138'
          g.fillRect(0, 0, 4, 256)
          g.fillRect(0, 0, 128, 10)
          g.fillRect(0, 124, 128, 6)
        }),
      ),
    ),
  )
