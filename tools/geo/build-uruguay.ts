/**
 * Mapa de Uruguay para el simulador: contorno del país, departamentos, rutas nacionales y el camino por ruta desde la
 * nave hasta cada cliente (con su largo real).
 *
 *   pnpm geo        # escribe public/geo/uruguay.json
 *
 * Fuente: Overture Maps (incluye datos de OpenStreetMap, ODbL), leído directo de AWS bajando solo lo necesario.
 * Coordenadas de salida: kilómetros desde el centro del mapa, x al este y z al sur (como la escena 3D).
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { asyncBufferFromUrl, parquetMetadataAsync, parquetReadObjects } from 'hyparquet'
import { compressors } from 'hyparquet-compressors'
import { EnvHttpProxyAgent, setGlobalDispatcher } from 'undici'
import { CLIENTS, DEPOT } from '../../src/sim/clients'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
if (process.env.HTTPS_PROXY || process.env.https_proxy) setGlobalDispatcher(new EnvHttpProxyAgent())

const OVERTURE_BASE = 'https://overturemaps-us-west-2.s3.us-west-2.amazonaws.com'
const OVERTURE_RELEASE = 'release/2026-09-23.1'
type BBox = [number, number, number, number]
const UY: BBox = [-58.5, -35.05, -53.0, -30.05]
/** Centro del mapa y escala: proyección equirectangular, buena para un país chico. */
const CENTER: [number, number] = [-56.0, -32.6]
const KX = 111.32 * Math.cos((CENTER[1] * Math.PI) / 180)
const KY = 110.57

type Geometry = { type: string; coordinates: unknown }
interface Row {
  geometry: Geometry
  bbox: { xmin: number; xmax: number; ymin: number; ymax: number }
  [k: string]: unknown
}

const km = ([lon, lat]: number[]): [number, number] => [(lon - CENTER[0]) * KX, -(lat - CENTER[1]) * KY]
const round = (p: [number, number]): [number, number] => [Math.round(p[0] * 100) / 100, Math.round(p[1] * 100) / 100]

async function s3List(prefix: string): Promise<string[]> {
  const keys: string[] = []
  let token: string | null = null
  do {
    const q: string = `?list-type=2&prefix=${encodeURIComponent(prefix)}${token ? `&continuation-token=${encodeURIComponent(token)}` : ''}`
    const xml: string = await (await fetch(`${OVERTURE_BASE}/${q}`)).text()
    keys.push(...[...xml.matchAll(/<Key>([^<]*)<\/Key>/g)].map((m) => m[1]))
    token = xml.match(/<NextContinuationToken>([^<]*)</)?.[1] ?? null
  } while (token)
  return keys.filter((k) => k.endsWith('.parquet'))
}

/** Reintenta una descarga cortada (el proxy a veces cierra la conexión), con espera creciente. */
async function retry<T>(f: () => Promise<T>, tries = 5): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await f()
    } catch (err) {
      if (i >= tries - 1) throw err
      await new Promise((r) => setTimeout(r, 2000 * 2 ** i))
    }
  }
}

/** Filas de Overture dentro del bbox, usando las estadísticas de cada bloque para no bajar el resto. */
async function overtureRows(theme: string, type: string, bbox: BBox, columns: string[], keep: (r: Row) => boolean): Promise<Row[]> {
  const [w, s, e, n] = bbox
  const keys = await s3List(`${OVERTURE_RELEASE}/theme=${theme}/type=${type}/`)
  const rows: Row[] = []
  let next = 0
  let groups = 0
  const worker = async () => {
    while (next < keys.length) {
      const url = `${OVERTURE_BASE}/${keys[next++]}`
      const file = await retry(() => asyncBufferFromUrl({ url }))
      const metadata = await retry(() => parquetMetadataAsync(file))
      let start = 0
      for (const rg of metadata.row_groups) {
        const count = Number(rg.num_rows)
        const stat = (name: string) => rg.columns.find((c) => c.meta_data?.path_in_schema.join('.') === `bbox.${name}`)?.meta_data?.statistics
        const hit = !(Number(stat('xmin')?.min_value) > e || Number(stat('xmax')?.max_value) < w || Number(stat('ymin')?.min_value) > n || Number(stat('ymax')?.max_value) < s)
        if (hit) {
          groups++
          const rowStart = start
          const part = (await retry(() => parquetReadObjects({ file, metadata, columns: [...columns, 'bbox', 'geometry'], rowStart, rowEnd: rowStart + count, compressors }))) as Row[]
          for (const r of part) if (r.bbox.xmin <= e && r.bbox.xmax >= w && r.bbox.ymin <= n && r.bbox.ymax >= s && keep(r)) rows.push(r)
        }
        start += count
      }
    }
  }
  await Promise.all(Array.from({ length: 4 }, worker))
  console.log(`overture ${theme}/${type}: ${rows.length} elementos (${groups} bloques leídos)`)
  return rows
}

