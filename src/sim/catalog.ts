import { mulberry32 } from './rng'

export type FamilyKey = 'bebidas' | 'almacen' | 'limpieza' | 'higiene' | 'bazar' | 'ferreteria' | 'electro' | 'juguetes'

export interface Family {
  key: FamilyKey
  label: string
  /** Color de los pallets de la familia en la nave. */
  color: string
  /** Parte del catálogo que ocupa la familia. */
  share: number
  /** Costo unitario [mín, máx] en USD. */
  cost: [number, number]
  /** Margen bruto sobre el precio de venta (de mayorista, no de comercio minorista). */
  margin: number
  unitsPerCase: [number, number]
  casesPerPallet: [number, number]
  /** Probabilidad de que un producto de la familia sea importado. */
  importShare: number
  /** Variabilidad de la demanda diaria del producto (coeficiente de variación) [mín, máx]. */
  cv: [number, number]
  /** Demanda relativa por mes (enero a diciembre). */
  season: number[]
  /** Nombres de base; cada producto es una variante de uno de ellos. */
  names: string[]
  variants: string[]
}

export const FAMILIES: Family[] = [
  {
    key: 'bebidas',
    label: 'Bebidas',
    color: '#2f7de1',
    share: 0.16,
    cost: [0.5, 2.5],
    margin: 0.09,
    unitsPerCase: [6, 12],
    casesPerPallet: [60, 100],
    importShare: 0.05,
    cv: [0.3, 0.6],
    season: [1.4, 1.3, 1.1, 0.9, 0.8, 0.75, 0.75, 0.8, 0.9, 1.0, 1.15, 1.45],
    names: ['Agua mineral', 'Agua con gas', 'Refresco cola', 'Refresco naranja', 'Jugo de durazno', 'Bebida deportiva', 'Cerveza', 'Agua saborizada', 'Té frío', 'Soda'],
    variants: ['500 ml', '1,5 L', '2 L', '2,25 L', 'lata 354 ml', 'pack x6'],
  },
  {
    key: 'almacen',
    label: 'Almacén',
    color: '#e39a2b',
    share: 0.2,
    cost: [0.7, 4],
    margin: 0.1,
    unitsPerCase: [10, 24],
    casesPerPallet: [40, 80],
    importShare: 0.15,
    cv: [0.25, 0.5],
    season: [0.95, 0.95, 1.0, 1.05, 1.05, 1.1, 1.1, 1.05, 1.0, 0.95, 0.95, 1.05],
    names: ['Arroz', 'Fideos', 'Harina', 'Yerba', 'Azúcar', 'Aceite', 'Galletitas', 'Puré de tomate', 'Lentejas', 'Polenta', 'Café', 'Dulce de leche'],
    variants: ['500 g', '1 kg', '2 kg', 'tipo 0000', 'integral', 'familiar'],
  },
  {
    key: 'limpieza',
    label: 'Limpieza',
    color: '#29a39b',
    share: 0.14,
    cost: [0.9, 5],
    margin: 0.12,
    unitsPerCase: [6, 12],
    casesPerPallet: [40, 70],
    importShare: 0.2,
    cv: [0.25, 0.45],
    season: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1.05],
    names: ['Detergente', 'Lavandina', 'Jabón en polvo', 'Suavizante', 'Limpiador de pisos', 'Desengrasante', 'Esponjas', 'Bolsas de residuos', 'Limpiavidrios', 'Rejilla'],
    variants: ['500 ml', '1 L', '2 L', '3 kg', 'pack x3', 'repuesto'],
  },
  {
    key: 'higiene',
    label: 'Higiene personal',
    color: '#b05cc8',
    share: 0.14,
    cost: [1.2, 8],
    margin: 0.14,
    unitsPerCase: [12, 24],
    casesPerPallet: [30, 60],
    importShare: 0.3,
    cv: [0.25, 0.5],
    season: [1.05, 1.0, 0.95, 0.95, 0.95, 0.95, 0.95, 0.95, 1.0, 1.0, 1.05, 1.2],
    names: ['Champú', 'Acondicionador', 'Jabón de tocador', 'Pasta dental', 'Desodorante', 'Papel higiénico', 'Pañales', 'Protector solar', 'Algodón', 'Toallitas húmedas'],
    variants: ['200 ml', '400 ml', 'x4', 'x12', 'talle M', 'talle G'],
  },
  {
    key: 'bazar',
    label: 'Bazar',
    color: '#d9534f',
    share: 0.11,
    cost: [2, 15],
    margin: 0.18,
    unitsPerCase: [4, 12],
    casesPerPallet: [20, 50],
    importShare: 0.6,
    cv: [0.35, 0.7],
    season: [0.9, 0.85, 0.9, 0.95, 1.0, 0.95, 0.95, 1.0, 1.0, 1.05, 1.15, 1.4],
    names: ['Vasos', 'Platos', 'Sartén', 'Olla', 'Termo', 'Mate', 'Juego de cubiertos', 'Recipiente hermético', 'Tabla de picar', 'Fuente de horno'],
    variants: ['chico', 'mediano', 'grande', 'x6', 'acero', 'vidrio'],
  },
  {
    key: 'ferreteria',
    label: 'Ferretería',
    color: '#7a8591',
    share: 0.1,
    cost: [3, 25],
    margin: 0.17,
    unitsPerCase: [4, 10],
    casesPerPallet: [20, 40],
    importShare: 0.5,
    cv: [0.35, 0.65],
    season: [0.9, 0.9, 0.95, 0.95, 0.9, 0.85, 0.85, 0.95, 1.1, 1.2, 1.25, 1.2],
    names: ['Pintura látex', 'Rodillo', 'Pincel', 'Cinta aisladora', 'Tornillos', 'Taladro', 'Manguera', 'Candado', 'Silicona', 'Lija'],
    variants: ['1 L', '4 L', '20 L', 'x100', 'n.º 8', 'profesional'],
  },
  {
    key: 'electro',
    label: 'Pequeños electrodomésticos',
    color: '#b08a64',
    share: 0.07,
    cost: [15, 90],
    margin: 0.13,
    unitsPerCase: [1, 4],
    casesPerPallet: [12, 30],
    importShare: 0.9,
    cv: [0.4, 0.8],
    season: [0.85, 0.8, 0.85, 0.9, 1.0, 1.15, 1.05, 0.95, 0.95, 1.0, 1.1, 1.6],
    names: ['Licuadora', 'Pava eléctrica', 'Tostadora', 'Ventilador', 'Estufa', 'Plancha', 'Batidora', 'Secador de pelo', 'Cafetera', 'Aspiradora'],
    variants: ['básica', 'estándar', 'premium', '1,7 L', '1000 W', '2000 W'],
  },
  {
    key: 'juguetes',
    label: 'Juguetes',
    color: '#f2c12e',
    share: 0.08,
    cost: [4, 30],
    margin: 0.2,
    unitsPerCase: [2, 8],
    casesPerPallet: [15, 40],
    importShare: 0.85,
    cv: [0.45, 0.9],
    // Día del niño en agosto, Navidad y Reyes.
    season: [1.7, 0.6, 0.6, 0.65, 0.7, 0.7, 0.8, 1.4, 0.8, 0.8, 1.0, 2.6],
    names: ['Pelota', 'Muñeca', 'Autito', 'Rompecabezas', 'Bloques', 'Juego de mesa', 'Peluche', 'Bicicleta infantil', 'Masa para modelar', 'Pistola de agua'],
    variants: ['chico', 'grande', 'x500 piezas', 'n.º 5', 'deluxe', 'set'],
  },
]

