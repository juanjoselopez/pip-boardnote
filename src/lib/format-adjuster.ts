/**
 * Ajuste de trazos al cambiar el formato de hoja
 */
import type { Stroke, PaperFormat } from '../types/strokes'

/** Calcular el bounding box de un conjunto de trazos */
function getBounds(strokes: Stroke[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity
  let maxX = -Infinity, maxY = -Infinity

  for (const s of strokes) {
    for (const p of s.points) {
      if (p.x < minX) minX = p.x
      if (p.y < minY) minY = p.y
      if (p.x > maxX) maxX = p.x
      if (p.y > maxY) maxY = p.y
    }
  }

  return { minX, minY, maxX, maxY }
}

/** Escalar todos los trazos para que quepan en el nuevo formato */
export function scaleStrokesToFormat(
  strokes: Stroke[],
  oldFormat: PaperFormat,
  newFormat: PaperFormat
): Stroke[] {
  if (strokes.length === 0) return []

  const bounds = getBounds(strokes)
  const oldW = bounds.maxX - bounds.minX || 1
  const oldH = bounds.maxY - bounds.minY || 1

  const scale = Math.min(newFormat.widthMm / oldW, newFormat.heightMm / oldH)

  return strokes.map((stroke) => ({
    ...stroke,
    width: stroke.width * scale,
    points: stroke.points.map((p) => ({
      x: (p.x - bounds.minX) * scale + bounds.minX,
      y: (p.y - bounds.minY) * scale + bounds.minY,
      pressure: p.pressure,
    })),
  }))
}

/** Re-centrar trazos en la nueva hoja después de escalar */
export function centerStrokesInFormat(
  strokes: Stroke[],
  format: PaperFormat
): Stroke[] {
  if (strokes.length === 0) return []

  const bounds = getBounds(strokes)
  const contentW = bounds.maxX - bounds.minX
  const contentH = bounds.maxY - bounds.minY

  const offsetX = (format.widthMm - contentW) / 2 - bounds.minX
  const offsetY = (format.heightMm - contentH) / 2 - bounds.minY

  return strokes.map((stroke) => ({
    ...stroke,
    points: stroke.points.map((p) => ({
      x: p.x + offsetX,
      y: p.y + offsetY,
      pressure: p.pressure,
    })),
  }))
}
