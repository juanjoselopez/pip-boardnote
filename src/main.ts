/**
 * Orquestador principal de PiP BoardNote
 * Inicializa y conecta todos los módulos de la aplicación
 */
import './styles/main.css'
import './styles/canvas.css'
import './styles/toolbar.css'
import './styles/theme.css'
import { CanvasEngine } from './lib/canvas-engine'
import { StrokeManager } from './lib/stroke-manager'
import { ImageManager } from './lib/image-manager'
import { ModeManager } from './lib/mode-manager'
import { Zoom } from './lib/zoom'
import { InputHandler } from './lib/input-handler'
import { Drag } from './lib/drag'
import { exportToFile } from './lib/exporter'
import { getFormat, calculateInitialWindowSize } from './lib/paper-formats'
import { openProject } from './lib/importer'
import { scaleStrokesToFormat, centerStrokesInFormat } from './lib/format-adjuster'
import { saveNote, loadNote, createEmptyData } from './lib/storage'
import { Toolbar } from './components/toolbar'
import { FormatSelector } from './components/format-selector'
import { OpacityControl } from './components/opacity-control'
import { ClickThrough } from './components/click-through'
import { ThemeManager } from './components/theme-manager'
import { ToolbarToggle } from './components/toolbar-toggle'
import { StatusBar } from './components/status-bar'
import type { Stroke, PaperFormat, BoardNoteData, SmoothLevel } from './types/strokes'
import type { ToolType, StrokePoint } from './types/strokes'

class App {
  private canvas!: HTMLCanvasElement
  private canvasEngine!: CanvasEngine
  private strokeManager!: StrokeManager
  private imageManager!: ImageManager
  private readonly MM_TO_PX = 3.779527559
  private modeManager!: ModeManager
  private zoom!: Zoom
  private inputHandler!: InputHandler
  private toolbar!: Toolbar
  private formatSelector!: FormatSelector
  private statusBar!: StatusBar
  private opacityControl!: OpacityControl
  private clickThrough!: ClickThrough
  private themeManager!: ThemeManager
  private currentFormat!: PaperFormat
  private isFreeCanvasMode = false
  private isLandscape = false
  private saveInterval!: ReturnType<typeof setInterval>

  constructor() {
    this.init()
  }

