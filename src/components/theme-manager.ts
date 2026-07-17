/**
 * Gestor de tema claro/oscuro
 * Basado en pip-notepad/src/components/theme-manager.ts
 */
export class ThemeManager {
  private isLight = false
  private button: HTMLElement
  private listeners: Array<(isLight: boolean) => void> = []

  constructor() {
    this.button = document.getElementById('btn-theme')!
    this.button.addEventListener('click', () => this.toggle())
  }

  private toggle(): void {
    this.isLight = !this.isLight
    document.body.classList.toggle('light-theme', this.isLight)
    this.button.textContent = this.isLight ? '☀' : '☾'
    this.listeners.forEach((fn) => fn(this.isLight))
  }

  setTheme(isLight: boolean): void {
    this.isLight = isLight
    document.body.classList.toggle('light-theme', this.isLight)
    this.button.textContent = this.isLight ? '☀' : '☾'
  }

  onChange(fn: (isLight: boolean) => void): void {
    this.listeners.push(fn)
  }
}
