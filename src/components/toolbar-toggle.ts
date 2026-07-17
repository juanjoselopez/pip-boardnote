/**
 * Colapsar/expandir barra de herramientas
 * Basado en pip-notepad/src/components/toolbar-toggle.ts
 */
export class ToolbarToggle {
  private collapsed = false
  private button: HTMLElement

  constructor() {
    this.button = document.getElementById('btn-toggle-toolbar')!
    this.button.addEventListener('click', () => this.toggle())

    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey && e.key.toLowerCase() === 't') {
        e.preventDefault()
        this.toggle()
      }
    })
  }

  private toggle(): void {
    this.collapsed = !this.collapsed
    document.getElementById('app')!.classList.toggle('toolbar-collapsed', this.collapsed)
    this.button.textContent = this.collapsed ? '▲' : '▼'
  }
}
