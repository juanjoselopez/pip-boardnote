/**
 * Suavizado de trazos mediante spline Catmull-Rom
 * Transforma puntos crudos en curvas suaves con tensión configurable
 */
import type { StrokePoint } from '../types/strokes'

export type SmoothLevel = 'off' | 'low' | 'medium' | 'high'

interface SmoothConfig {
  tension: number
  subdivisions: number
  minDistance: number
}

const SMOOTH_CONFIG: Record<SmoothLevel, SmoothConfig> = {
  off:    { tension: 0.0, subdivisions: 1,  minDistance: 0 },
  low:    { tension: 0.3, subdivisions: 6,  minDistance: 0.05 },
  medium: { tension: 0.5, subdivisions: 12, minDistance: 0.1 },
  high:   { tension: 0.75, subdivisions: 20, minDistance: 0.15 },
}

/**
 * Transforma puntos crudos en puntos suavizados mediante Catmull-Rom.
 * Pipeline: filterClosePoints → smoothPoints → interpolateCatmullRom
 * Los puntos originales NO se modifican.
 * @param points - Puntos del trazo en mm
 * @param level  - Nivel de suavizado
 */
export function smoothStrokePoints(points: StrokePoint[], level: SmoothLevel): StrokePoint[] {
  if (points.length < 2) return [...points]

  const config = SMOOTH_CONFIG[level]
  if (level === 'off') return points

  // Paso 1: eliminar puntos demasiado cercanos (jitter)
  let filtered = points
  if (config.minDistance > 0) {
    filtered = filterClosePoints(points, config.minDistance)
  }

  // Paso 2: suavizado gaussiano de ventana=3 para eliminar ruido de alta frecuencia
  if (filtered.length >= 3) {
    filtered = smoothPointsGaussian(filtered)
  }

  // Paso 3: interpolación Catmull-Rom con subdivisiones
  return interpolateCatmullRom(filtered, config.tension, config.subdivisions)
}

/**
 * Filtra puntos consecutivos demasiado cercanos para eliminar jitter
 */
function filterClosePoints(points: StrokePoint[], minDist: number): StrokePoint[] {
  if (points.length < 2) return [...points]

  const result: StrokePoint[] = [points[0]]
  const minDistSq = minDist * minDist

  for (let i = 1; i < points.length; i++) {
    const prev = result[result.length - 1]
    const curr = points[i]
    const dx = curr.x - prev.x
    const dy = curr.y - prev.y
    if (dx * dx + dy * dy >= minDistSq) {
      result.push(curr)
    }
  }

  return result
}

/**
 * Suavizado gaussiano de ventana 3: reemplaza cada punto por
 * (previo + 2*actual + siguiente) / 4
 * Preserva el primer y último punto exactos.
 * Reduce ruido de alta frecuencia del hardware de lápiz.
 */
function smoothPointsGaussian(points: StrokePoint[]): StrokePoint[] {
  const result: StrokePoint[] = [points[0]]
  for (let i = 1; i < points.length - 1; i++) {
    result.push({
      x: (points[i - 1].x + points[i].x * 2 + points[i + 1].x) / 4,
      y: (points[i - 1].y + points[i].y * 2 + points[i + 1].y) / 4,
      pressure: points[i].pressure,
    })
  }
  result.push(points[points.length - 1])
  return result
}

/**
 * Interpola puntos usando Catmull-Rom spline
 * Genera subdivisiones por segmento entre cada par de puntos consecutivos
 */
function interpolateCatmullRom(
  points: StrokePoint[],
  tension: number,
  subdivisions: number
): StrokePoint[] {
  if (points.length < 2) return [...points]

  const result: StrokePoint[] = []

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? points[i] : points[i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i === points.length - 2 ? points[i + 1] : points[i + 2]

    for (let j = 0; j < subdivisions; j++) {
      const t = j / subdivisions
      result.push(catmullRomPoint(p0, p1, p2, p3, t, tension))
    }
  }

  const last = points[points.length - 1]
  result.push({ x: last.x, y: last.y, pressure: last.pressure })

  return result
}

/**
 * Evalúa el spline Catmull-Rom en un punto t del segmento entre P1 y P2
 * Fórmula estándar con matriz de base:
 *   b0(t) = -τ·t³ + 2τ·t² - τ·t
 *   b1(t) = (2-τ)·t³ + (τ-3)·t² + 1
 *   b2(t) = (τ-2)·t³ + (3-2τ)·t² + τ·t
 *   b3(t) = τ·t³ - τ·t²
 *   P(t) = b0·P0 + b1·P1 + b2·P2 + b3·P3
 * La presión se interpola con la misma base.
 */
function catmullRomPoint(
  p0: StrokePoint,
  p1: StrokePoint,
  p2: StrokePoint,
  p3: StrokePoint,
  t: number,
  tension: number
): StrokePoint {
  const t2 = t * t
  const t3 = t2 * t

  const b0 = -tension * t3 + 2 * tension * t2 - tension * t
  const b1 = (2 - tension) * t3 + (tension - 3) * t2 + 1
  const b2 = (tension - 2) * t3 + (3 - 2 * tension) * t2 + tension * t
  const b3 = tension * t3 - tension * t2

  return {
    x: b0 * p0.x + b1 * p1.x + b2 * p2.x + b3 * p3.x,
    y: b0 * p0.y + b1 * p1.y + b2 * p2.y + b3 * p3.y,
    pressure: clamp(b0 * p0.pressure + b1 * p1.pressure + b2 * p2.pressure + b3 * p3.pressure, 0, 1),
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, val))
}
