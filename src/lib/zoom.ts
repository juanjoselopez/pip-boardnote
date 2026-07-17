/**
 * Control de zoom para la vista del canvas
 */

export const MIN_ZOOM = 0.2
export const MAX_ZOOM = 4.0
export const ZOOM_STEP = 0.1

export class Zoom {
  private level = 1.0
  private listeners: Array<(level: number) => void> = []

  getLevel(): number {
    return this.level
  }

  getPercent(): number {
    return Math.round(this.level * 100)
  }

  zoomIn(): void {
    this.zoomTo(this.level + ZOOM_STEP)
  }

  zoomOut(): void {
    this.zoomTo(this.level - ZOOM_STEP)
  }

  zoomTo(level: number): void {
    const clamped = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, level))
    if (clamped === this.level) return
    this.level = clamped
    this.listeners.forEach(fn => fn(this.level))
  }

  reset(): void {
    this.zoomTo(1.0)
  }

  onChange(fn: (level: number) => void): void {
    this.listeners.push(fn)
  }
}