/** Douglas-Peucker, en km. */
function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length <= 2) return pts
  const [a, b] = [pts[0], pts[pts.length - 1]]
  const len = Math.hypot(b[0] - a[0], b[1] - a[1])
  let worst = 0
  let idx = 0
  for (let i = 1; i < pts.length - 1; i++) {
    const p = pts[i]
    const d = len ? Math.abs((b[0] - a[0]) * (a[1] - p[1]) - (a[0] - p[0]) * (b[1] - a[1])) / len : Math.hypot(p[0] - a[0], p[1] - a[1])
    if (d > worst) [worst, idx] = [d, i]
  }
  if (worst <= tol) return [a, b]
  return [...simplify(pts.slice(0, idx + 1), tol).slice(0, -1), ...simplify(pts.slice(idx), tol)]
}

function polygons(g: Geometry): number[][][][] {
  if (g.type === 'Polygon') return [g.coordinates as number[][][]]
  if (g.type === 'MultiPolygon') return g.coordinates as number[][][][]
  return []
}

function lines(g: Geometry): number[][][] {
  if (g.type === 'LineString') return [g.coordinates as number[][]]
  if (g.type === 'MultiLineString') return g.coordinates as number[][][]
  return []
}

const primaryName = (r: Row) => ((r.names as { primary?: string } | null)?.primary ?? null) as string | null

/** Número de ruta nacional, si el tramo lo tiene ("5", "1", "Interbalnearia"...). */
function routeRef(r: Row): string | null {
  const routes = r.routes as { ref?: string; name?: string; network?: string }[] | null
  const ref = routes?.find((x) => x.ref)?.ref ?? null
  if (ref) return ref
  const name = primaryName(r)
  const m = name?.match(/Ruta\s+(?:Nacional\s+)?(?:N[º°o.]\s*)?(\d+)/i)
  return m ? m[1] : null
}

