import { BASE_SCENARIO } from '../sim/engine'

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'set', 'oct', 'nov', 'dic']
const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Fecha del día simulado (0 = lunes 1 de marzo de 2027). */
export function dateOf(day: number, startDayOfYear = BASE_SCENARIO.startDayOfYear) {
  const d = new Date(Date.UTC(2027, 0, 1 + startDayOfYear + day))
  return { weekday: WEEKDAYS[day % 7], day: d.getUTCDate(), month: MONTHS[d.getUTCMonth()] }
}

export function dateLabel(day: number) {
  const d = dateOf(day)
  return `${d.weekday} ${d.day} ${d.month}`
}

export const hhmm = (t: number) => {
  const m = Math.floor((((t % 24) + 24) % 24) * 60)
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
}

export const pct = (x: number) => `${Math.round(x * 100)} %`
export const pct1 = (x: number) => `${(x * 100).toFixed(1).replace('.', ',')} %`

/** Números con separador de miles uruguayo. */
export const int = (x: number) => Math.round(x).toLocaleString('es-UY')

/** Dólares: abreviados por encima de los diez mil. */
export function usd(x: number) {
  const a = Math.abs(x)
  if (a >= 1e6) return `USD ${(x / 1e6).toFixed(2).replace('.', ',')} M`
  if (a >= 1e4) return `USD ${Math.round(x / 1000).toLocaleString('es-UY')} mil`
  return `USD ${Math.round(x).toLocaleString('es-UY')}`
}

export const money2 = (x: number) => `USD ${x.toFixed(2).replace('.', ',')}`
