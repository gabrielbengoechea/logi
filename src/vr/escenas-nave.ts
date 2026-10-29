// Menú del visor para el centro de distribución: reloj de la simulación, escenas guiadas (recepción, almacenaje,
// preparación de pedidos, despacho, fin de turno), lugares y opciones. Cada escena busca en el horario de andenes
// del día un camión que vaya a hacer lo que se quiere mostrar y adelanta el reloj hasta unos minutos antes.
import * as THREE from 'three'
import { dockSchedule, openHours, type Visit } from '../scene/Docks'
import { CLIENTS } from '../sim/clients'
import { weekdayName } from '../sim/engine'
import { DOCKS, HALL, RACK, STAGING, aisleX } from '../sim/warehouse'
import { dayOf, useStore } from '../store'
import type { ConfigMenu, EscenaGuiada, Lugar, Tiempo } from './escenas'

const st = () => useStore.getState()
const fin = () => st().run.days.length * 24
const PATIO = -HALL.dockHeight
const HW = HALL.width / 2

/** Yaw (0 = -Z) para mirar desde `de` hacia `a`. */
const yawHacia = (de: THREE.Vector3, a: THREE.Vector3) => Math.atan2(-(a.x - de.x), -(a.z - de.z))

function lugar(titulo: string, pos: THREE.Vector3, mira: THREE.Vector3, resumen?: string, alto = false): Lugar {
  return { titulo, resumen, pos, yaw: yawHacia(pos, mira), alto }
}

const UN_MIN_POR_S = 1 / 60

function irAlMomento(t: number, velocidad: number) {
  const s = st()
  s.setT(THREE.MathUtils.clamp(t, 0, fin() - 0.01))
  s.setSpeed(velocidad)
  if (!s.playing) s.togglePlay()
}

/** Próxima visita a los andenes (desde el instante actual) que cumpla la condición, con su día. */
function proximaVisita(cond: (v: Visit) => boolean): { dia: number; v: Visit } | null {
  const { run, decisions, t } = st()
  const hoy = dayOf(t)
  for (let d = hoy; d < Math.min(run.days.length, hoy + 14); d++) {
    const visitas = dockSchedule(run.days[d], decisions)
      .filter(cond)
      .sort((a, b) => a.start - b.start)
    const v = visitas.find((x) => d * 24 + x.start > t + 0.1) ?? (d > hoy ? visitas[0] : undefined)
    if (v) return { dia: d, v }
  }
  return null
}

let visita: { dia: number; v: Visit } | null = null

const enAnden = (dock: number, y: number, z: number) => new THREE.Vector3(DOCKS[dock].x, y, z)

// ---------- Escenas ----------

const recepcion: EscenaGuiada = {
  id: 'recepcion',
  titulo: 'Recepción en andenes',
  resumen: 'Un camión de proveedor descarga en la playa',
  preparar() {
    visita = proximaVisita((v) => v.inbound)
    if (!visita) return LUGARES.playa
    const { dia, v } = visita
    // 6 minutos antes de que el camión entre marcha atrás a la puerta.
    irAlMomento(dia * 24 + v.start - 0.35, UN_MIN_POR_S)
    // Dentro de la nave, en la playa de recepción, mirando a la puerta del andén.
    return lugar('Playa de recepción', enAnden(v.dock, 0, STAGING.z0 + 2).add(new THREE.Vector3(4, 0, 0)), enAnden(v.dock, 1.5, HW))
  },
  pasos: [
    {
      titulo: 'Llega el camión',
      get texto() {
        const v = visita?.v
        return `Por la puerta ${v ? v.dock + 1 : ''} va a entrar marcha atrás un semirremolque de un proveedor${v ? ` con ${v.pallets} pallets` : ''}. Las 4 puertas de la izquierda son de recepción; las otras 6, de despacho. El reloj corre a 1 minuto por segundo.`
      },
    },
    {
      titulo: 'La rampa niveladora',
      texto: 'El piso de la nave está 1,2 m más alto que el patio, justo a la altura de la caja del camión. Así el autoelevador entra y sale de la caja sin rampas largas: la niveladora del andén salva la diferencia que queda.',
    },
    {
      titulo: 'Descarga y control',
      texto: 'Los pallets se bajan a la playa de recepción, frente a la puerta. Ahí se controlan contra la orden de compra: producto, cantidad, lote y estado. Recién después pasan al stock disponible.',
      al() {
        if (visita) irAlMomento(visita.dia * 24 + visita.v.start + 0.3, UN_MIN_POR_S)
      },
    },
    {
      titulo: 'Ubicación en la estantería',
      texto: 'Los autoelevadores llevan cada pallet a su posición. Los productos de más movimiento (clase A) van más cerca de los andenes y en los niveles bajos, para que los viajes de preparación sean cortos.',
    },
  ],
}

