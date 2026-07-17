/**
 * Barra de estado: información del modo, zoom, trazos, etc.
 */
export class StatusBar {
  private modeIndicator: HTMLElement
  private formatIndicator: HTMLElement
  private zoomDisplay: HTMLElement
  private strokeCount: HTMLElement

  constructor() {
    this.modeIndicator = document.getElementById('mode-indicator')!
    this.formatIndicator = document.getElementById('format-indicator')!
    this.zoomDisplay = document.getElementById('zoom-display')!
    this.strokeCount = document.getElementById('stroke-count')!
  }

  setMode(mode: string): void {
    const labels: Record<string, string> = {
      draw: '✏️ Dibujo',
      select: '🖱 Selección',
      hand: '🖐 Mano',
    }
    this.modeIndicator.textContent = labels[mode] || mode
  }

  setFormat(format: string): void {
    this.formatIndicator.textContent = format.toUpperCase()
  }

  setZoom(percent: number): void {
    this.zoomDisplay.textContent = `${Math.round(percent)}%`
  }

  setStrokeCount(count: number): void {
    this.strokeCount.textContent = `${count} trazos`
  }
}
