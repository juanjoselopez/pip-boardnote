/**
 * Captura eventos del pointer en el canvas y delega según el modo activo
 */
import type { ModeType, ToolType, StrokePoint, HandleCorner } from '../types/strokes'
import { ModeManager } from './mode-manager'

export interface InputHandlerCallbacks {
  onStrokeComplete: (tool: ToolType, color: string, width: number, points: StrokePoint[]) => void
  onStrokeDelete: (id: string) => void
  onStrokeSelect: (id: string | null) => void
  onStrokeMove: (id: string, dx: number, dy: number) => void
  onPan: (dx: number, dy: number) => void
  onZoom: (deltaX: number, deltaY: number, clientX: number, clientY: number) => void
  getActiveColor: () => string
  getActiveWidth: () => number
  viewToScene: (viewX: number, viewY: number) => { x: number; y: number }
  getStrokeAtPoint: (x: number, y: number) => string | null
  onImageMove?: (id: string, dx: number, dy: number) => void
  onImageResize?: (id: string, newW: number, newH: number, newX: number, newY: number) => void
  onImageSelect?: (id: string | null) => void
  hitTestImage?: (viewX: number, viewY: number) => { id: string } | null
  hitTestImageHandle?: (viewX: number, viewY: number) => { id: string; corner: HandleCorner } | null
  getImageById?: (id: string) => { id: string; width: number; height: number; x: number; y: number } | null
  onLassoUpdate?: (x1: number, y1: number, x2: number, y2: number) => void
  onLassoComplete?: (x1: number, y1: number, x2: number, y2: number) => void
  onStrokeUpdate?: (tool: ToolType, color: string, width: number, points: StrokePoint[]) => void
  isSelected?: (id: string) => boolean
}

export class InputHandler {
  private canvas: HTMLCanvasElement
  private modeManager: ModeManager
  private callbacks: InputHandlerCallbacks
  private enabled = true
  private isDrawing = false
  private isDragging = false
  private currentPoints: StrokePoint[] = []
  private currentTool: ToolType = 'pen'
  private currentColor = '#000000'
  private currentWidth = 1
  private selectedId: string | null = null
  private dragStartX = 0
  private dragStartY = 0

  private isResizing = false
  private isMovingImage = false
  private resizeImageId: string | null = null
  private resizeCorner: HandleCorner = 'br'
  private resizeStartPoint = { x: 0, y: 0 }
  private resizeStartImage = { x: 0, y: 0, w: 0, h: 0 }

  private isLassoSelect = false
  private lassoStart = { x: 0, y: 0 }
  private lassoCurrent = { x: 0, y: 0 }

  private onPointerDown: (e: PointerEvent) => void
  private onPointerMove: (e: PointerEvent) => void
  private onPointerUp: (e: PointerEvent) => void
  private onWheel: (e: WheelEvent) => void
  private onContextMenu: (e: Event) => void

  constructor(
    canvas: HTMLCanvasElement,
    modeManager: ModeManager,
    callbacks: InputHandlerCallbacks
  ) {
    this.canvas = canvas
    this.modeManager = modeManager
    this.callbacks = callbacks

    this.onPointerDown = this.handlePointerDown.bind(this)
    this.onPointerMove = this.handlePointerMove.bind(this)
    this.onPointerUp = this.handlePointerUp.bind(this)
    this.onWheel = this.handleWheel.bind(this)
    this.onContextMenu = this.handleContextMenu.bind(this)

    this.canvas.addEventListener('pointerdown', this.onPointerDown)
    this.canvas.addEventListener('wheel', this.onWheel, { passive: false })
    this.canvas.addEventListener('contextmenu', this.onContextMenu)
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled
  }

  destroy(): void {
    this.canvas.removeEventListener('pointerdown', this.onPointerDown)
    this.canvas.removeEventListener('wheel', this.onWheel)
    this.canvas.removeEventListener('contextmenu', this.onContextMenu)
    document.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('pointerup', this.onPointerUp)
  }

  private getCanvasPoint(e: PointerEvent): StrokePoint {
    const rect = this.canvas.getBoundingClientRect()
    const viewX = e.clientX - rect.left
    const viewY = e.clientY - rect.top
    const scene = this.callbacks.viewToScene(viewX, viewY)
    const pressure = Math.min(1, Math.max(0, e.pressure))
    return { x: scene.x, y: scene.y, pressure }
  }