const almacenaje: EscenaGuiada = {
  id: 'almacenaje',
  titulo: 'Almacenaje en altura',
  resumen: 'Estanterías selectivas, pasillos y niveles',
  preparar() {
    const { decisions, t } = st()
    const [abre] = openHours(decisions.shifts)
    const h = t % 24
    if (h < abre + 1 || h > abre + 6) irAlMomento(Math.floor(t / 24) * 24 + abre + 2, UN_MIN_POR_S)
    const x = aisleX(5)
    // Al principio de un pasillo, mirando hacia el fondo de la nave.
    return lugar('Cabecera del pasillo 6', new THREE.Vector3(x, 0, RACK.front + 1), new THREE.Vector3(x, 1.6, -30))
  },
  pasos: [
    {
      titulo: 'Estantería selectiva',
      texto: `Estás en la cabecera de un pasillo. Cada fila doble tiene dos caras espalda con espalda, ${RACK.bays} módulos de largo y ${RACK.levels} niveles. Cualquier pallet se puede sacar sin mover otro: por eso se llama selectiva.`,
    },
    {
      titulo: 'El pasillo',
      texto: `El pasillo mide ${RACK.aisle.toFixed(1).replace('.', ',')} m: lo justo para que un autoelevador retráctil gire y meta las horquillas en la estantería. Pasillos más angostos dan más posiciones pero piden máquinas especiales.`,
    },
    {
      titulo: 'Desde arriba',
      texto: 'Desde esta plataforma se ven las filas, los pasillos y la playa de andenes. La distancia de cada posición a los andenes decide cuánto tarda cada viaje: de eso trata el slotting.',
      lugar: { titulo: 'Sobre la playa', pos: new THREE.Vector3(-10, 6.5, STAGING.z0 + 4), yaw: 0, alto: true },
    },
  ],
}

const despacho: EscenaGuiada = {
  id: 'despacho',
  titulo: 'Despacho a un cliente',
  resumen: 'Pedido armado, carga y salida del camión',
  preparar() {
    visita = proximaVisita((v) => !v.inbound)
    if (!visita) return LUGARES.playa
    const { dia, v } = visita
    irAlMomento(dia * 24 + v.start - 0.3, UN_MIN_POR_S)
    return lugar('Playa de despacho', enAnden(v.dock, 0, STAGING.z0 + 2).add(new THREE.Vector3(-4, 0, 0)), enAnden(v.dock, 1.5, HW))
  },
  pasos: [
    {
      titulo: 'El pedido espera armado',
      get texto() {
        const v = visita?.v
        const cliente = v && v.client >= 0 ? CLIENTS[v.client]?.name : undefined
        return `Frente a la puerta ${v ? v.dock + 1 : ''} esperan los pallets del pedido${cliente ? ` de ${cliente}` : ''}${v ? `: ${v.pallets} pallets` : ''}. Se prepararon antes, durante el picking, para que el camión no espere.`
      },
    },
    {
      titulo: 'Flota propia o contratada',
      get texto() {
        const v = visita?.v
        return `${v ? (v.own ? 'Este camión es de la flota propia (cabina azul con franja).' : 'Este camión es de un transportista contratado.') : ''} Con flota propia el costo es fijo aunque el camión no salga lleno; contratando se paga por viaje. Esa decisión la tomás en el simulador.`
      },
    },
    {
      titulo: 'Carga',
      texto: 'Los autoelevadores entran a la caja y acomodan los pallets del fondo hacia la puerta. Se carga en el orden inverso al de las entregas: lo que se baja primero va al final.',
      al() {
        if (visita) irAlMomento(visita.dia * 24 + visita.v.start + 0.5, UN_MIN_POR_S)
      },
    },
    {
      titulo: 'Sale a la ruta',
      texto: 'Con la carga lista y los papeles controlados, el camión sale del andén hacia la Ruta 5. Te llevamos al patio para verlo irse.',
      al(ctx) {
        if (!visita) return
        irAlMomento(visita.dia * 24 + visita.v.end - 0.05, UN_MIN_POR_S)
        ctx.irA(lugar('Patio de maniobras', new THREE.Vector3(DOCKS[visita.v.dock].x + 12, PATIO, HW + 26), enAnden(visita.v.dock, 0, HW + 4)))
      },
    },
  ],
}