async function main() {
  // División política: país y departamentos.
  const areas = await overtureRows('divisions', 'division_area', UY, ['subtype', 'country', 'names', 'class'], (r) => r.country === 'UY' && (r.subtype === 'country' || r.subtype === 'region'))
  const ring = (poly: number[][][], tol: number) => simplify(poly[0].map(km), tol).map(round)
  const country = areas.filter((a) => a.subtype === 'country' && (a.class ?? 'land') === 'land').flatMap((a) => polygons(a.geometry).map((p) => ring(p, 0.4)))
  const departments = areas
    .filter((a) => a.subtype === 'region' && (a.class ?? 'land') === 'land')
    .flatMap((a) => polygons(a.geometry).map((p) => ({ name: primaryName(a), ring: ring(p, 0.6) })))
    .filter((d) => d.ring.length > 3)

  // Rutas: tramos de las categorías principales, con la geometría completa para el grafo.
  const keep = new Set(['motorway', 'trunk', 'primary', 'secondary'])
  const segs = await overtureRows('transportation', 'segment', UY, ['subtype', 'class', 'names', 'routes'], (r) => r.subtype === 'road' && keep.has(r.class as string))

  // Grafo con un nodo por vértice (los cruces comparten coordenadas en OpenStreetMap).
  const id = new Map<string, number>()
  const nodes: [number, number][] = []
  const adj: [number, number][][] = []
  const node = (p: number[]) => {
    const k = `${p[0].toFixed(6)},${p[1].toFixed(6)}`
    let i = id.get(k)
    if (i === undefined) {
      id.set(k, (i = nodes.length))
      nodes.push(km(p))
      adj.push([])
    }
    return i
  }
  const roads: { class: string; ref: string | null; pts: [number, number][] }[] = []
  for (const r of segs)
    for (const ln of lines(r.geometry)) {
      for (let i = 1; i < ln.length; i++) {
        const a = node(ln[i - 1])
        const b = node(ln[i])
        const d = Math.hypot(nodes[a][0] - nodes[b][0], nodes[a][1] - nodes[b][1])
        adj[a].push([b, d])
        adj[b].push([a, d])
      }
      // Para dibujar alcanzan las rutas principales; las secundarias solo cuentan para el grafo.
      if (r.class !== 'secondary') roads.push({ class: r.class as string, ref: routeRef(r), pts: simplify(ln.map(km), 0.3).map(round) })
    }
  console.log(`grafo: ${nodes.length} nodos`)

  // Nodo más cercano a un punto, entre los que tienen conexiones (para no caer en un tramo suelto).
  const nearest = (p: [number, number]) => {
    let best = -1
    let bd = Infinity
    for (let i = 0; i < nodes.length; i++) {
      if (adj[i].length < 1) continue
      const d = Math.hypot(nodes[i][0] - p[0], nodes[i][1] - p[1])
      if (d < bd) [best, bd] = [i, d]
    }
    return best
  }

  // Dijkstra desde la nave.
  const start = nearest(km(DEPOT.at))
  const dist = new Float64Array(nodes.length).fill(Infinity)
  const prev = new Int32Array(nodes.length).fill(-1)
  dist[start] = 0
  const heap: [number, number][] = [[0, start]]
  const push = (x: [number, number]) => {
    heap.push(x)
    let i = heap.length - 1
    while (i > 0) {
      const p = (i - 1) >> 1
      if (heap[p][0] <= heap[i][0]) break
      ;[heap[p], heap[i]] = [heap[i], heap[p]]
      i = p
    }
  }
  const pop = () => {
    const top = heap[0]
    const last = heap.pop()!
    if (heap.length) {
      heap[0] = last
      let i = 0
      for (;;) {
        const l = 2 * i + 1
        const r = l + 1
        let m = i
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r
        if (m === i) break
        ;[heap[m], heap[i]] = [heap[i], heap[m]]
        i = m
      }
    }
    return top
  }
  while (heap.length) {
    const [d, u] = pop()
    if (d > dist[u]) continue
    for (const [v, w] of adj[u])
      if (d + w < dist[v]) {
        dist[v] = d + w
        prev[v] = u
        push([dist[v], v])
      }
  }

  const routes = CLIENTS.map((c) => {
    const end = nearest(km(c.at))
    const path: [number, number][] = []
    for (let u = end; u >= 0; u = prev[u]) path.push(nodes[u])
    path.reverse()
    // Tramo final en línea recta desde la ruta hasta el punto de entrega.
    const access = Math.hypot(nodes[end][0] - km(c.at)[0], nodes[end][1] - km(c.at)[1])
    const total = dist[end] + access + Math.hypot(nodes[start][0] - km(DEPOT.at)[0], nodes[start][1] - km(DEPOT.at)[1])
    console.log(`${c.name.padEnd(24)} ${total.toFixed(0).padStart(4)} km (tabla: ${c.km})`)
    return { key: c.key, km: Math.round(total), path: simplify([km(DEPOT.at), ...path, km(c.at)], 0.05).map(round) }
  })

  const out = {
    source: 'Overture Maps (incluye datos de OpenStreetMap, ODbL)',
    center: CENTER,
    kmPerDegree: [KX, KY],
    depot: round(km(DEPOT.at)),
    cities: CLIENTS.map((c) => ({ key: c.key, name: c.name, at: round(km(c.at)) })),
    country,
    departments,
    roads,
    routes,
  }
  mkdirSync(join(ROOT, 'public', 'geo'), { recursive: true })
  const file = join(ROOT, 'public', 'geo', 'uruguay.json')
  writeFileSync(file, JSON.stringify(out))
  console.log(`listo: ${file} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB, ${roads.length} tramos, ${departments.length} departamentos)`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
