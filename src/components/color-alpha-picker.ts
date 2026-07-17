/**
 * Selector de color HSL con soporte de canal alpha
 * Sin dependencias, usa CSS gradients nativos
 */
export interface HslaColor {
  h: number
  s: number
  l: number
  a: number
}

export class ColorAlphaPicker {
  private hue = 0
  private saturation = 100
  private lightness = 50
  private alpha = 1
  private activeDrag: 'sl' | 'hue' | 'alpha' | null = null
  private changeListeners: Array<(hex: string, hsla: HslaColor) => void> = []

  private panel!: HTMLElement
  private slField!: HTMLElement
  private slCursor!: HTMLElement
  private hueBar!: HTMLElement
  private hueCursor!: HTMLElement
  private alphaBar!: HTMLElement
  private alphaCursor!: HTMLElement
  private previewInner!: HTMLElement
  private hexInput!: HTMLInputElement

  constructor(panelId: string) {
    this.panel = document.getElementById(panelId)!
    this.slField = document.getElementById('cp-sl-field')!
    this.slCursor = document.getElementById('cp-sl-cursor')!
    this.hueBar = document.getElementById('cp-hue-bar')!
    this.hueCursor = document.getElementById('cp-hue-cursor')!
    this.alphaBar = document.getElementById('cp-alpha-bar')!
    this.alphaCursor = document.getElementById('cp-alpha-cursor')!
    this.previewInner = document.getElementById('cp-preview-inner')!
    this.hexInput = document.getElementById('cp-hex-input') as HTMLInputElement

    this.bindEvents()
    this.updateUI()
  }

  setColor(hex: string): void {
    const hsla = ColorAlphaPicker.hexToHsla(hex)
    this.hue = hsla.h
    this.saturation = hsla.s
    this.lightness = hsla.l
    this.alpha = hsla.a
    this.updateUI()
  }

  getColorHex(): string {
    return ColorAlphaPicker.hslaToHex(this.hue, this.saturation, this.lightness, this.alpha)
  }

  getColorHexNoAlpha(): string {
    return ColorAlphaPicker.hslToHexString(this.hue, this.saturation, this.lightness)
  }

  getAlpha(): number {
    return this.alpha
  }

  onChange(fn: (hex: string, hsla: HslaColor) => void): void {
    this.changeListeners.push(fn)
  }

  static hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hh = h / 360
    const ss = s / 100
    const ll = l / 100

    let r: number, g: number, b: number

