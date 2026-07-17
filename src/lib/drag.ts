/**
 * Arrastre manual de la ventana sin decoraciones nativas
 * Basado en pip-notepad/src/lib/drag.ts
 */
export class Drag {
  private isDragging = false
  private startMouseX = 0
  private startMouseY = 0
  private startWindowX = 0
  private startWindowY = 0
  private titlebar: HTMLElement

  constructor() {
    this.titlebar = document.getElementById('titlebar')!
    this.titlebar.addEventListener('mousedown', this.onMouseDown)
  }

  private onMouseDown = (e: MouseEvent) => {
    // Ignorar clicks en controles de ventana
    if ((e.target as HTMLElement).closest('#window-controls')) return
    this.isDragging = true
    this.startMouseX = e.screenX
    this.startMouseY = e.screenY
    document.addEventListener('mousemove', this.onMouseMove)
    document.addEventListener('mouseup', this.onMouseUp)
  }

  private onMouseMove = async (e: MouseEvent) => {
    if (!this.isDragging) return
    const dx = e.screenX - this.startMouseX
    const dy = e.screenY - this.startMouseY
    try {
      const { getCurrentWindow, LogicalPosition } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      const pos = await win.outerPosition()
      await win.setPosition(new LogicalPosition({
        x: pos.x + dx,
        y: pos.y + dy
      }))
    } catch { /* Modo navegador, ignorar */ }
    this.startMouseX = e.screenX
    this.startMouseY = e.screenY
  }

  private onMouseUp = () => {
    this.isDragging = false
    document.removeEventListener('mousemove', this.onMouseMove)
    document.removeEventListener('mouseup', this.onMouseUp)
  }
}
