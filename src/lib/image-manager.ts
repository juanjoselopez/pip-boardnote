import type { CanvasImage, CanvasImageData } from '../types/strokes'

export class ImageManager {
  private images: CanvasImage[] = []
  private undoStack: CanvasImage[][] = []
  private redoStack: CanvasImage[][] = []
  private readonly maxHistory = 50
  private selectedId: string | null = null

  private changeListeners: Array<() => void> = []
  private selectionListeners: Array<(id: string | null) => void> = []
  private undoRedoListeners: Array<(canUndo: boolean, canRedo: boolean) => void> = []

  addImage(dataUrl: string, x: number, y: number, w: number, h: number, natW: number, natH: number): CanvasImage {
    this.pushHistory()

    const image: CanvasImage = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      x,
      y,
      width: w,
      height: h,
      dataUrl,
      naturalWidth: natW,
      naturalHeight: natH
    }

    this.images.push(image)
    this.notifyChange()
    this.notifyUndoRedo()
    return image
  }

  removeImage(id: string): void {
    const index = this.images.findIndex(img => img.id === id)
    if (index === -1) return

    this.pushHistory()
    this.images.splice(index, 1)

    if (this.selectedId === id) {
      this.select(null)
    }

    this.notifyChange()
    this.notifyUndoRedo()
  }

  moveImage(id: string, dxMm: number, dyMm: number): void {
    const image = this.images.find(img => img.id === id)
    if (!image) return

    this.pushHistory()
    image.x += dxMm
    image.y += dyMm

    this.notifyChange()
    this.notifyUndoRedo()
  }

  resizeImage(id: string, newW: number, newH: number, newX: number, newY: number): void {
    const image = this.images.find(img => img.id === id)
    if (!image) return

    this.pushHistory()
    image.width = newW
    image.height = newH
    image.x = newX
    image.y = newY

    this.notifyChange()
    this.notifyUndoRedo()
  }

  getImage(id: string): CanvasImage | undefined {
    return this.images.find(img => img.id === id)
  }

  getAllImages(): CanvasImage[] {
    return this.images
  }

  select(id: string | null): void {
    if (this.selectedId === id) return
    this.selectedId = id
    this.notifySelection()
  }

  getSelectedId(): string | null {
    return this.selectedId
  }

  deleteSelected(): void {
    if (this.selectedId === null) return
    this.removeImage(this.selectedId)
  }

  clearAll(): void {
    if (this.images.length === 0) return
    this.pushHistory()
    this.images = []
    if (this.selectedId !== null) {
      this.selectedId = null
      this.notifySelection()
    }
    this.notifyChange()
    this.notifyUndoRedo()
  }

  undo(): void {
    if (!this.canUndo()) return

    this.redoStack.push(JSON.parse(JSON.stringify(this.images)))
    this.images = this.undoStack.pop()!
    this.selectedId = null

    this.notifyChange()
    this.notifySelection()
    this.notifyUndoRedo()
  }

  redo(): void {
    if (!this.canRedo()) return

    this.undoStack.push(JSON.parse(JSON.stringify(this.images)))
    this.images = this.redoStack.pop()!
    this.selectedId = null

    this.notifyChange()
    this.notifySelection()
    this.notifyUndoRedo()
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  toImageDataArray(): CanvasImageData[] {
    return this.images.map(img => ({
      id: img.id,
      x: img.x,
      y: img.y,
      width: img.width,
      height: img.height,
      dataUrl: img.dataUrl,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    }))
  }

  fromImageDataArray(data: CanvasImageData[]): void {
    this.pushHistory()

    this.images = data.map(d => ({
      id: d.id,
      x: d.x,
      y: d.y,
      width: d.width,
      height: d.height,
      dataUrl: d.dataUrl,
      naturalWidth: d.naturalWidth,
      naturalHeight: d.naturalHeight
    }))

    this.selectedId = null
    this.notifyChange()
    this.notifyUndoRedo()
    this.notifySelection()
  }

  onChange(fn: () => void): void {
    this.changeListeners.push(fn)
  }

  onSelectionChange(fn: (id: string | null) => void): void {
    this.selectionListeners.push(fn)
  }

  onUndoRedoChange(fn: (canUndo: boolean, canRedo: boolean) => void): void {
    this.undoRedoListeners.push(fn)
  }

  private pushHistory(): void {
    this.undoStack.push(JSON.parse(JSON.stringify(this.images)))

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift()
    }

    this.redoStack = []
  }

  private notifyChange(): void {
    for (const fn of this.changeListeners) {
      fn()
    }
  }

  private notifySelection(): void {
    for (const fn of this.selectionListeners) {
      fn(this.selectedId)
    }
  }

  private notifyUndoRedo(): void {
    for (const fn of this.undoRedoListeners) {
      fn(this.canUndo(), this.canRedo())
    }
  }
}
