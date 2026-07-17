/** Tipos base para trazos y configuración de PiP BoardNote */

/** Punto de un trazo en coordenadas de escena (mm) */
export interface StrokePoint {
  x: number       // Coordenada X en mm
  y: number       // Coordenada Y en mm
  pressure: number // Presión del lápiz 0.0-1.0
}

/** Trazo individual completo */
export interface Stroke {
  id: string
  tool: ToolType
  color: string   // Color en hex (#rrggbb)
  width: number   // Grosor en mm
  opacity: number // Opacidad 0.1-1.0
  points: StrokePoint[]
}

/** Tipos de herramienta de dibujo */
export type ToolType = 'pen' | 'highlighter' | 'eraser'

/** Modos de interacción del canvas */
export type ModeType = 'draw' | 'select' | 'hand'

/** Definición de un formato de hoja */
export interface PaperFormat {
  id: string
  name: string
  widthMm: number
  heightMm: number
}

/** Estado de cámara (zoom y desplazamiento) */
export interface CameraState {
  zoom: number     // 0.2 - 4.0
  offsetX: number  // Desplazamiento X en píxeles
  offsetY: number  // Desplazamiento Y en píxeles
}

/** Datos completos del cuaderno para persistencia */
export interface BoardNoteData {
  strokes: StrokeData[]
  images: CanvasImageData[]
  camera: CameraState
  theme: string
  opacity: number
  paperFormat: string
  activeMode: string
  activeTool: string
  activeColor: string
  strokeWidth: number
}

/** Imagen incrustada en el canvas */
export interface CanvasImage {
  id: string
  x: number
  y: number
  width: number
  height: number
  dataUrl: string
  naturalWidth: number
  naturalHeight: number
}

/** Versión serializable de CanvasImage (idéntica a CanvasImage) */
export interface CanvasImageData {
  id: string
  x: number
  y: number
  width: number
  height: number
  dataUrl: string
  naturalWidth: number
  naturalHeight: number
}

/** Esquinas para handles de redimensionamiento */
export type HandleCorner = 'tl' | 'tr' | 'bl' | 'br'

/** Niveles de suavizado de trazo */
export type SmoothLevel = 'off' | 'low' | 'medium' | 'high'

/** Versión serializable de Stroke (sin funciones) */
export interface StrokeData {
  id: string
  tool: string
  color: string
  width: number
  opacity: number
  points: { x: number; y: number; pressure: number }[]
}
