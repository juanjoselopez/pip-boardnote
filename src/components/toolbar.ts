/**
 * Conexión del toolbar HTML con los módulos core de la aplicación
 */
import { ModeManager } from '../lib/mode-manager'
import { StrokeManager } from '../lib/stroke-manager'
import { CanvasEngine } from '../lib/canvas-engine'
import { Zoom } from '../lib/zoom'
import { FormatSelector } from './format-selector'
import { ColorAlphaPicker } from './color-alpha-picker'
import type { HslaColor } from './color-alpha-picker'
import { getFormat } from '../lib/paper-formats'
import type { PaperFormat, ModeType, ToolType, SmoothLevel } from '../types/strokes'

export class Toolbar {
  private modeManager: ModeManager
  private strokeManager: StrokeManager
  private canvasEngine: CanvasEngine
  private zoom: Zoom
  private formatSelector: FormatSelector
  private activeColor = '#000000'
  private activeWidth = 1.0
  private activeSmoothLevel: SmoothLevel = 'high'
  private smoothListeners: Array<(level: SmoothLevel) => void> = []
  private colorAlphaPicker!: ColorAlphaPicker
  private activeAlpha = 1.0
  private isLandscape = false
  private orientationListeners: Array<(isLandscape: boolean) => void> = []
  private freeCanvasListeners: Array<() => void> = []
  private clearListeners: Array<() => void> = []
  private openListeners: Array<() => void> = []
  private transparentPaper = false
  private transparentListeners: Array<(active: boolean) => void> = []
  private exportListeners: Array<(format: string) => void> = []
  private onFormatChange: (format: PaperFormat) => void

  constructor(
    modeManager: ModeManager,
    strokeManager: StrokeManager,
    canvasEngine: CanvasEngine,
    zoom: Zoom,
    formatSelector: FormatSelector,
    callbacks: {
      onFormatChange: (format: PaperFormat) => void
    }
  ) {
    this.modeManager = modeManager
    this.strokeManager = strokeManager
    this.canvasEngine = canvasEngine
    this.zoom = zoom
    this.formatSelector = formatSelector
    this.onFormatChange = callbacks.onFormatChange

    this.initModeButtons()
    this.initToolButtons()
    this.initUndoRedo()
    this.initColorPicker()
    this.initWidthSelector()
    this.initSmoothSelector()
    // Notificar valor inicial de suavizado al engine
    setTimeout(() => this.smoothListeners.forEach(fn => fn(this.activeSmoothLevel)), 0)
    this.initZoom()
    this.initFormatSelector()
    this.initExport()
    this.initDropdownCloser()
    this.initOrientationButton()
    this.initFreeCanvasButton()
    this.initClearButton()
    this.initOpenButton()
    this.initTransparentButton()
    this.initKeyboardShortcuts()
    this.syncUI()

    this.modeManager.onModeChange(() => this.syncModeUI())
    this.modeManager.onToolChange(() => this.syncToolUI())
    this.zoom.onChange(() => this.updateZoomDisplay())
    this.strokeManager.onUndoRedoChange((canUndo, canRedo) => this.syncUndoRedoUI(canUndo, canRedo))
  }

  getActiveColor(): string {
    return this.activeColor
  }

  getActiveWidth(): number {
    return this.activeWidth
  }

  onExport(fn: (format: string) => void): void {
    this.exportListeners.push(fn)
  }

