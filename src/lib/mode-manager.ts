/**
 * Gestión de modos de interacción y herramienta activa del canvas
 */
import type { ModeType, ToolType } from '../types/strokes'

export class ModeManager {
  private _mode: ModeType = 'draw'
  private _tool: ToolType = 'pen'
  private modeListeners: Array<(mode: ModeType) => void> = []
  private toolListeners: Array<(tool: ToolType) => void> = []

  getMode(): ModeType {
    return this._mode
  }

  setMode(mode: ModeType): void {
    if (this._mode === mode) return
    this._mode = mode
    for (const fn of this.modeListeners) {
      fn(mode)
    }
  }

  getTool(): ToolType {
    return this._tool
  }

  setTool(tool: ToolType): void {
    if (this._tool === tool) return
    this._tool = tool
    for (const fn of this.toolListeners) {
      fn(tool)
    }
  }

  onModeChange(fn: (mode: ModeType) => void): void {
    this.modeListeners.push(fn)
  }

  onToolChange(fn: (tool: ToolType) => void): void {
    this.toolListeners.push(fn)
  }
}