  private handlePointerDown = (e: PointerEvent): void => {
    if (!this.enabled) return

    this.canvas.setPointerCapture(e.pointerId)

    document.addEventListener('pointermove', this.onPointerMove)
    document.addEventListener('pointerup', this.onPointerUp)

    const mode = this.modeManager.getMode()
    const point = this.getCanvasPoint(e)

    if (mode === 'draw') {
      this.isDrawing = true
      this.currentTool = this.modeManager.getTool()
      this.currentColor = this.callbacks.getActiveColor()
      this.currentWidth = this.callbacks.getActiveWidth()
      this.currentPoints = [point]
    } else if (mode === 'select') {
      const rect = this.canvas.getBoundingClientRect()
      const viewX = e.clientX - rect.left
      const viewY = e.clientY - rect.top

      const handleHit = this.callbacks.hitTestImageHandle?.(viewX, viewY)
      if (handleHit) {
        this.isResizing = true
        this.resizeImageId = handleHit.id
        this.resizeCorner = handleHit.corner
        this.resizeStartPoint = { x: point.x, y: point.y }
        const imgInfo = this.callbacks.getImageById?.(handleHit.id)
        if (imgInfo) {
          this.resizeStartImage = { x: imgInfo.x, y: imgInfo.y, w: imgInfo.width, h: imgInfo.height }
        }
        this.callbacks.onImageSelect?.(handleHit.id)
        return
      }

      const imgHit = this.callbacks.hitTestImage?.(viewX, viewY)
      if (imgHit) {
        this.isMovingImage = true
        this.selectedId = imgHit.id
        this.dragStartX = point.x
        this.dragStartY = point.y
        this.callbacks.onImageSelect?.(imgHit.id)
        return
      }

      const hitId = this.callbacks.getStrokeAtPoint(point.x, point.y)
      if (hitId !== null) {
        this.selectedId = hitId
        this.isDragging = true
        this.dragStartX = point.x
        this.dragStartY = point.y
        // No cambiar selección si el trazo ya está seleccionado
        if (!this.callbacks.isSelected?.(hitId)) {
          this.callbacks.onStrokeSelect(hitId)
        }
      } else {
        // Iniciar selección por área (lasso)
        this.isLassoSelect = true
        this.lassoStart = { x: point.x, y: point.y }
        this.lassoCurrent = { x: point.x, y: point.y }
        this.selectedId = null
        this.isDragging = false
        this.callbacks.onStrokeSelect(null)
        this.callbacks.onImageSelect?.(null)
      }
    } else if (mode === 'hand') {
      this.isDragging = true
      this.dragStartX = e.clientX
      this.dragStartY = e.clientY
    }
  }

