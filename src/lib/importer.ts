/**
 * Importación de proyectos desde archivos HTML/JSON
 */
import type { StrokeData } from '../types/strokes'
import type { CanvasImageData } from '../types/strokes'

export interface ImportedData {
  strokes: StrokeData[]
  images: CanvasImageData[]
  paperFormat?: string
}

/**
 * Abre un diálogo nativo para seleccionar archivo
 * Soporta .html y .json
 * HTML: parsea SVG inline extrayendo paths y data URIs
 * JSON: deserializa directamente
 */
export async function openProject(): Promise<ImportedData | null> {
  try {
    const { open } = await import('@tauri-apps/plugin-dialog')
    const filePath = await open({
      filters: [
        { name: 'Proyectos', extensions: ['html', 'json'] },
        { name: 'HTML', extensions: ['html'] },
        { name: 'JSON', extensions: ['json'] },
      ],
      multiple: false,
    })
    if (!filePath) return null

    const { invoke } = await import('@tauri-apps/api/core')
    const content = await invoke<string>('read_file_at_path', { path: filePath })

    const ext = filePath.split('.').pop()?.toLowerCase()
    if (ext === 'json') {
      return JSON.parse(content) as ImportedData
    } else if (ext === 'html') {
      return parseHtmlProject(content)
    }
    return null
  } catch (err) {
    console.error('Error al abrir proyecto:', err)
    return null
  }
}

/**
 * Parsea HTML exportado (con SVG inline) para extraer strokes e imágenes
 */
function parseHtmlProject(html: string): ImportedData | null {
  // Crear DOMParser para parsear el HTML
  const parser = new DOMParser()
  const doc = parser.parseFromString(html, 'text/html')

  const strokes: StrokeData[] = []
  const images: CanvasImageData[] = []

  // Extraer strokes: buscar elementos <path> dentro de <svg>
  const paths = doc.querySelectorAll('svg path')
  paths.forEach((path) => {
    const d = path.getAttribute('d')
    const strokeColor = path.getAttribute('stroke') || '#000000'
    const strokeWidth = parseFloat(path.getAttribute('stroke-width') || '1')
    const opacity = parseFloat(path.getAttribute('opacity') || '1')
    if (!d) return

    // Parsear path data: soporta "M 10,20" y "M10,20"
    const points: { x: number; y: number; pressure: number }[] = []
    const parts = d.trim().split(/\s+/)
    for (let i = 0; i < parts.length; i++) {
      const token = parts[i]
      if (token === 'M' || token === 'L') {
        const coord = parts[i + 1]
        if (coord) {
          const [x, y] = coord.split(',')
          const nx = parseFloat(x)
          const ny = parseFloat(y)
          if (!isNaN(nx) && !isNaN(ny)) {
            points.push({ x: nx, y: ny, pressure: 1 })
            i++
          }
        }
      } else if (token.startsWith('M') || token.startsWith('L')) {
        const coord = token.substring(1)
        const [x, y] = coord.split(',')
        const nx = parseFloat(x)
        const ny = parseFloat(y)
        if (!isNaN(nx) && !isNaN(ny)) {
          points.push({ x: nx, y: ny, pressure: 1 })
        }
      }
    }

    if (points.length >= 2) {
      strokes.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        tool: opacity < 1 ? 'highlighter' : 'pen',
        color: strokeColor,
        width: strokeWidth,
        opacity,
        points,
      })
    }
  })

  // Extraer imágenes: buscar <image> dentro de <svg>
  const imagesElements = doc.querySelectorAll('svg image')
  imagesElements.forEach((img) => {
    const href = img.getAttribute('href')
    const x = parseFloat(img.getAttribute('x') || '0')
    const y = parseFloat(img.getAttribute('y') || '0')
    const width = parseFloat(img.getAttribute('width') || '100')
    const height = parseFloat(img.getAttribute('height') || '100')
    if (href && href.startsWith('data:')) {
      images.push({
        id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
        x: x + width / 2,
        y: y + height / 2,
        width,
        height,
        dataUrl: href,
        naturalWidth: 0,
        naturalHeight: 0,
      })
    }
  })

  // Intentar extraer formato del tamaño del SVG viewBox
  const svg = doc.querySelector('svg')
  let paperFormat: string | undefined
  if (svg) {
    const viewBox = svg.getAttribute('viewBox')
    if (viewBox) {
      const [, , w, h] = viewBox.split(/\s+/).map(Number)
      // Determinar formato aproximado por dimensiones
      if (w === 210 && h === 297) paperFormat = 'a4'
      else if (w === 297 && h === 210) paperFormat = 'a4'
      else if (Math.abs(w - 215.9) < 1 && Math.abs(h - 279.4) < 1) paperFormat = 'letter'
    }
  }

  return { strokes, images, paperFormat }
}