    if (ss === 0) {
      r = g = b = ll
    } else {
      const hue2rgb = (p: number, q: number, t: number): number => {
        let tt = t
        if (tt < 0) tt += 1
        if (tt > 1) tt -= 1
        if (tt < 1 / 6) return p + (q - p) * 6 * tt
        if (tt < 1 / 2) return q
        if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
        return p
      }
      const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
      const p = 2 * ll - q
      r = hue2rgb(p, q, hh + 1 / 3)
      g = hue2rgb(p, q, hh)
      b = hue2rgb(p, q, hh - 1 / 3)
    }

    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) }
  }

  static hslToHexString(h: number, s: number, l: number): string {
    const { r, g, b } = ColorAlphaPicker.hslToRgb(h, s, l)
    return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
  }

  static hslaToHex(h: number, s: number, l: number, a: number): string {
    const { r, g, b } = ColorAlphaPicker.hslToRgb(h, s, l)
    const alpha = Math.round(Math.max(0, Math.min(1, a)) * 255)
    return '#' + [r, g, b, alpha].map(v => v.toString(16).padStart(2, '0')).join('')
  }

  static hexToHsla(hex: string): HslaColor {
    let h = hex.replace(/^#/, '')
    if (h.length === 3) {
      h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2]
    }

    const r = parseInt(h.substring(0, 2), 16) / 255
    const g = parseInt(h.substring(2, 4), 16) / 255
    const b = parseInt(h.substring(4, 6), 16) / 255
    const a = h.length >= 8 ? parseInt(h.substring(6, 8), 16) / 255 : 1

    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    const l = (max + min) / 2

    let hh = 0
    let s = 0

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case r:
          hh = ((g - b) / d + (g < b ? 6 : 0)) / 6
          break
        case g:
          hh = ((b - r) / d + 2) / 6
          break
        case b:
          hh = ((r - g) / d + 4) / 6
          break
      }
    }

    return { h: Math.round(hh * 360), s: Math.round(s * 100), l: Math.round(l * 100), a }
  }

  private bindEvents(): void {
    // Evitar que clicks dentro del panel cierren el picker
    this.panel.addEventListener('click', (e) => e.stopPropagation())

    // Campo Saturation-Lightness
    this.slField.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.activeDrag = 'sl'
      this.slField.setPointerCapture(e.pointerId)
      this.updateSLFromEvent(e)
    })

    this.slField.addEventListener('pointermove', (e) => {
      if (this.activeDrag !== 'sl') return
      this.updateSLFromEvent(e)
    })

    this.slField.addEventListener('pointerup', (e) => {
      if (this.activeDrag !== 'sl') return
      this.activeDrag = null
      this.slField.releasePointerCapture(e.pointerId)
    })

    // Barra de Hue
    this.hueBar.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.activeDrag = 'hue'
      this.hueBar.setPointerCapture(e.pointerId)
      this.updateHueFromEvent(e)
    })

    this.hueBar.addEventListener('pointermove', (e) => {
      if (this.activeDrag !== 'hue') return
      this.updateHueFromEvent(e)
    })

    this.hueBar.addEventListener('pointerup', (e) => {
      if (this.activeDrag !== 'hue') return
      this.activeDrag = null
      this.hueBar.releasePointerCapture(e.pointerId)
    })

    // Barra de Alpha
    this.alphaBar.addEventListener('pointerdown', (e) => {
      e.preventDefault()
      this.activeDrag = 'alpha'
      this.alphaBar.setPointerCapture(e.pointerId)
      this.updateAlphaFromEvent(e)
    })

    this.alphaBar.addEventListener('pointermove', (e) => {
      if (this.activeDrag !== 'alpha') return
      this.updateAlphaFromEvent(e)
    })

    this.alphaBar.addEventListener('pointerup', (e) => {
      if (this.activeDrag !== 'alpha') return
      this.activeDrag = null
      this.alphaBar.releasePointerCapture(e.pointerId)
    })

    // Input hex editable
    this.hexInput.addEventListener('input', () => {
      const raw = this.hexInput.value.replace(/[^0-9a-fA-F]/g, '').substring(0, 8)
      if (raw.length === 6 || raw.length === 8) {
        const hsla = ColorAlphaPicker.hexToHsla('#' + raw)
        this.hue = hsla.h
        this.saturation = hsla.s
        this.lightness = hsla.l
        this.alpha = hsla.a
        this.updateUI()
        this.notifyChange()
      }
    })

    this.hexInput.addEventListener('blur', () => {
      const raw = this.hexInput.value.replace(/[^0-9a-fA-F]/g, '').substring(0, 8)
      if (raw.length === 6 || raw.length === 8) {
        this.hexInput.value = raw
      } else {
        // Restaurar valor actual si es inválido
        this.hexInput.value = this.getColorHex().replace('#', '')
      }
    })
  }

  private updateSLFromEvent(e: PointerEvent): void {
    const rect = this.slField.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    const y = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))
    this.saturation = Math.round(x * 100)
    this.lightness = Math.round((1 - y) * 100)
    this.updateUI()
    this.notifyChange()
  }

  private updateHueFromEvent(e: PointerEvent): void {
    const rect = this.hueBar.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    this.hue = Math.round(x * 360)
    this.updateUI()
    this.notifyChange()
  }

  private updateAlphaFromEvent(e: PointerEvent): void {
    const rect = this.alphaBar.getBoundingClientRect()
    const x = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    this.alpha = Math.round(x * 100) / 100
    this.updateUI()
    this.notifyChange()
  }

  private updateUI(): void {
    const hex = this.getColorHexNoAlpha()
    const hexFull = this.getColorHex()

    // Campo SL: gradiente de saturación y luminosidad sobre el matiz base
    this.slField.style.background = `
      linear-gradient(to top, black 0%, transparent 100%),
      linear-gradient(to bottom, white 0%, transparent 100%),
      linear-gradient(to right, white 0%, transparent 100%),
      hsl(${this.hue}, 100%, 50%)
    `

    // Cursor SL
    this.slCursor.style.left = `${this.saturation}%`
    this.slCursor.style.top = `${100 - this.lightness}%`

    // Barra de Hue: gradiente arcoiris
    this.hueBar.style.background = `linear-gradient(to right,
      hsl(0, 100%, 50%),
      hsl(30, 100%, 50%),
      hsl(60, 100%, 50%),
      hsl(90, 100%, 50%),
      hsl(120, 100%, 50%),
      hsl(150, 100%, 50%),
      hsl(180, 100%, 50%),
      hsl(210, 100%, 50%),
      hsl(240, 100%, 50%),
      hsl(270, 100%, 50%),
      hsl(300, 100%, 50%),
      hsl(330, 100%, 50%),
      hsl(360, 100%, 50%)
    )`

    // Cursor Hue
    this.hueCursor.style.left = `${(this.hue / 360) * 100}%`

    // Barra Alpha: checkerboard + gradiente
    this.alphaBar.style.background = `
      linear-gradient(to right, transparent 0%, ${hex} 100%),
      repeating-conic-gradient(#808080 0% 25%, #e6e6e6 0% 50%) 0 0 / 8px 8px
    `

    // Cursor Alpha
    this.alphaCursor.style.left = `${this.alpha * 100}%`

    // Preview
    const { r, g, b } = ColorAlphaPicker.hslToRgb(this.hue, this.saturation, this.lightness)
    this.previewInner.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${this.alpha})`

    // Input hex
    this.hexInput.value = hexFull.replace('#', '')
  }

  private notifyChange(): void {
    const hex = this.getColorHex()
    const hsla: HslaColor = { h: this.hue, s: this.saturation, l: this.lightness, a: this.alpha }
    for (const fn of this.changeListeners) {
      fn(hex, hsla)
    }
  }
}
