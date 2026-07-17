/**
 * Modo click-through: los eventos del mouse pasan a través de la ventana
 * Basado en pip-notepad/src/components/click-through.ts
 */
export class ClickThrough {
  private active = false
  private button: HTMLElement
  private overlay: HTMLElement
  private ctIndicator: HTMLElement
  private listeners: Array<(active: boolean) => void> = []

  constructor() {
    this.button = document.getElementById('btn-clickthrough')!
    this.overlay = document.getElementById('click-through-overlay')!
    this.ctIndicator = document.getElementById('ct-indicator')!

    this.button.addEventListener('click', () => this.toggle())

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        if (this.active) this.toggle()
      }
    })
  }

  private async toggle(): Promise<void> {
    this.active = !this.active
    this.updateUI()
    try {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      await getCurrentWindow().setIgnoreCursorEvents(this.active)
    } catch { /* Modo navegador */ }
    this.listeners.forEach((fn) => fn(this.active))
  }

  private updateUI(): void {
    this.button.classList.toggle('active', this.active)
    this.overlay.classList.toggle('hidden', !this.active)
    this.ctIndicator.classList.toggle('hidden', !this.active)
  }

  onChange(fn: (active: boolean) => void): void {
    this.listeners.push(fn)
  }
}
