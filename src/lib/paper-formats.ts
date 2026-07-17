/**
 * Formatos de hoja estándar y utilidades de transformación de coordenadas
 */
import type { PaperFormat } from '../types/strokes'

const MM_TO_PX = 3.779527559

/** Lista completa de formatos disponibles */
export const PAPER_FORMATS: PaperFormat[] = [
  { id: 'free',   name: 'Libre',    widthMm: 3000,  heightMm: 3000 },
  { id: 'a4',     name: 'A4',       widthMm: 210,   heightMm: 297   },
  { id: 'letter', name: 'Letter',   widthMm: 215.9, heightMm: 279.4 },
  { id: 'a5',     name: 'A5',       widthMm: 148,   heightMm: 210   },
  { id: 'legal',  name: 'Legal',    widthMm: 215.9, heightMm: 355.6 },
  { id: 'a6',     name: 'A6',       widthMm: 105,   heightMm: 148   },
  { id: 'b5',     name: 'B5',       widthMm: 176,   heightMm: 250   },
]

/** Buscar formato por su id */
export function getFormat(id: string): PaperFormat {
  const format = PAPER_FORMATS.find((f) => f.id === id)
  if (!format) throw new Error(`Formato desconocido: ${id}`)
  return format
}

/** Convertir milímetros a píxeles (96 DPI) */
export function mmToPixels(mm: number, zoom: number = 1): number {
  return mm * MM_TO_PX * zoom
}

/** Convertir coordenadas de escena (mm) a píxeles del canvas */
export function sceneToView(
  sceneX: number, sceneY: number,
  zoom: number, offsetX: number, offsetY: number
): { x: number; y: number } {
  return {
    x: sceneX * MM_TO_PX * zoom + offsetX,
    y: sceneY * MM_TO_PX * zoom + offsetY,
  }
}

/** Convertir píxeles del canvas a coordenadas de escena (mm) */
export function viewToScene(
  viewX: number, viewY: number,
  zoom: number, offsetX: number, offsetY: number
): { x: number; y: number } {
  return {
    x: (viewX - offsetX) / (MM_TO_PX * zoom),
    y: (viewY - offsetY) / (MM_TO_PX * zoom),
  }
}

/** Calcular tamaño de ventana inicial para que la hoja ocupe ~75% de la pantalla */
export function calculateInitialWindowSize(
  screenWidthPx: number, screenHeightPx: number, format: PaperFormat
): { windowWidth: number; windowHeight: number; initialZoom: number } {
  const windowWidth = Math.round(screenWidthPx * 0.75)
  const windowHeight = Math.round(screenHeightPx * 0.75)

  const padding = 0.85
  const paperWidthPx = format.widthMm * MM_TO_PX
  const paperHeightPx = format.heightMm * MM_TO_PX

  const zoomX = (windowWidth * padding) / paperWidthPx
  const zoomY = (windowHeight * padding) / paperHeightPx
  const initialZoom = Math.min(zoomX, zoomY)

  return { windowWidth, windowHeight, initialZoom }
}
