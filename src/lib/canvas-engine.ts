/**
 * Motor de renderizado del canvas
 * Maneja el sistema de coordenadas, renderiza hoja, trazos y estado de cámara
 */
import type { Stroke, CameraState, PaperFormat, CanvasImage, HandleCorner } from '../types/strokes'
import type { SmoothLevel } from './stroke-smoother'
import { smoothStrokePoints } from './stroke-smoother'
import { MIN_ZOOM, MAX_ZOOM } from './zoom'

const MM_TO_PX = 3.779527559

export class CanvasEngine {
  private canvas: HTMLCanvasElement
  private ctx: CanvasRenderingContext2D
  private logicalWidth = 0
  private logicalHeight = 0
  private format: PaperFormat = { id: 'a4', name: 'A4', widthMm: 210, heightMm: 297 }
  private strokes: Stroke[] = []
  private selectedIds: string[] = []
  private camera: CameraState = { zoom: 1.0, offsetX: 0, offsetY: 0 }
  private smoothLevel: SmoothLevel = 'high'
  private dirty = true
  private rafId: number | null = null
  private resizeObserver: ResizeObserver | null = null
  private listeners: Array<() => void> = []

  private images: CanvasImage[] = []
  private imageCache: Map<string, HTMLImageElement> = new Map()
  private selectedImageId: string | null = null
  private selectionRect: { x1: number; y1: number; x2: number; y2: number } | null = null
  private transparentPaper = false
  private currentStroke: Stroke | null = null

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    this.ctx = canvas.getContext('2d')!
    this.resizeObserver = new ResizeObserver(() => this.handleResize())
    this.resizeObserver.observe(canvas.parentElement ?? canvas)
    this.handleResize()
    this.scheduleRender()
  }

  private handleResize(): void {
    const parent = this.canvas.parentElement
    if (!parent) return
    const rect = parent.getBoundingClientRect()
    const dpr = window.devicePixelRatio || 1
    this.logicalWidth = rect.width
    this.logicalHeight = rect.height
    this.canvas.width = rect.width * dpr
    this.canvas.height = rect.height * dpr
    this.canvas.style.width = `${rect.width}px`
    this.canvas.style.height = `${rect.height}px`
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    this.dirty = true
    this.scheduleRender()
  }

  setFormat(format: PaperFormat): void {
    this.format = format
    this.dirty = true
    this.scheduleRender()
  }

  setStrokes(strokes: Stroke[]): void {
    this.strokes = strokes
    this.dirty = true
    this.scheduleRender()
  }

  setImages(images: CanvasImage[]): void {
    this.images = images
    this.dirty = true
    this.scheduleRender()
  }

  setSelectedIds(ids: string[]): void {
    this.selectedIds = ids
    this.dirty = true
    this.scheduleRender()
  }

  setSelectedImageId(id: string | null): void {
    this.selectedImageId = id
    this.dirty = true
    this.scheduleRender()
  }

  getLogicalSize(): { width: number; height: number } {
    return { width: this.logicalWidth, height: this.logicalHeight }
  }

  setTransparentPaper(active: boolean): void {
    this.transparentPaper = active
    this.dirty = true
    this.scheduleRender()
  }

  setCurrentStroke(tool: string, color: string, width: number, points: { x: number; y: number; pressure: number }[]): void {
    if (points.length < 2) {
      this.currentStroke = null
    } else {
      this.currentStroke = { id: '', tool: tool as any, color, width, opacity: tool === 'highlighter' ? 0.4 : 1, points }
    }
    this.dirty = true
    this.scheduleRender()
  }

  setSelectionRect(rect: { x1: number; y1: number; x2: number; y2: number } | null): void {
    this.selectionRect = rect
    this.dirty = true
    this.scheduleRender()
  }

  setSmoothLevel(level: SmoothLevel): void {
    this.smoothLevel = level
    this.dirty = true
    this.scheduleRender()
  }

  setCamera(camera: CameraState): void {
    this.camera = { ...camera }
    this.dirty = true
    this.scheduleRender()
  }

  getCamera(): CameraState {
    return { ...this.camera }
  }

  pan(dxPx: number, dyPx: number): void {
    this.camera.offsetX += dxPx
    this.camera.offsetY += dyPx
    this.dirty = true
    this.scheduleRender()
  }

  zoomAtPoint(zoomDelta: number, viewX: number, viewY: number): void {
    const { zoom, offsetX, offsetY } = this.camera
    const sceneX = (viewX - offsetX) / (MM_TO_PX * zoom)
    const sceneY = (viewY - offsetY) / (MM_TO_PX * zoom)
    const factor = 1 + zoomDelta
    let newZoom = zoom * factor
    newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, newZoom))
    this.camera.zoom = newZoom
    this.camera.offsetX = viewX - sceneX * MM_TO_PX * newZoom
    this.camera.offsetY = viewY - sceneY * MM_TO_PX * newZoom
    this.dirty = true
    this.scheduleRender()
  }

  viewToScene(viewX: number, viewY: number): { x: number; y: number } {
    const { zoom, offsetX, offsetY } = this.camera
    return {
      x: (viewX - offsetX) / (MM_TO_PX * zoom),
      y: (viewY - offsetY) / (MM_TO_PX * zoom),
    }
  }

  sceneToView(sceneX: number, sceneY: number): { x: number; y: number } {
    const { zoom, offsetX, offsetY } = this.camera
    return {
      x: sceneX * MM_TO_PX * zoom + offsetX,
      y: sceneY * MM_TO_PX * zoom + offsetY,
    }
  }

  hitTestImage(viewX: number, viewY: number): CanvasImage | null {
    const scene = this.viewToScene(viewX, viewY)

    for (let i = this.images.length - 1; i >= 0; i--) {
      const img = this.images[i]
      const left = img.x - img.width / 2
      const right = img.x + img.width / 2
      const top = img.y - img.height / 2
      const bottom = img.y + img.height / 2

      if (scene.x >= left && scene.x <= right && scene.y >= top && scene.y <= bottom) {
        return img
      }
    }

    return null
  }

  hitTestImageHandle(viewX: number, viewY: number): { image: CanvasImage; corner: HandleCorner } | null {
    if (this.selectedImageId === null) return null

    const img = this.images.find(i => i.id === this.selectedImageId)
    if (!img) return null

    const corners: HandleCorner[] = ['tl', 'tr', 'bl', 'br']
    const halfW = img.width / 2
    const halfH = img.height / 2
    const cornersMm: { corner: HandleCorner; x: number; y: number }[] = [
      { corner: 'tl', x: img.x - halfW, y: img.y - halfH },
      { corner: 'tr', x: img.x + halfW, y: img.y - halfH },
      { corner: 'bl', x: img.x - halfW, y: img.y + halfH },
      { corner: 'br', x: img.x + halfW, y: img.y + halfH },
    ]

    const hitRadiusPx = 12

    for (const c of cornersMm) {
      const v = this.sceneToView(c.x, c.y)
      const dx = viewX - v.x
      const dy = viewY - v.y
      if (Math.sqrt(dx * dx + dy * dy) <= hitRadiusPx) {
        return { image: img, corner: c.corner }
      }
    }

    return null
  }

  private scheduleRender(): void {
    if (this.rafId !== null) return
    this.rafId = requestAnimationFrame(() => {
      this.rafId = null
      if (this.dirty) this.render()
    })
  }

  render(): void {
    this.dirty = false
    const ctx = this.ctx
    const { zoom, offsetX, offsetY } = this.camera

    ctx.clearRect(0, 0, this.logicalWidth, this.logicalHeight)

    const isFreeCanvas = this.format.id === 'free'

    if (isFreeCanvas) {
      // Modo lienzo libre: pintar todo el viewport de blanco
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, this.logicalWidth, this.logicalHeight)
    } else {
      const pw = this.format.widthMm * MM_TO_PX * zoom
      const ph = this.format.heightMm * MM_TO_PX * zoom
      const px = offsetX
      const py = offsetY
      const radius = 2

      if (this.transparentPaper) {
        // Modo hoja transparente: solo borde punteado, sin relleno
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)'
        ctx.lineWidth = 2
        ctx.setLineDash([6, 4])
        this.roundRect(ctx, px, py, pw, ph, radius)
        ctx.stroke()
        ctx.setLineDash([])
      } else {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.1)'
        this.roundRect(ctx, px + 3, py + 3, pw, ph, radius)
        ctx.fill()

        ctx.fillStyle = '#ffffff'
        this.roundRect(ctx, px, py, pw, ph, radius)
        ctx.fill()

        const marginPx = 25.4 * MM_TO_PX * zoom
        ctx.strokeStyle = '#e0e0e0'
        ctx.lineWidth = 0.5
        ctx.strokeRect(px + marginPx, py + marginPx, pw - 2 * marginPx, ph - 2 * marginPx)

        const gridPx = 10 * MM_TO_PX * zoom
        ctx.strokeStyle = '#f0f0f0'
        ctx.lineWidth = 0.5
        for (let gx = px + gridPx; gx < px + pw; gx += gridPx) {
          ctx.beginPath()
          ctx.moveTo(gx, py)
          ctx.lineTo(gx, py + ph)
          ctx.stroke()
        }
        for (let gy = py + gridPx; gy < py + ph; gy += gridPx) {
          ctx.beginPath()
          ctx.moveTo(px, gy)
          ctx.lineTo(px + pw, gy)
          ctx.stroke()
        }
      }
    }

    for (const img of this.images) {
      const left = img.x - img.width / 2
      const top = img.y - img.height / 2
      const right = img.x + img.width / 2
      const bottom = img.y + img.height / 2

      const tl = this.sceneToView(left, top)
      const br = this.sceneToView(right, bottom)
      const viewW = br.x - tl.x
      const viewH = br.y - tl.y

      if (tl.x + viewW < 0 || tl.y + viewH < 0 || tl.x > this.logicalWidth || tl.y > this.logicalHeight) continue

      let imgEl = this.imageCache.get(img.id)
      if (!imgEl) {
        imgEl = new Image()
        imgEl.src = img.dataUrl
        this.imageCache.set(img.id, imgEl)
      }

      ctx.drawImage(imgEl, tl.x, tl.y, viewW, viewH)
    }

    for (const stroke of this.strokes) {
      const renderPoints = smoothStrokePoints(stroke.points, this.smoothLevel)
      if (renderPoints.length < 2) continue
      const alpha = stroke.tool === 'highlighter' ? 0.4 : stroke.opacity
      ctx.strokeStyle = stroke.color
      ctx.lineWidth = stroke.width * MM_TO_PX * zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = alpha

      ctx.beginPath()
      const first = renderPoints[0]
      const start = this.sceneToView(first.x, first.y)
      ctx.moveTo(start.x, start.y)
      for (let i = 1; i < renderPoints.length; i++) {
        const pt = renderPoints[i]
        const v = this.sceneToView(pt.x, pt.y)
        ctx.lineTo(v.x, v.y)
      }
      ctx.stroke()
    }
    // Dibujar trazo en-progreso (mientras se dibuja, antes de soltar el mouse)
    if (this.currentStroke && this.currentStroke.points.length >= 2) {
      const alpha = this.currentStroke.tool === 'highlighter' ? 0.4 : 1
      ctx.strokeStyle = this.currentStroke.color
      ctx.lineWidth = this.currentStroke.width * MM_TO_PX * zoom
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.globalAlpha = alpha

      ctx.beginPath()
      const p0 = this.sceneToView(this.currentStroke.points[0].x, this.currentStroke.points[0].y)
      ctx.moveTo(p0.x, p0.y)
      for (let i = 1; i < this.currentStroke.points.length; i++) {
        const v = this.sceneToView(this.currentStroke.points[i].x, this.currentStroke.points[i].y)
        ctx.lineTo(v.x, v.y)
      }
      ctx.stroke()
    }

    ctx.globalAlpha = 1

    // Dibujar rectángulo de selección por área (lasso)
    if (this.selectionRect) {
      const { x1, y1, x2, y2 } = this.selectionRect
      const v1 = this.sceneToView(x1, y1)
      const v2 = this.sceneToView(x2, y2)
      ctx.strokeStyle = '#3b82f6'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 4])
      ctx.fillStyle = 'rgba(59, 130, 246, 0.08)'
      ctx.fillRect(v1.x, v1.y, v2.x - v1.x, v2.y - v1.y)
      ctx.strokeRect(v1.x, v1.y, v2.x - v1.x, v2.y - v1.y)
      ctx.setLineDash([])
    }

    for (const selId of this.selectedIds) {
      const selected = this.strokes.find(s => s.id === selId)
      if (selected && selected.points.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
        for (const pt of selected.points) {
          const v = this.sceneToView(pt.x, pt.y)
          if (v.x < minX) minX = v.x
          if (v.y < minY) minY = v.y
          if (v.x > maxX) maxX = v.x
          if (v.y > maxY) maxY = v.y
        }
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 3])
        ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8)
        ctx.setLineDash([])
      }
    }

    if (this.selectedImageId !== null) {
      const img = this.images.find(i => i.id === this.selectedImageId)
      if (img) {
        const left = img.x - img.width / 2
        const top = img.y - img.height / 2
        const right = img.x + img.width / 2
        const bottom = img.y + img.height / 2

        const tl = this.sceneToView(left, top)
        const br = this.sceneToView(right, bottom)
        const viewW = br.x - tl.x
        const viewH = br.y - tl.y

        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5
        ctx.setLineDash([5, 3])
        ctx.strokeRect(tl.x, tl.y, viewW, viewH)
        ctx.setLineDash([])

        const handleSize = 8
        const corners = [
          { x: tl.x, y: tl.y },
          { x: br.x, y: tl.y },
          { x: tl.x, y: br.y },
          { x: br.x, y: br.y },
        ]

        ctx.fillStyle = '#ffffff'
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 1.5
        for (const c of corners) {
          ctx.fillRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize)
          ctx.strokeRect(c.x - handleSize / 2, c.y - handleSize / 2, handleSize, handleSize)
        }
      }
    }

    this.listeners.forEach(fn => fn())
  }

  private roundRect(
    ctx: CanvasRenderingContext2D,
    x: number, y: number, w: number, h: number, r: number
  ): void {
    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + w - r, y)
    ctx.quadraticCurveTo(x + w, y, x + w, y + r)
    ctx.lineTo(x + w, y + h - r)
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
    ctx.lineTo(x + r, y + h)
    ctx.quadraticCurveTo(x, y + h, x, y + h - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  }

  onChange(fn: () => void): void {
    this.listeners.push(fn)
  }

  destroy(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
    this.resizeObserver?.disconnect()
    this.resizeObserver = null
    this.listeners = []
    this.imageCache.clear()
  }
}
