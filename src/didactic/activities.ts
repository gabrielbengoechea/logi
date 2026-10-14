import { BASE_DECISIONS, BASE_SCENARIO, type Decisions, type Policy, type Scenario } from '../sim/engine'
import type { Summary } from '../sim/summary'

/**
 * Actividades de clase, una por tema del curso. Cada una cambia una sola cosa respecto de la operación base, se
 * predice qué va a pasar y se simula un año. La opción correcta la decide la simulación (`holds`), no está escrita
 * de antemano: con otra demanda los números cambian, la conclusión no.
 */
export interface Option {
  label: string
  holds: (base: Summary, alt: Summary) => boolean
}

export interface Activity {
  key: string
  title: string
  /** Unidad del curso que trabaja. */
  unit: string
  context: string
  question: string
  options: Option[]
  change: (d: Decisions, s: Scenario) => [Decisions, Scenario]
  explain: (base: Summary, alt: Summary) => string
  takeaway: string
  discuss: string[]
}

const allClasses = (d: Decisions, f: (p: Policy) => Policy): Decisions => ({ ...d, policy: { A: f(d.policy.A), B: f(d.policy.B), C: f(d.policy.C) } })
const pct = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`
const usdK = (x: number) => `USD ${Math.round(x / 1000).toLocaleString('es-UY')} mil`
const ratio = (a: number, b: number) => a / b
const stock = (s: Summary) => s.stockValueAvg

export const ACTIVITIES: Activity[] = [
  {
    key: 'costo-pedir',
    title: 'Pedir más barato',
    unit: 'Lote Económico de Compra',
    context:
      'Un sistema nuevo de compras baja el costo de emitir una orden (S): de USD 60 a 15 con proveedores locales y de USD 250 a 60 en importaciones. Todo lo demás queda igual.',
    question: 'Con Q* = √(2·D·S/H), ¿qué pasa con las órdenes de compra y con el stock?',
    options: [
      { label: 'Más órdenes y menos stock', holds: (b, a) => a.purchaseOrders > b.purchaseOrders && stock(a) < stock(b) },
      { label: 'Menos órdenes y más stock', holds: (b, a) => a.purchaseOrders < b.purchaseOrders && stock(a) > stock(b) },
      { label: 'Las mismas órdenes; solo baja el costo', holds: (b, a) => Math.abs(a.purchaseOrders - b.purchaseOrders) / b.purchaseOrders < 0.05 },
    ],
    change: (d, s) => [d, { ...s, tariffs: { ...s.tariffs, orderLocal: 15, orderImport: 60 } }],
    explain: (b, a) =>
      `Las órdenes pasaron de ${b.purchaseOrders.toLocaleString('es-UY')} a ${a.purchaseOrders.toLocaleString('es-UY')} (+${Math.round((a.purchaseOrders / b.purchaseOrders - 1) * 100)} %) y el stock promedio de ${usdK(stock(b))} a ${usdK(stock(a))}. Q* = √(2·D·S/H) depende de la raíz de S: con S unas cuatro veces menor, el lote de cada producto de las clases A y B baja casi a la mitad. Las órdenes suben menos porque la clase C está en revisión periódica (R no depende de S) y porque varios productos del mismo proveedor viajan en una misma orden.`,
    takeaway: 'Q* crece con la raíz de S: abaratar el pedido permite lotes más chicos y menos stock de ciclo.',
    discuss: ['¿Por qué Q* no baja a la cuarta parte?', '¿Qué otro costo sube cuando se piden lotes chicos (recepción, transporte)?'],
  },
  {
    key: 'nivel-servicio',
    title: 'Del 95 % al 99,5 %',
    unit: 'Revisión Continua · nivel de servicio',
    context: 'La dirección pide que nunca falte nada. Se sube el nivel de servicio de ciclo (NSC) de todas las clases a 99,5 %.',
    question: 'Si el fill rate sube unos puntos, ¿cuánto crece el stock promedio?',
    options: [
      { label: 'Más o menos lo mismo que el fill rate (unos puntos)', holds: (b, a) => ratio(stock(a), stock(b)) - 1 < (a.fill - b.fill) * 3 },
      { label: 'Mucho más que lo que mejora el fill rate', holds: (b, a) => ratio(stock(a), stock(b)) - 1 >= (a.fill - b.fill) * 3 },
      { label: 'No cambia: el stock depende del lote, no del servicio', holds: (b, a) => Math.abs(ratio(stock(a), stock(b)) - 1) < 0.01 },
    ],
    change: (d, s) => [allClasses(d, (p) => ({ ...p, criterion: { kind: 'nsc', nsc: 0.995 } })), s],
    explain: (b, a) =>
      `El fill rate pasó de ${pct(b.fill)} a ${pct(a.fill)} (+${((a.fill - b.fill) * 100).toFixed(1).replace('.', ',')} puntos) y el stock promedio de ${usdK(stock(b))} a ${usdK(stock(a))} (+${((ratio(stock(a), stock(b)) - 1) * 100).toFixed(0)} %). El stock de seguridad es k·σc y k crece cada vez más rápido al acercarse al 100 %: pasa de 2,05 (A, 98 %), 1,64 (B, 95 %) y 1,28 (C, 90 %) a 2,58 (99,5 %).`,
    takeaway: 'A mayor nivel de servicio, el inventario crece de forma cuasi exponencial: los últimos puntos son los más caros.',
    discuss: ['¿Conviene el mismo nivel de servicio para A, B y C?', '¿Qué productos justifican un 99,5 %?'],
  },
  {
    key: 'periodica',
    title: 'Revisar una vez cada dos semanas',
    unit: 'Revisión Periódica',
    context: 'Para ordenar el trabajo de compras, todos los productos pasan de revisión continua a revisión periódica cada R = 14 días, con el mismo NSC.',
    question: 'Con el mismo nivel de servicio, ¿qué pasa con el stock?',
    options: [
      { label: 'Baja: se pide menos seguido', holds: (b, a) => stock(a) < stock(b) },
      { label: 'Sube: hay que protegerse durante LT + R', holds: (b, a) => stock(a) > stock(b) },
    ],
    change: (d, s) => [allClasses(d, (p) => ({ ...p, model: 'periodica', R: 14 })), s],
    explain: (b, a) =>
      `El stock promedio pasó de ${usdK(stock(b))} a ${usdK(stock(a))} y las órdenes de ${b.purchaseOrders.toLocaleString('es-UY')} a ${a.purchaseOrders.toLocaleString('es-UY')}. En revisión periódica σc = √(σd²·(LT + R) + d²·σLT²): el stock de seguridad cubre también el período de revisión, y el pedido medio pasa a ser D_R = d·R.`,
    takeaway: 'La revisión periódica es más simple de operar, pero pide más stock de seguridad que la continua.',
    discuss: ['¿Para qué productos conviene igual la revisión periódica?', '¿Qué pasa si R baja a 7 días?'],
  },
  {
    key: 'can-order',
    title: 'Pedir junto con el mismo proveedor',
    unit: 'Can-Order',
    context: 'Se pasa a can-order: cuando un producto llega a su ROP, se emite la orden y se suman los otros del mismo proveedor que están bajo su COP.',
    question: '¿Qué pasa con la cantidad de órdenes de compra y con el costo de pedir?',
    options: [
      { label: 'Más o menos las mismas órdenes', holds: (b, a) => a.purchaseOrders >= b.purchaseOrders * 0.8 && a.purchaseOrders <= b.purchaseOrders * 1.2 },
      { label: 'Muchas menos órdenes y menor costo de pedir', holds: (b, a) => a.purchaseOrders < b.purchaseOrders * 0.8 && a.costs.ordering < b.costs.ordering },
      { label: 'Más órdenes: cada producto se pide antes', holds: (b, a) => a.purchaseOrders > b.purchaseOrders * 1.2 },
    ],
    change: (d, s) => [allClasses(d, (p) => ({ ...p, model: 'canorder' })), s],
    explain: (b, a) =>
      `Las órdenes pasaron de ${b.purchaseOrders.toLocaleString('es-UY')} a ${a.purchaseOrders.toLocaleString('es-UY')} y el costo de pedir de ${usdK(b.costs.ordering)} a ${usdK(a.costs.ordering)}. El stock promedio cambió de ${usdK(stock(b))} a ${usdK(stock(a))}: los productos que se suman piden antes de llegar a su ROP (hasta COP = ROP + d·S_ahorrado/(H_t·Q)).`,
    takeaway: 'Coordinar la reposición de varios artículos del mismo proveedor ahorra costo de pedir a cambio de algo más de stock.',
    discuss: ['¿De qué depende el ancho de la banda entre ROP y COP?', '¿Qué otras ventajas tiene juntar pedidos (fletes, recepción)?'],
  },
  {
    key: 'lead-time',
    title: 'El puerto se atrasa',
    unit: 'Revisión Continua · lead time',
    context: 'Una congestión en el puerto de Montevideo hace que las importaciones demoren un 50 % más, y con más variación.',
    question: '¿Qué pasa con el fill rate y con el stock?',
    options: [
      { label: 'No cambia nada: el ROP se recalcula solo', holds: (b, a) => Math.abs(a.fill - b.fill) < 0.002 },
      { label: 'Sube el fill rate porque hay más stock', holds: (b, a) => a.fill > b.fill + 0.002 },
      { label: 'Baja el fill rate aunque sube el stock', holds: (b, a) => a.fill < b.fill && stock(a) > stock(b) },
    ],
    change: (d, s) => [d, { ...s, importDelay: 1.5 }],
    explain: (b, a) =>
      `El fill rate pasó de ${pct(b.fill)} a ${pct(a.fill)} y el stock promedio de ${usdK(stock(b))} a ${usdK(stock(a))}. Con un LT más largo crecen d·LT y σc = √(σd²·LT + d²·σLT²); el ROP sube, pero la transición (pedidos que ya estaban en camino) y la mayor variación dejan huecos.`,
    takeaway: 'El lead time y su variación pesan tanto como la demanda: un proveedor lento o irregular cuesta stock y servicio.',
    discuss: ['¿Qué parte del lead time se puede acortar (las etapas del ejemplo del arroz)?', '¿Conviene cambiar de proveedor aunque sea más caro?'],
  },
]

export const ACTIVITY_DECISIONS = BASE_DECISIONS
export const ACTIVITY_SCENARIO = BASE_SCENARIO

/** Opción correcta: la que se cumple con los resultados simulados (si se cumplieran varias, la primera). */
export const correctOption = (a: Activity, base: Summary, alt: Summary) => a.options.findIndex((o) => o.holds(base, alt))