const turno: EscenaGuiada = {
  id: 'turno',
  titulo: 'Fin del turno',
  resumen: 'Los autoelevadores van a cargar baterías',
  preparar() {
    const { decisions, t } = st()
    const [, cierra] = openHours(decisions.shifts)
    let d = dayOf(t)
    // Un día hábil con cierre (con 3 turnos la nave no cierra: se usa el sábado).
    while (d < st().run.days.length - 1 && st().run.days[d].weekday >= 5) d++
    const momento = cierra >= 24 ? d * 24 + 24 * (5 - st().run.days[d].weekday) + 0.1 : d * 24 + cierra - 0.2
    irAlMomento(momento, UN_MIN_POR_S)
    return lugar('Sala de carga', new THREE.Vector3(-45, 0, -8), new THREE.Vector3(-60, 1, -8))
  },
  pasos: [
    {
      titulo: 'Termina el turno',
      get texto() {
        const [abre, cierra] = openHours(st().decisions.shifts)
        return cierra >= 24 ? 'Con tres turnos la nave trabaja las 24 horas; los autoelevadores cargan baterías el fin de semana.' : `La nave trabaja de ${abre} a ${cierra} h. A la hora de cierre, cada autoelevador vuelve a su lugar contra la pared oeste para cargar la batería.`
      },
    },
    {
      titulo: 'Capacidad',
      texto: 'Las horas de trabajo y la cantidad de autoelevadores fijan cuántos pallets se pueden mover por día. Si no alcanzan, los pedidos se atrasan: en el simulador lo ves como pedidos pendientes.',
    },
    {
      titulo: 'Al día siguiente',
      texto: 'Usá el menú (gatillo izquierdo) para saltar al día siguiente y ver cómo vuelven a trabajar, o cambiá la velocidad del reloj.',
    },
  ],
}

// ---------- Lugares ----------

const LUGARES = {
  inicio: lugar('Pasillo peatonal (inicio)', new THREE.Vector3(-34, 0, 24), new THREE.Vector3(10, 1.6, 24), 'Entre las estanterías y la playa'),
  playa: lugar('Playa de andenes', new THREE.Vector3(0, 0, STAGING.z0 + 3), new THREE.Vector3(0, 1.6, HW), 'Frente a las puertas'),
}

function listaLugares(): Lugar[] {
  return [
    LUGARES.inicio,
    LUGARES.playa,
    lugar('Pasillo central', new THREE.Vector3(aisleX(6), 0, 0), new THREE.Vector3(aisleX(6), 1.6, -30), 'Entre las estanterías'),
    { titulo: 'Mirador de la nave', resumen: 'Sobre la playa, a 6,5 m', pos: new THREE.Vector3(-10, 6.5, STAGING.z0 + 4), yaw: 0, alto: true },
    lugar('Sala de carga de baterías', new THREE.Vector3(-45, 0, -8), new THREE.Vector3(-60, 1, -8), 'Pared oeste'),
    lugar('Patio de camiones', new THREE.Vector3(0, PATIO, HW + 30), new THREE.Vector3(0, 0, HW), 'Frente a los andenes, afuera'),
    { titulo: 'Sobre el patio', resumen: 'Plataforma a 8 m frente a la fachada', pos: new THREE.Vector3(10, 8, HW + 34), yaw: 0, alto: true },
  ]
}

// ---------- Tiempo ----------

const tiempoNave: Tiempo = {
  reloj() {
    const t = st().t
    const d = dayOf(t)
    const m = Math.floor((t - d * 24) * 60)
    const dia = st().run.days[d]
    return `${weekdayName(dia?.weekday ?? d)} ${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
  },
  detalle() {
    const { t, run, decisions } = st()
    const d = dayOf(t)
    const dia = run.days[d]
    const [abre, cierra] = openHours(decisions.shifts)
    const h = t - d * 24
    const abierta = dia && dia.weekday < 5 && h >= abre && h < cierra
    return `Día ${d + 1} de ${run.days.length} · ${abierta ? 'nave trabajando' : 'nave cerrada'}${dia ? ` · entran ${dia.palletsIn} y salen ${dia.palletsOut} pallets` : ''}`
  },
  pausado: () => !st().playing,
  alternarPausa: () => st().togglePlay(),
  velocidades: [
    { etiqueta: 'Real', valor: 1 / 3600 },
    { etiqueta: '1 min/s', valor: UN_MIN_POR_S },
    { etiqueta: '10 min/s', valor: 1 / 6 },
    { etiqueta: '1 h/s', valor: 1 },
    { etiqueta: '1 día/s', valor: 24 },
  ],
  velocidad: () => st().speed,
  fijarVelocidad: (v) => st().setSpeed(v),
  saltos: [
    { etiqueta: '−1 h', horas: -1 },
    { etiqueta: '+15 min', horas: 0.25 },
    { etiqueta: '+1 h', horas: 1 },
    { etiqueta: '+1 día', horas: 24 },
  ],
  saltar: (h) => st().setT(st().t + h),
}

export function menuNave(): ConfigMenu {
  return {
    tiempo: tiempoNave,
    escenas: [recepcion, almacenaje, despacho, turno],
    get lugares() {
      return listaLugares()
    },
    opciones: [
      {
        id: 'color',
        texto: () => `Color de pallets: ${st().colorMode === 'abc' ? 'clase ABC' : 'familia'}`,
        accion: () => st().setColorMode(st().colorMode === 'abc' ? 'familia' : 'abc'),
      },
      {
        id: 'dianoche',
        texto: () => `Luz según la hora: ${st().dayNight ? 'sí' : 'no'}`,
        activa: () => st().dayNight,
        accion: () => st().setDayNight(!st().dayNight),
      },
    ],
  }
}

export { tiempoNave }
