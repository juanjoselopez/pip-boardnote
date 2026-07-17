/**
 * Persistencia del cuaderno mediante comandos Tauri
 * Basado en pip-notepad/src/lib/storage.ts
 */
import type { BoardNoteData, StrokeData } from '../types/strokes'

const FILENAME = 'current.json'

export async function saveNote(data: BoardNoteData): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('save_note', { filename: FILENAME, data })
  } catch (err) {
    console.error('Error al guardar:', err)
  }
}

export async function loadNote(): Promise<BoardNoteData | null> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    const data = await invoke<BoardNoteData>('load_note', { filename: FILENAME })
    return data
  } catch (err) {
    console.error('Error al cargar:', err)
    return null
  }
}

export function createEmptyData(): BoardNoteData {
  return {
    strokes: [],
    images: [],
    camera: { zoom: 1.0, offsetX: 0, offsetY: 0 },
    theme: 'dark',
    opacity: 1.0,
    paperFormat: 'a4',
    activeMode: 'draw',
    activeTool: 'pen',
    activeColor: '#1e1e2e',
    strokeWidth: 1.0,
  }
}
