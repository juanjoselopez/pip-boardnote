/**
 * Selector de formato de hoja
 */
export class FormatSelector {
  private select: HTMLSelectElement
  private listeners: Array<(formatId: string) => void> = []

  constructor() {
    this.select = document.getElementById('format-select') as HTMLSelectElement
    this.select.addEventListener('change', () => {
      this.listeners.forEach((fn) => fn(this.select.value))
    })
  }

  getCurrentFormat(): string {
    return this.select.value
  }

  setFormat(formatId: string): void {
    this.select.value = formatId
    this.listeners.forEach((fn) => fn(formatId))
  }

  onChange(fn: (formatId: string) => void): void {
    this.listeners.push(fn)
  }
}