  private initModeButtons(): void {
    const buttons = document.querySelectorAll<HTMLElement>('[data-mode]')
    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode') as ModeType
        this.modeManager.setMode(mode)
      })
    }
  }

  private initToolButtons(): void {
    const buttons = document.querySelectorAll<HTMLElement>('[data-tool]')
    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        const tool = btn.getAttribute('data-tool') as ToolType
        this.modeManager.setTool(tool)
        this.modeManager.setMode('draw')
      })
    }
  }

  private initUndoRedo(): void {
    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement
    const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement

    undoBtn.addEventListener('click', () => this.strokeManager.undo())
    redoBtn.addEventListener('click', () => this.strokeManager.redo())
  }

  private initColorPicker(): void {
    const btnColor = document.getElementById('btn-color')!
    const picker = document.getElementById('color-picker')!

    // Inicializar ColorAlphaPicker solo si existe el panel en el DOM
    if (picker) {
      this.colorAlphaPicker = new ColorAlphaPicker('color-picker')
      this.colorAlphaPicker.setColor(this.activeColor)
      this.colorAlphaPicker.onChange((hex: string, hsla: HslaColor) => {
        this.activeColor = ColorAlphaPicker.hslToHexString(hsla.h, hsla.s, hsla.l)
        this.activeAlpha = hsla.a
        btnColor.style.backgroundColor = this.activeColor
      })
    }

    btnColor.addEventListener('click', (e) => {
      e.stopPropagation()
      picker.classList.toggle('hidden')
    })
  }

  getActiveAlpha(): number {
    return this.activeAlpha
  }

  private initWidthSelector(): void {
    const select = document.getElementById('width-select') as HTMLSelectElement

    select.addEventListener('change', () => {
      this.activeWidth = parseFloat(select.value)
    })
  }

  getSmoothLevel(): SmoothLevel {
    return this.activeSmoothLevel
  }

  onSmoothChange(fn: (level: SmoothLevel) => void): void {
    this.smoothListeners.push(fn)
  }

  private initSmoothSelector(): void {
    const select = document.getElementById('smooth-select') as HTMLSelectElement

    select.addEventListener('change', () => {
      this.activeSmoothLevel = select.value as SmoothLevel
      this.smoothListeners.forEach(fn => fn(this.activeSmoothLevel))
    })
  }

  private initZoom(): void {
    const buttons = document.querySelectorAll<HTMLElement>('[data-cmd]')
    for (const btn of buttons) {
      btn.addEventListener('click', () => {
        const cmd = btn.getAttribute('data-cmd')
        if (cmd === 'zoom-in') this.zoom.zoomIn()
        else if (cmd === 'zoom-out') this.zoom.zoomOut()
        else if (cmd === 'zoom-reset') this.zoom.reset()
      })
    }
  }

  private initFormatSelector(): void {
    this.formatSelector.onChange((formatId) => {
      const format = getFormat(formatId)
      this.onFormatChange(format)
    })
  }

  private initExport(): void {
    const btnExport = document.getElementById('btn-export')!
    const dropdown = document.getElementById('export-dropdown')!
    const formatButtons = dropdown.querySelectorAll<HTMLElement>('[data-format]')

    btnExport.addEventListener('click', (e) => {
      e.stopPropagation()
      dropdown.classList.toggle('hidden')
    })

    for (const btn of formatButtons) {
      btn.addEventListener('click', () => {
        const format = btn.getAttribute('data-format')!
        this.exportListeners.forEach((fn) => fn(format))
        dropdown.classList.add('hidden')
      })
    }
  }

  private initDropdownCloser(): void {
    document.addEventListener('click', () => {
      const picker = document.getElementById('color-picker')!
      const exportDropdown = document.getElementById('export-dropdown')!
      picker.classList.add('hidden')
      exportDropdown.classList.add('hidden')
    })
  }

  private initKeyboardShortcuts(): void {
    document.addEventListener('keydown', (e) => {
      const key = e.key.toLowerCase()
      const ctrl = e.ctrlKey || e.metaKey

      if (!ctrl && key === 'd') {
        e.preventDefault()
        this.modeManager.setMode('draw')
        return
      }
      if (!ctrl && key === 's') {
        e.preventDefault()
        this.modeManager.setMode('select')
        return
      }
      if (!ctrl && key === 'h') {
        e.preventDefault()
        this.modeManager.setMode('hand')
        return
      }

      if (ctrl && key === 'z') {
        e.preventDefault()
        this.strokeManager.undo()
        return
      }
      if (ctrl && key === 'y') {
        e.preventDefault()
        this.strokeManager.redo()
        return
      }
      if (ctrl && key === '=') {
        e.preventDefault()
        this.zoom.zoomIn()
        return
      }
      if (ctrl && key === '-') {
        e.preventDefault()
        this.zoom.zoomOut()
        return
      }
      if (ctrl && key === '0') {
        e.preventDefault()
        this.zoom.reset()
        return
      }

      if (ctrl && key === 'o') {
        e.preventDefault()
        this.openListeners.forEach(fn => fn())
        return
      }

      if ((key === 'delete' || key === 'backspace') && this.modeManager.getMode() === 'select') {
        e.preventDefault()
        this.strokeManager.deleteSelected()
        return
      }
    })
  }

  private syncUI(): void {
    this.syncModeUI()
    this.syncToolUI()
    this.updateZoomDisplay()
    this.syncUndoRedoUI(this.strokeManager.canUndo(), this.strokeManager.canRedo())
  }

  private syncModeUI(): void {
    const mode = this.modeManager.getMode()
    const buttons = document.querySelectorAll<HTMLElement>('[data-mode]')
    for (const btn of buttons) {
      const isActive = btn.getAttribute('data-mode') === mode
      btn.classList.toggle('active', isActive)
    }
  }

  private syncToolUI(): void {
    const tool = this.modeManager.getTool()
    const buttons = document.querySelectorAll<HTMLElement>('[data-tool]')
    for (const btn of buttons) {
      const isActive = btn.getAttribute('data-tool') === tool
      btn.classList.toggle('active', isActive)
    }
  }

  private updateZoomDisplay(): void {
    const el = document.getElementById('zoom-level')
    if (el) {
      el.textContent = `${this.zoom.getPercent()}%`
    }
  }

  private syncUndoRedoUI(canUndo: boolean, canRedo: boolean): void {
    const undoBtn = document.getElementById('btn-undo') as HTMLButtonElement | null
    const redoBtn = document.getElementById('btn-redo') as HTMLButtonElement | null
    if (undoBtn) undoBtn.disabled = !canUndo
    if (redoBtn) redoBtn.disabled = !canRedo
  }

  // ------------------------------------------------------------
  // Orientación (Landscape toggle)
  // ------------------------------------------------------------

  onOrientationChange(fn: (isLandscape: boolean) => void): void {
    this.orientationListeners.push(fn)
  }

  private initOrientationButton(): void {
    const btn = document.getElementById('btn-orientation')
    btn?.addEventListener('click', () => {
      this.isLandscape = !this.isLandscape
      btn.textContent = this.isLandscape ? '⇆' : '⇄'
      this.orientationListeners.forEach(fn => fn(this.isLandscape))
    })
  }

  // ------------------------------------------------------------
  // Lienzo libre (Free Canvas)
  // ------------------------------------------------------------

  onFreeCanvasToggle(fn: () => void): void {
    this.freeCanvasListeners.push(fn)
  }

  private initFreeCanvasButton(): void {
    const btn = document.getElementById('btn-free-canvas')
    btn?.addEventListener('click', () => {
      this.freeCanvasListeners.forEach(fn => fn())
    })
  }

  // ------------------------------------------------------------
  // Limpiar todo
  // ------------------------------------------------------------

  onClearAll(fn: () => void): void {
    this.clearListeners.push(fn)
  }

  private initClearButton(): void {
    const btn = document.getElementById('btn-clear')
    btn?.addEventListener('click', () => {
      if (confirm('¿Borrar todo el contenido?')) {
        this.clearListeners.forEach(fn => fn())
      }
    })
  }

  // ------------------------------------------------------------
  // Modo hoja transparente (solo borde, sin relleno blanco)
  // ------------------------------------------------------------

  onTransparentToggle(fn: (active: boolean) => void): void {
    this.transparentListeners.push(fn)
  }

  private initTransparentButton(): void {
    const btn = document.getElementById('btn-transparent')
    btn?.addEventListener('click', () => {
      this.transparentPaper = !this.transparentPaper
      btn.classList.toggle('active', this.transparentPaper)
      this.transparentListeners.forEach(fn => fn(this.transparentPaper))
    })
  }

  // ------------------------------------------------------------
  // Abrir proyecto
  // ------------------------------------------------------------

  onOpenProject(fn: () => void): void {
    this.openListeners.push(fn)
  }

  private initOpenButton(): void {
    const btn = document.getElementById('btn-open')
    btn?.addEventListener('click', () => {
      this.openListeners.forEach(fn => fn())
    })
  }
}