  private async init(): Promise<void> {
    this.canvas = document.getElementById('board-canvas') as HTMLCanvasElement

    // Inicializar módulos core
    this.canvasEngine = new CanvasEngine(this.canvas)
    this.strokeManager = new StrokeManager()
    this.imageManager = new ImageManager()
    this.modeManager = new ModeManager()
    this.zoom = new Zoom()

    // Módulos UI
    this.formatSelector = new FormatSelector()
    this.opacityControl = new OpacityControl()
    this.clickThrough = new ClickThrough()
    this.themeManager = new ThemeManager()
    this.statusBar = new StatusBar()

    // Formato por defecto
    this.currentFormat = getFormat('a4')

    // Toolbar (conecta todos los botones)
    this.toolbar = new Toolbar(
      this.modeManager,
      this.strokeManager,
      this.canvasEngine,
      this.zoom,
      this.formatSelector,
      {
        onFormatChange: (format: PaperFormat) => this.handleFormatChange(format),
      }
    )

    // Inicializar sistema de entrada
    this.inputHandler = new InputHandler(this.canvas, this.modeManager, {
      onStrokeComplete: (tool: ToolType, color: string, width: number, points: StrokePoint[]) => {
        this.strokeManager.addStroke(tool, color, width, points, this.toolbar.getActiveAlpha())
      },
      onStrokeDelete: (id: string) => {
        this.strokeManager.removeStroke(id)
      },
      onStrokeSelect: (id: string | null) => {
        this.strokeManager.select(id)
      },
      onStrokeMove: (id: string, dx: number, dy: number) => {
        this.strokeManager.moveSelected(dx, dy)
      },
      onPan: (dx: number, dy: number) => {
        this.canvasEngine.pan(dx, dy)
      },
      onZoom: (deltaX: number, deltaY: number, clientX: number, clientY: number) => {
        const rect = this.canvas.getBoundingClientRect()
        const viewX = clientX - rect.left
        const viewY = clientY - rect.top
        const zoomDelta = -deltaY / 1000
        this.canvasEngine.zoomAtPoint(zoomDelta, viewX, viewY)
        this.syncZoomFromEngine()
      },
      getActiveColor: () => this.toolbar.getActiveColor(),
      getActiveWidth: () => this.toolbar.getActiveWidth(),
      viewToScene: (viewX: number, viewY: number) => this.canvasEngine.viewToScene(viewX, viewY),
      getStrokeAtPoint: (x: number, y: number): string | null => {
        const stroke = this.strokeManager.getStrokeAtPoint(x, y)
        return stroke ? stroke.id : null
      },
      onImageMove: (id: string, dx: number, dy: number) => this.imageManager.moveImage(id, dx, dy),
      onImageResize: (id: string, newW: number, newH: number, newX: number, newY: number) => this.imageManager.resizeImage(id, newW, newH, newX, newY),
      onImageSelect: (id: string | null) => this.imageManager.select(id),
      hitTestImage: (vx: number, vy: number) => {
        const img = this.canvasEngine.hitTestImage(vx, vy)
        return img ? { id: img.id } : null
      },
      hitTestImageHandle: (vx: number, vy: number) => {
        const result = this.canvasEngine.hitTestImageHandle(vx, vy)
        return result ? { id: result.image.id, corner: result.corner } : null
      },
      getImageById: (id: string) => {
        const img = this.imageManager?.getImage(id)
        return img ? { id: img.id, width: img.width, height: img.height, x: img.x, y: img.y } : null
      },
      isSelected: (id: string) => this.strokeManager.getSelectedIds().includes(id),
      onStrokeUpdate: (tool: ToolType, color: string, width: number, points: StrokePoint[]) => {
        this.canvasEngine.setCurrentStroke(tool, color, width, points)
      },
      onLassoUpdate: (x1: number, y1: number, x2: number, y2: number) => {
        this.canvasEngine.setSelectionRect({ x1, y1, x2, y2 })
      },
      onLassoComplete: (x1: number, y1: number, x2: number, y2: number) => {
        const ids = this.strokeManager.getStrokesInRect(x1, y1, x2, y2)
        this.strokeManager.selectMultiple(ids)
        this.canvasEngine.setSelectionRect(null)
      },
    })

    // Arrastre de ventana sin decoraciones
    new Drag()
    // Colapso de toolbar
    new ToolbarToggle()

    // Listener para pegar imágenes
    document.addEventListener('paste', (e) => this.handlePaste(e))

    // Conectar observers
    this.connectObservers()

    // Cargar datos guardados
    await this.loadSavedData()

    // Ajustar ventana al formato inicial
    await this.adjustWindowToFormat()

    // Autosave cada 5 segundos
    this.saveInterval = setInterval(() => this.autoSave(), 5000)

    // Guardar al perder visibilidad
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.autoSave()
    })

    // Botones de ventana
    this.setupWindowControls()

    // Sincronizar UI inicial
    this.syncAllUI()
  }

  private connectObservers(): void {
    // Cuando cambian los trazos, actualizar canvas y status bar
    this.strokeManager.onChange(() => {
      this.canvasEngine.setStrokes(this.strokeManager.getAllStrokes())
      this.statusBar.setStrokeCount(this.strokeManager.getAllStrokes().length)
    })

    // Cuando cambia la selección, actualizar canvas (soporta multi-selección)
    this.strokeManager.onSelectionChange(() => {
      this.canvasEngine.setSelectedIds(this.strokeManager.getSelectedIds())
    })

    // ImageManager → CanvasEngine
    this.imageManager.onChange(() => {
      this.canvasEngine.setImages(this.imageManager.getAllImages())
    })
    this.imageManager.onSelectionChange((id: string | null) => {
      this.canvasEngine.setSelectedImageId(id)
    })

    // Cuando el engine renderiza, podemos actualizar si es necesario
    this.canvasEngine.onChange(() => {
      // No hacer nada especial, el engine se ocupa
    })

    // Sincronizar zoom entre Zoom class y CanvasEngine
    this.zoom.onChange((level: number) => {
      const camera = this.canvasEngine.getCamera()
      const format = this.currentFormat
      const factor = level / camera.zoom
      const centerX = this.canvas.clientWidth / 2
      const centerY = this.canvas.clientHeight / 2
      this.canvasEngine.zoomAtPoint(factor - 1, centerX, centerY)
      this.statusBar.setZoom(level * 100)
    })

    // Cambio de modo → actualizar status bar y cursor
    this.modeManager.onModeChange((mode) => {
      this.statusBar.setMode(mode)
      const container = document.getElementById('canvas-container')!
      container.className = `mode-${mode}`
    })

    // Cambio de herramienta
    this.modeManager.onToolChange(() => {
      // El toolbar se actualiza solo
    })

    // Opacidad
    this.opacityControl.onChange((opacity: number) => {
      this.applyOpacity(opacity)
    })

    // Click-through
    this.clickThrough.onChange((active: boolean) => {
      this.inputHandler.setEnabled(!active)
    })

    // Suavizado de trazo
    this.toolbar.onSmoothChange((level: SmoothLevel) => {
      this.canvasEngine.setSmoothLevel(level)
    })

    // Exportación
    this.toolbar.onExport((format: string) => {
      this.handleExport(format as 'svg' | 'html')
    })

    // Orientación (Landscape toggle) — rota el contenido 90°
    this.toolbar.onOrientationChange((isLandscape: boolean) => {
      this.isLandscape = isLandscape
      const current = this.currentFormat
      const oldW = current.widthMm
      const oldH = current.heightMm
      const swapped: PaperFormat = { ...current, widthMm: oldH, heightMm: oldW }
      this.currentFormat = swapped
      this.canvasEngine.setFormat(swapped)

      // Rotar todos los strokes 90°: (x, y) → (y, oldW - x)
      const strokes = this.strokeManager.getAllStrokes()
      if (strokes.length > 0) {
        const rotated = JSON.parse(JSON.stringify(strokes))
        for (const stroke of rotated) {
          for (const pt of stroke.points) {
            const ox = pt.x
            const oy = pt.y
            pt.x = oy
            pt.y = oldW - ox
          }
        }
        this.strokeManager.fromStrokeDataArray(rotated)
      }

      // Re-centrar la cámara
      const camera = this.canvasEngine.getCamera()
      this.canvasEngine.setCamera({ ...camera })
    })

    // Lienzo libre
    this.toolbar.onFreeCanvasToggle(() => this.toggleFreeCanvas())

    // Hoja transparente
    this.toolbar.onTransparentToggle((active: boolean) => {
      this.canvasEngine.setTransparentPaper(active)
    })

    // Limpiar todo
    this.toolbar.onClearAll(() => {
      this.strokeManager.fromStrokeDataArray([])
      this.imageManager.fromImageDataArray([])
    })

    // Abrir proyecto
    this.toolbar.onOpenProject(async () => {
      const data = await openProject()
      if (data) {
        this.strokeManager.fromStrokeDataArray(data.strokes)
        this.imageManager.fromImageDataArray(data.images)
        if (data.paperFormat) {
          try {
            const format = getFormat(data.paperFormat)
            this.currentFormat = format
            this.canvasEngine.setFormat(format)
            this.formatSelector.setFormat(format.id)
            this.statusBar.setFormat(format.id)
          } catch {}
        }
      }
    })
  }

  private async loadSavedData(): Promise<void> {
    const data = await loadNote()
    if (data) {
      // Restaurar trazos
      this.strokeManager.fromStrokeDataArray(data.strokes)

      // Restaurar imágenes
      if (data.images) {
        this.imageManager.fromImageDataArray(data.images)
      }

      // Restaurar formato
      if (data.paperFormat === 'free') {
        this.isFreeCanvasMode = true
      }
      this.currentFormat = getFormat(data.paperFormat || 'a4')
      this.formatSelector.setFormat(this.currentFormat.id)

      // Restaurar cámara
      this.canvasEngine.setCamera(data.camera || { zoom: 1.0, offsetX: 0, offsetY: 0 })

      // Restaurar herramienta y modo
      if (data.activeMode) this.modeManager.setMode(data.activeMode as any)
      if (data.activeTool) this.modeManager.setTool(data.activeTool as any)

      // Restaurar tema
      if (data.theme === 'light') this.themeManager.setTheme(true)

      // Restaurar opacidad
      if (data.opacity !== undefined) {
        this.opacityControl.setOpacity(data.opacity)
        this.applyOpacity(data.opacity)
      }

      // Sincronizar zoom display
      const camera = this.canvasEngine.getCamera()
      this.zoom.zoomTo(camera.zoom)
    }

    // Asegurar que el engine tenga los trazos actuales
    this.canvasEngine.setFormat(this.currentFormat)
    this.canvasEngine.setStrokes(this.strokeManager.getAllStrokes())
  }

  private async adjustWindowToFormat(): Promise<void> {
    try {
      const { getCurrentWindow, LogicalSize } = await import('@tauri-apps/api/window')
      const win = getCurrentWindow()
      const screenW = window.screen.availWidth
      const screenH = window.screen.availHeight
      const { windowWidth, windowHeight, initialZoom } = calculateInitialWindowSize(
        screenW,
        screenH,
        this.currentFormat
      )
      await win.setSize(new LogicalSize(windowWidth, windowHeight))
      await win.center()
      this.zoom.zoomTo(initialZoom)
      this.canvasEngine.setCamera({ zoom: initialZoom, offsetX: 0, offsetY: 0 })
    } catch {
      // Modo navegador, usar tamaño fijo
      this.canvasEngine.setCamera({ zoom: 1.0, offsetX: 50, offsetY: 50 })
    }
  }

  private async handleFormatChange(format: PaperFormat): Promise<void> {
    const oldFormat = this.currentFormat
    if (oldFormat.id === format.id) return

    // Escalar trazos al nuevo formato
    const strokes = this.strokeManager.getAllStrokes()
    if (strokes.length > 0) {
      const scaled = scaleStrokesToFormat(strokes, oldFormat, format)
      const centered = centerStrokesInFormat(scaled, format)
      this.strokeManager.fromStrokeDataArray(
        centered.map((s: Stroke) => ({
          id: s.id,
          tool: s.tool,
          color: s.color,
          width: s.width,
          opacity: s.opacity,
          points: s.points.map((p: StrokePoint) => ({ x: p.x, y: p.y, pressure: p.pressure })),
        }))
      )
    }

    this.currentFormat = format
    this.canvasEngine.setFormat(format)
    this.statusBar.setFormat(format.id)
  }

  private handleExport(format: 'svg' | 'html'): void {
    const strokes = this.strokeManager.getAllStrokes()
    exportToFile(format, strokes, this.imageManager.getAllImages(), this.currentFormat)
  }

  /**
   * Alterna entre modo lienzo libre y modo hoja normal
   */
  private async toggleFreeCanvas(): Promise<void> {
    if (!this.isFreeCanvasMode) {
      // Entrar en modo libre
      this.isFreeCanvasMode = true
      const freeFormat = getFormat('free')
      this.currentFormat = freeFormat
      this.canvasEngine.setFormat(freeFormat)
      this.canvasEngine.setCamera({ zoom: 1.0, offsetX: 50, offsetY: 50 })
      this.statusBar.setFormat('LIBRE')
    } else {
      // Salir de modo libre - mostrar preview
      const strokes = this.strokeManager.getAllStrokes()
      if (strokes.length === 0) {
        // No hay contenido, solo volver al formato que estaba
        this.isFreeCanvasMode = false
        const defaultFormat = getFormat('a4')
        this.currentFormat = defaultFormat
        this.canvasEngine.setFormat(defaultFormat)
        this.statusBar.setFormat(defaultFormat.id)
        return
      }

      const { showOrientationModal } = await import('./components/orientation-preview')
      showOrientationModal(strokes, (choice: any) => {
        this.isFreeCanvasMode = false
        let targetFormat = choice.format
        if (choice.orientation === 'landscape') {
          targetFormat = { ...targetFormat, widthMm: targetFormat.heightMm, heightMm: targetFormat.widthMm }
        }

        // Escalar y centrar los strokes del lienzo libre (3000mm) al formato elegido
        const freeFormat = getFormat('free')
        const scaled = scaleStrokesToFormat(strokes, freeFormat, targetFormat)
        const centered = centerStrokesInFormat(scaled, targetFormat)
        this.strokeManager.fromStrokeDataArray(
          centered.map((s: Stroke) => ({
            id: s.id,
            tool: s.tool,
            color: s.color,
            width: s.width,
            opacity: s.opacity,
            points: s.points.map((p: StrokePoint) => ({ x: p.x, y: p.y, pressure: p.pressure })),
          }))
        )

        this.currentFormat = targetFormat
        this.canvasEngine.setFormat(targetFormat)
        this.canvasEngine.setCamera({ zoom: 1.0, offsetX: 50, offsetY: 50 })

        this.statusBar.setFormat(targetFormat.id)
        this.formatSelector.setFormat(targetFormat.id)
      })
    }
  }

  private async handlePaste(e: ClipboardEvent): Promise<void> {
    if ((e.target as HTMLElement)?.tagName === 'INPUT' ||
        (e.target as HTMLElement)?.tagName === 'TEXTAREA') return

    const items = e.clipboardData?.items
    if (!items) return

    for (const item of items) {
      if (!item.type.startsWith('image/')) continue
      const blob = item.getAsFile()
      if (!blob) continue

      e.preventDefault()

      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = reject
        reader.readAsDataURL(blob)
      })

      const compressed = await this.compressImage(dataUrl, 1920)

      const dims = await new Promise<{ w: number; h: number }>((resolve) => {
        const img = new Image()
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight })
        img.src = compressed
      })

      const logicalSize = this.canvasEngine.getLogicalSize()
      const camera = this.canvasEngine.getCamera()
      const scene = this.canvasEngine.viewToScene(logicalSize.width / 2, logicalSize.height / 2)

      const maxViewDim = Math.min(logicalSize.width, logicalSize.height) * 0.6
      const mmPerPx = 1 / (this.MM_TO_PX * camera.zoom)
      const maxMm = maxViewDim * mmPerPx
      const aspectRatio = dims.w / dims.h
      let displayW: number, displayH: number
      if (aspectRatio >= 1) {
        displayW = Math.min(maxMm, dims.w * mmPerPx)
        displayH = displayW / aspectRatio
      } else {
        displayH = Math.min(maxMm, dims.h * mmPerPx)
        displayW = displayH * aspectRatio
      }

      this.imageManager.addImage(compressed, scene.x, scene.y, displayW, displayH, dims.w, dims.h)
      break
    }
  }

  private compressImage(dataUrl: string, maxDim: number): Promise<string> {
    return new Promise((resolve) => {
      const img = new Image()
      img.onload = () => {
        let w = img.naturalWidth, h = img.naturalHeight
        if (w <= maxDim && h <= maxDim) { resolve(dataUrl); return }
        const scale = maxDim / Math.max(w, h)
        w = Math.round(w * scale); h = Math.round(h * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        const ctx = canvas.getContext('2d')!
        ctx.drawImage(img, 0, 0, w, h)
        const isPng = dataUrl.startsWith('data:image/png')
        resolve(canvas.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.85))
      }
      img.src = dataUrl
    })
  }

  private applyOpacity(opacity: number): void {
    document.documentElement.style.setProperty('--window-opacity', opacity.toString())
    const app = document.getElementById('app')
    if (app) {
      app.style.opacity = opacity.toString()
    }
  }

  private syncZoomFromEngine(): void {
    const camera = this.canvasEngine.getCamera()
    this.zoom.zoomTo(camera.zoom)
  }

  private syncAllUI(): void {
    this.statusBar.setMode(this.modeManager.getMode())
    this.statusBar.setFormat(this.currentFormat.id)
    this.statusBar.setStrokeCount(this.strokeManager.getAllStrokes().length)
    const camera = this.canvasEngine.getCamera()
    this.statusBar.setZoom(camera.zoom * 100)
  }

  private async autoSave(): Promise<void> {
    const data: BoardNoteData = {
      strokes: this.strokeManager.toStrokeDataArray(),
      images: this.imageManager.toImageDataArray(),
      camera: this.canvasEngine.getCamera(),
      theme: document.body.classList.contains('light-theme') ? 'light' : 'dark',
      opacity: parseFloat(
        (document.getElementById('opacity-slider') as HTMLInputElement)?.value || '1.0'
      ),
      paperFormat: this.currentFormat.id,
      activeMode: this.modeManager.getMode(),
      activeTool: this.modeManager.getTool(),
      activeColor: this.toolbar.getActiveColor(),
      strokeWidth: this.toolbar.getActiveWidth(),
    }
    await saveNote(data)
  }

  private setupWindowControls(): void {
    const minimizeBtn = document.getElementById('btn-minimize')
    const closeBtn = document.getElementById('btn-close')

    minimizeBtn?.addEventListener('click', async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().minimize()
      } catch { /* Modo navegador */ }
    })

    closeBtn?.addEventListener('click', async () => {
      await this.autoSave()
      try {
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('exit_app')
      } catch {
        window.close()
      }
    })
  }

  destroy(): void {
    clearInterval(this.saveInterval)
    this.inputHandler.destroy()
    this.canvasEngine.destroy()
  }
}

// Iniciar aplicación cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  new App()
})