export type AbcClass = 'A' | 'B' | 'C'

export interface Product {
  id: number
  /** Código de producto, como en una etiqueta: familia y número. */
  code: string
  name: string
  family: FamilyKey
  cost: number
  price: number
  unitsPerCase: number
  casesPerPallet: number
  unitsPerPallet: number
  imported: boolean
  /** Demora media de reposición en días corridos. */
  leadDays: number
  /** Demanda media diaria (todos los clientes juntos, todos los días de la semana), sin estacionalidad. */
  dailyDemand: number
  cv: number
  abc: AbcClass
}

const lerp = (r: () => number, [a, b]: [number, number]) => a + r() * (b - a)
const intIn = (r: () => number, [a, b]: [number, number]) => Math.floor(a + r() * (b - a + 1))

/**
 * Catálogo genérico generado con semilla. La popularidad sale de una lognormal, así pocos productos concentran la
 * mayor parte de las ventas (Pareto) y aparece la clasificación ABC. `palletsPerDay` fija el volumen total.
 */
export function generateCatalog(seed: number, count = 240, palletsPerDay = 180): Product[] {
  const r = mulberry32(seed * 7919 + 13)
  const products: Product[] = []
  const used = new Set<string>()
  for (const fam of FAMILIES) {
    const n = Math.round(count * fam.share)
    for (let i = 0; i < n; i++) {
      let name = ''
      for (let tries = 0; tries < 20 && (!name || used.has(name)); tries++)
        name = `${fam.names[Math.floor(r() * fam.names.length)]} ${fam.variants[Math.floor(r() * fam.variants.length)]}`
      if (used.has(name)) name = `${name} (${i + 1})`
      used.add(name)
      const cost = Math.round(lerp(r, fam.cost) * 100) / 100
      const unitsPerCase = intIn(r, fam.unitsPerCase)
      const casesPerPallet = intIn(r, fam.casesPerPallet)
      const imported = r() < fam.importShare
      // Popularidad lognormal (sigma 1,2): la escala se ajusta abajo.
      const z = Math.sqrt(-2 * Math.log(Math.max(r(), 1e-9))) * Math.cos(2 * Math.PI * r())
      products.push({
        id: products.length,
        code: `${fam.key.slice(0, 3).toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
        name,
        family: fam.key,
        cost,
        price: Math.round((cost / (1 - fam.margin)) * 100) / 100,
        unitsPerCase,
        casesPerPallet,
        unitsPerPallet: unitsPerCase * casesPerPallet,
        imported,
        leadDays: imported ? intIn(r, [35, 50]) : intIn(r, [3, 7]),
        dailyDemand: Math.exp(1.2 * z),
        cv: lerp(r, fam.cv),
        abc: 'C',
      })
    }
  }
  // Escala: el total en pallets por día queda en palletsPerDay.
  const pallets = products.reduce((s, p) => s + p.dailyDemand / p.unitsPerPallet, 0)
  for (const p of products) p.dailyDemand *= palletsPerDay / pallets
  classifyAbc(products)
  return products
}

/** Clase A: el 80 % del valor vendido; B: el 15 % siguiente; C: el resto. */
export function classifyAbc(products: Product[]) {
  const value = (p: Product) => p.dailyDemand * p.cost
  const total = products.reduce((s, p) => s + value(p), 0)
  let acc = 0
  for (const p of [...products].sort((a, b) => value(b) - value(a))) {
    acc += value(p)
    p.abc = acc - value(p) < total * 0.8 ? 'A' : acc - value(p) < total * 0.95 ? 'B' : 'C'
  }
}

/** Factor de estacionalidad de una familia en un día del año (interpolado entre la mitad de cada mes). */
export function seasonFactor(fam: Family, dayOfYear: number): number {
  const m = (dayOfYear / 365) * 12 - 0.5
  const i = Math.floor(m)
  const f = m - i
  const a = fam.season[((i % 12) + 12) % 12]
  const b = fam.season[(((i + 1) % 12) + 12) % 12]
  return a + (b - a) * f
}

export const familyOf = (key: FamilyKey) => FAMILIES.find((f) => f.key === key)!
