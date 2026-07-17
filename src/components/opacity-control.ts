/**
 * Control deslizante de opacidad de la ventana
 * Basado en pip-notepad/src/components/opacity-control.ts
 */
export class OpacityControl {
  private slider: HTMLInputElement
  private listeners: Array<(opacity: number) => void> = []

  constructor() {
    this.slider = document.getElementById('opacity-slider') as HTMLInputElement
    this.slider.addEventListener('input', () => {
      const value = parseFloat(this.slider.value)
      this.listeners.forEach((fn) => fn(value))
    })
  }

  setOpacity(value: number): void {
    const clamped = Math.max(0.3, Math.min(1.0, value))
    this.slider.value = clamped.toString()
    this.listeners.forEach((fn) => fn(clamped))
  }

  onChange(fn: (opacity: number) => void): void {
    this.listeners.push(fn)
  }
}