  private handlePointerMove = (e: PointerEvent): void => {
    if (!this.enabled) return

    const mode = this.modeManager.getMode()

    if (mode === 'draw' && this.isDrawing) {
      const point = this.getCanvasPoint(e)
      this.currentPoints.push(point)
      this.callbacks.onStrokeUpdate?.(this.currentTool, this.currentColor, this.currentWidth, this.currentPoints)
    } else if (mode === 'select' && this.isResizing && this.resizeImageId !== null) {
      const point = this.getCanvasPoint(e)
      const dx = point.x - this.resizeStartPoint.x
      const dy = point.y - this.resizeStartPoint.y
      if (dx !== 0 || dy !== 0) {
        let newW = this.resizeStartImage.w
        let newH = this.resizeStartImage.h
        let newX = this.resizeStartImage.x
        let newY = this.resizeStartImage.y

        if (this.resizeCorner === 'tr' || this.resizeCorner === 'br') {
          newW = this.resizeStartImage.w + dx
        } else {
          newW = this.resizeStartImage.w - dx
          newX = this.resizeStartImage.x + dx / 2
        }

        if (this.resizeCorner === 'bl' || this.resizeCorner === 'br') {
          newH = this.resizeStartImage.h + dy
        } else {
          newH = this.resizeStartImage.h - dy
          newY = this.resizeStartImage.y + dy / 2
        }

        newW = Math.max(5, newW)
        newH = Math.max(5, newH)

        this.callbacks.onImageResize?.(this.resizeImageId, newW, newH, newX, newY)
      }
    } else if (mode === 'select' && this.isMovingImage && this.selectedId !== null) {
      const point = this.getCanvasPoint(e)
      const dx = point.x - this.dragStartX
      const dy = point.y - this.dragStartY
      if (dx !== 0 || dy !== 0) {
        this.callbacks.onImageMove?.(this.selectedId, dx, dy)
        this.dragStartX = point.x
        this.dragStartY = point.y
      }
    } else if (mode === 'select' && this.isLassoSelect) {
      const point = this.getCanvasPoint(e)
      this.lassoCurrent = { x: point.x, y: point.y }
      const x1 = Math.min(this.lassoStart.x, this.lassoCurrent.x)
      const y1 = Math.min(this.lassoStart.y, this.lassoCurrent.y)
      const x2 = Math.max(this.lassoStart.x, this.lassoCurrent.x)
      const y2 = Math.max(this.lassoStart.y, this.lassoCurrent.y)
      this.callbacks.onLassoUpdate?.(x1, y1, x2, y2)
    } else if (mode === 'select' && this.isDragging && this.selectedId !== null) {
      const point = this.getCanvasPoint(e)
      const dx = point.x - this.dragStartX
      const dy = point.y - this.dragStartY
      if (dx !== 0 || dy !== 0) {
        this.callbacks.onStrokeMove(this.selectedId, dx, dy)
        this.dragStartX = point.x
        this.dragStartY = point.y
      }
    } else if (mode === 'hand' && this.isDragging) {
      const dx = e.clientX - this.dragStartX
      const dy = e.clientY - this.dragStartY
      if (dx !== 0 || dy !== 0) {
        this.callbacks.onPan(dx, dy)
        this.dragStartX = e.clientX
        this.dragStartY = e.clientY
      }
    }
  }

  private handlePointerUp = (e: PointerEvent): void => {
    if (!this.enabled) return

    document.removeEventListener('pointermove', this.onPointerMove)
    document.removeEventListener('pointerup', this.onPointerUp)

    const mode = this.modeManager.getMode()

    if (mode === 'draw' && this.isDrawing) {
      this.isDrawing = false

      if (this.currentPoints.length > 0) {
        if (this.currentTool === 'eraser') {
          const erasedIds = new Set<string>()
          for (const point of this.currentPoints) {
            const id = this.callbacks.getStrokeAtPoint(point.x, point.y)
            if (id !== null) {
              erasedIds.add(id)
            }
          }
          for (const id of erasedIds) {
            this.callbacks.onStrokeDelete(id)
          }
        } else {
          let finalWidth = this.currentWidth
          if (this.currentTool === 'highlighter') {
            finalWidth = this.currentWidth * 3
          } else {
            finalWidth = this.currentWidth * (0.3 + 0.7 * this.currentPoints[0].pressure)
          }
          this.callbacks.onStrokeComplete(
            this.currentTool,
            this.currentColor,
            finalWidth,
            this.currentPoints
          )
        }
      }

      this.currentPoints = []
      this.callbacks.onStrokeUpdate?.('pen', '#000000', 0, [])
    }

    if (mode === 'select' && this.isLassoSelect) {
      const x1 = Math.min(this.lassoStart.x, this.lassoCurrent.x)
      const y1 = Math.min(this.lassoStart.y, this.lassoCurrent.y)
      const x2 = Math.max(this.lassoStart.x, this.lassoCurrent.x)
      const y2 = Math.max(this.lassoStart.y, this.lassoCurrent.y)
      if (Math.abs(x2 - x1) > 1 || Math.abs(y2 - y1) > 1) {
        this.callbacks.onLassoComplete?.(x1, y1, x2, y2)
      }
    }

    this.isResizing = false
    this.isMovingImage = false
    this.resizeImageId = null
    this.isLassoSelect = false
    this.isDragging = false
    this.selectedId = null
  }

  private handleWheel = (e: WheelEvent): void => {
    if (!this.enabled || this.isDrawing) return
    e.preventDefault()
    this.callbacks.onZoom(e.deltaX, e.deltaY, e.clientX, e.clientY)
  }

  private handleContextMenu = (e: Event): void => {
    e.preventDefault()
  }
}
