/**
 * Exportación del canvas a SVG y HTML+SVG inline
 * Todos los trazos se almacenan en coordenadas de escena (milímetros)
 */
import type { Stroke, PaperFormat, CanvasImage } from '../types/strokes'
import { save } from '@tauri-apps/plugin-dialog'

/** Construir datos de path SVG a partir de los trazos: "M x0,y0 L x1,y1 L x2,y2 ..." */
function strokesToSvgPathData(strokes: Stroke[]): string[] {
  return strokes.map((stroke) => {
    if (stroke.points.length < 2) return ''
    return stroke.points.map((p, i) => {
      const cmd = i === 0 ? 'M' : 'L'
      return `${cmd}${p.x},${p.y}`
    }).join(' ')
  })
}

/** Convertir un array de strokes a string de elementos <path> SVG */
function strokesToSvgElements(strokes: Stroke[]): string {
  const paths = strokesToSvgPathData(strokes)
  return strokes
    .map((stroke, i) => {
      const d = paths[i]
      if (!d) return ''
      const alpha = stroke.tool === 'highlighter' ? 0.4 : stroke.opacity
      return `<path d="${d}" stroke="${stroke.color}" stroke-width="${stroke.width}" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="${alpha}" />`
    })
    .filter(Boolean)
    .join('\n    ')
}

function imagesToSvgElements(images: CanvasImage[]): string {
  return images.map(img => {
    const x = img.x - img.width / 2
    const y = img.y - img.height / 2
    return `<image href="${img.dataUrl}" x="${x}" y="${y}" width="${img.width}" height="${img.height}" preserveAspectRatio="none" />`
  }).join('\n    ')
}

/** Generar string SVG completo */
function exportToSvg(strokes: Stroke[], images: CanvasImage[], paperFormat: PaperFormat): string {
  const { widthMm, heightMm } = paperFormat
  const paths = strokesToSvgElements(strokes)
  const imgs = imagesToSvgElements(images)
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${widthMm}mm" height="${heightMm}mm" viewBox="0 0 ${widthMm} ${heightMm}">
  <rect width="100%" height="100%" fill="white" />
    ${imgs}
    ${paths}
</svg>`
}

/** Generar string HTML autocontenido con SVG inline */
function exportToHtml(strokes: Stroke[], images: CanvasImage[], paperFormat: PaperFormat): string {
  const { widthMm, heightMm } = paperFormat
  const svgContent = exportToSvg(strokes, images, paperFormat)
  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>PiP BoardNote - Exportación</title>
<style>
  @page { size: ${widthMm}mm ${heightMm}mm; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #f5f5f5; }
  .page { width: ${widthMm}mm; height: ${heightMm}mm; box-shadow: 0 2px 8px rgba(0,0,0,0.15); overflow: hidden; }
</style>
</head>
<body>
<div class="page">
${svgContent}
</div>
</body>
</html>`
}

/**
 * Exportar el contenido actual según el formato seleccionado
 * Abre un diálogo nativo de Tauri para elegir ubicación de guardado
 */
export async function exportToFile(
  format: 'svg' | 'html',
  strokes: Stroke[],
  images: CanvasImage[],
  paperFormat: PaperFormat
): Promise<void> {
  try {
    const { invoke } = await import('@tauri-apps/api/core')

    switch (format) {
      case 'svg': {
        const filePath = await save({ filters: [{ name: 'SVG', extensions: ['svg'] }] })
        if (!filePath) return
        const content = exportToSvg(strokes, images, paperFormat)
        await invoke('write_text_file_at_path', { path: filePath, content })
        break
      }
      case 'html': {
        const filePath = await save({ filters: [{ name: 'HTML', extensions: ['html'] }] })
        if (!filePath) return
        const content = exportToHtml(strokes, images, paperFormat)
        await invoke('write_text_file_at_path', { path: filePath, content })
        break
      }
    }
  } catch (err) {
    console.error('Error al exportar archivo:', err)
  }
}
