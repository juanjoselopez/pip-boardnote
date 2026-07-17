import type { Stroke, StrokePoint, ToolType } from '../types/strokes'

export class StrokeManager {
  private strokes: Stroke[] = []
  private undoStack: Stroke[][] = []
  private redoStack: Stroke[][] = []
  private readonly maxHistory = 50
  private selectedIds: Set<string> = new Set()

  private changeListeners: Array<() => void> = []
  private selectionListeners: Array<(firstId: string | null) => void> = []
  private undoRedoListeners: Array<(canUndo: boolean, canRedo: boolean) => void> = []

  onChange(fn: () => void): void {
    this.changeListeners.push(fn)
  }

  onSelectionChange(fn: (firstId: string | null) => void): void {
    this.selectionListeners.push(fn)
  }

  onUndoRedoChange(fn: (canUndo: boolean, canRedo: boolean) => void): void {
    this.undoRedoListeners.push(fn)
  }

  getAllStrokes(): Stroke[] {
    return this.strokes
  }

  getSelectedIds(): string[] {
    return Array.from(this.selectedIds)
  }

  addStroke(tool: ToolType, color: string, width: number, points: StrokePoint[], alpha?: number): Stroke {
    this.pushHistory()

    let opacity = alpha !== undefined ? alpha : 1.0
    if (tool === 'highlighter') opacity = (alpha !== undefined ? alpha : 1.0) * 0.4
    if (tool === 'eraser') opacity = 0.8

    const stroke: Stroke = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
      tool,
      color,
      width,
      opacity,
      points
    }

    this.strokes.push(stroke)
    this.notifyChange()
    this.notifyUndoRedo()
    return stroke
  }

  removeStroke(id: string): void {
    const index = this.strokes.findIndex(s => s.id === id)
    if (index === -1) return

    this.pushHistory()
    this.strokes.splice(index, 1)

    this.selectedIds.delete(id)

    this.notifyChange()
    this.notifyUndoRedo()
    this.notifySelection()
  }

  updateStrokeStyle(id: string, color?: string, width?: number): void {
    const stroke = this.strokes.find(s => s.id === id)
    if (!stroke) return

    this.pushHistory()

    if (color !== undefined) stroke.color = color
    if (width !== undefined) stroke.width = width

    this.notifyChange()
    this.notifyUndoRedo()
  }

  getStroke(id: string): Stroke | undefined {
    return this.strokes.find(s => s.id === id)
  }

  select(id: string | null): void {
    this.selectedIds.clear()
    if (id !== null) this.selectedIds.add(id)
    this.notifySelection()
  }

  selectMultiple(ids: string[]): void {
    this.selectedIds.clear()
    for (const id of ids) {
      this.selectedIds.add(id)
    }
    this.notifySelection()
  }

  getStrokesInRect(x1: number, y1: number, x2: number, y2: number): string[] {
    const result: string[] = []
    for (const stroke of this.strokes) {
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
      for (const pt of stroke.points) {
        if (pt.x < minX) minX = pt.x
        if (pt.y < minY) minY = pt.y
        if (pt.x > maxX) maxX = pt.x
        if (pt.y > maxY) maxY = pt.y
      }
      if (minX <= x2 && maxX >= x1 && minY <= y2 && maxY >= y1) {
        result.push(stroke.id)
      }
    }
    return result
  }

  getStrokeAtPoint(x: number, y: number): Stroke | null {
    const tolerance = 2

    for (let i = this.strokes.length - 1; i >= 0; i--) {
      const stroke = this.strokes[i]
      for (const point of stroke.points) {
        const dx = point.x - x
        const dy = point.y - y
        if (Math.sqrt(dx * dx + dy * dy) <= tolerance) {
          return stroke
        }
      }
    }

    return null
  }

  canUndo(): boolean {
    return this.undoStack.length > 0
  }

  canRedo(): boolean {
    return this.redoStack.length > 0
  }

  undo(): void {
    if (!this.canUndo()) return

    this.redoStack.push(JSON.parse(JSON.stringify(this.strokes)))
    this.strokes = this.undoStack.pop()!

    this.notifyChange()
    this.notifyUndoRedo()
  }

  redo(): void {
    if (!this.canRedo()) return

    this.undoStack.push(JSON.parse(JSON.stringify(this.strokes)))
    this.strokes = this.redoStack.pop()!

    this.notifyChange()
    this.notifyUndoRedo()
  }

  private pushHistory(): void {
    this.undoStack.push(JSON.parse(JSON.stringify(this.strokes)))

    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift()
    }

    this.redoStack = []
  }

  moveSelected(dxMm: number, dyMm: number): void {
    if (this.selectedIds.size === 0) return

    this.pushHistory()

    for (const stroke of this.strokes) {
      if (this.selectedIds.has(stroke.id)) {
        for (const point of stroke.points) {
          point.x += dxMm
          point.y += dyMm
        }
      }
    }

    this.notifyChange()
    this.notifyUndoRedo()
  }

  deleteSelected(): void {
    if (this.selectedIds.size === 0) return

    const idsToDelete = Array.from(this.selectedIds)
    this.selectedIds.clear()

    this.pushHistory()

    for (const id of idsToDelete) {
      const index = this.strokes.findIndex(s => s.id === id)
      if (index !== -1) this.strokes.splice(index, 1)
    }

    this.notifyChange()
    this.notifyUndoRedo()
    this.notifySelection()
  }

  toStrokeDataArray(): { id: string; tool: string; color: string; width: number; opacity: number; points: { x: number; y: number; pressure: number }[] }[] {
    return this.strokes.map(s => ({
      id: s.id,
      tool: s.tool,
      color: s.color,
      width: s.width,
      opacity: s.opacity,
      points: s.points.map(p => ({ x: p.x, y: p.y, pressure: p.pressure }))
    }))
  }

  fromStrokeDataArray(data: any[]): void {
    this.pushHistory()

    this.strokes = data.map(d => ({
      id: d.id,
      tool: d.tool as ToolType,
      color: d.color,
      width: d.width,
      opacity: d.opacity,
      points: d.points.map((p: any) => ({ x: p.x, y: p.y, pressure: p.pressure }))
    }))

    this.selectedIds.clear()
    this.notifyChange()
    this.notifyUndoRedo()
    this.notifySelection()
  }

  private notifyChange(): void {
    for (const fn of this.changeListeners) {
      fn()
    }
  }

  private notifySelection(): void {
    const firstId = this.selectedIds.size > 0 ? Array.from(this.selectedIds)[0] : null
    for (const fn of this.selectionListeners) {
      fn(firstId)
    }
  }

  private notifyUndoRedo(): void {
    for (const fn of this.undoRedoListeners) {
      fn(this.canUndo(), this.canRedo())
    }
  }
}
