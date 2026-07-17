/**
 * Modal de previsualización para elegir orientación al salir del modo libre
 */
import type { Stroke, PaperFormat } from '../types/strokes'
import { PAPER_FORMATS } from '../lib/paper-formats'

const MM_TO_PX = 3.779527559

export interface OrientationChoice {
  format: PaperFormat
  orientation: 'portrait' | 'landscape'
}

/**
 * Renderiza trazos en un canvas de preview escalado
 */
function renderPreview(
  canvas: HTMLCanvasElement,
  strokes: Stroke[],
  widthMm: number,
  heightMm: number
): void {
  const ctx = canvas.getContext('2d')!
  const dpr = window.devicePixelRatio || 1
  const w = canvas.clientWidth * dpr
  const h = canvas.clientHeight * dpr
  canvas.width = w
  canvas.height = h
  ctx.scale(dpr, dpr)

  const cw = canvas.clientWidth
  const ch = canvas.clientHeight
  const padding = 20

  // Escalar para que el contenido quepa en el preview
  const scaleX = (cw - padding * 2) / (widthMm * MM_TO_PX)
  const scaleY = (ch - padding * 2) / (heightMm * MM_TO_PX)
  const scale = Math.min(scaleX, scaleY)

  const paperPxW = widthMm * MM_TO_PX * scale
  const paperPxH = heightMm * MM_TO_PX * scale
  const offsetX = (cw - paperPxW) / 2
  const offsetY = (ch - paperPxH) / 2

  // Fondo blanco de la hoja
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(offsetX, offsetY, paperPxW, paperPxH)

  // Borde de la hoja
  ctx.strokeStyle = '#cccccc'
  ctx.lineWidth = 0.5
  ctx.strokeRect(offsetX, offsetY, paperPxW, paperPxH)

  // Dibujar trazos escalados
  for (const stroke of strokes) {
    if (stroke.points.length < 2) continue
    const alpha = stroke.tool === 'highlighter' ? 0.4 : stroke.opacity
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = Math.max(0.5, stroke.width * MM_TO_PX * scale)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.globalAlpha = alpha

    ctx.beginPath()
    const first = stroke.points[0]
    ctx.moveTo(
      offsetX + first.x * MM_TO_PX * scale,
      offsetY + first.y * MM_TO_PX * scale
    )
    for (let i = 1; i < stroke.points.length; i++) {
      const pt = stroke.points[i]
      ctx.lineTo(
        offsetX + pt.x * MM_TO_PX * scale,
        offsetY + pt.y * MM_TO_PX * scale
      )
    }
    ctx.stroke()
  }
  ctx.globalAlpha = 1
}

/**
 * Muestra un modal para que el usuario elija orientación de hoja
 */
export function showOrientationModal(
  strokes: Stroke[],
  onChoose: (choice: OrientationChoice) => void
): void {
  // Eliminar modal existente si lo hay
  const existing = document.getElementById('orientation-modal-overlay')
  if (existing) existing.remove()

  const formatA4 = PAPER_FORMATS.find(f => f.id === 'a4')!
  const portraitW = formatA4.widthMm
  const portraitH = formatA4.heightMm

  const overlay = document.createElement('div')
  overlay.id = 'orientation-modal-overlay'
  overlay.style.cssText = `
    position: fixed; top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0,0,0,0.5); z-index: 10000;
    display: flex; flex-direction: column; align-items: center;
    justify-content: center; font-family: system-ui, sans-serif;
  `

  const container = document.createElement('div')
  container.style.cssText = `
    background: #2a2a2a; border-radius: 12px; padding: 32px;
    box-shadow: 0 8px 32px rgba(0,0,0,0.4);
    display: flex; flex-direction: column; align-items: center; gap: 24px;
  `

  const title = document.createElement('h2')
  title.textContent = 'Selecciona orientación de hoja'
  title.style.cssText = `
    color: #ffffff; margin: 0; font-size: 18px; font-weight: 600;
  `
  container.appendChild(title)

  const cardsContainer = document.createElement('div')
  cardsContainer.style.cssText = `
    display: flex; gap: 24px; flex-wrap: wrap; justify-content: center;
  `

  // Card vertical
  const cardPortrait = createOrientationCard(
    'Usar vertical',
    strokes,
    portraitW,
    portraitH
  )
  cardPortrait.addEventListener('click', () => {
    overlay.remove()
    onChoose({ format: formatA4, orientation: 'portrait' })
  })

  // Card horizontal
  const cardLandscape = createOrientationCard(
    'Usar horizontal',
    strokes,
    portraitH,
    portraitW
  )
  cardLandscape.addEventListener('click', () => {
    overlay.remove()
    onChoose({ format: formatA4, orientation: 'landscape' })
  })

  cardsContainer.appendChild(cardPortrait)
  cardsContainer.appendChild(cardLandscape)
  container.appendChild(cardsContainer)

  const cancelBtn = document.createElement('button')
  cancelBtn.textContent = 'Cancelar'
  cancelBtn.style.cssText = `
    background: #444; color: #fff; border: none; border-radius: 6px;
    padding: 8px 24px; font-size: 14px; cursor: pointer;
  `
  cancelBtn.addEventListener('click', () => {
    overlay.remove()
    onChoose({ format: formatA4, orientation: 'portrait' })
  })
  container.appendChild(cancelBtn)

  overlay.appendChild(container)
  document.body.appendChild(overlay)
}

function createOrientationCard(
  label: string,
  strokes: Stroke[],
  widthMm: number,
  heightMm: number
): HTMLElement {
  const card = document.createElement('div')
  card.style.cssText = `
    display: flex; flex-direction: column; align-items: center;
    gap: 12px; cursor: pointer; border-radius: 8px;
    padding: 12px; transition: background 0.2s;
  `
  card.addEventListener('mouseenter', () => {
    card.style.background = 'rgba(255,255,255,0.1)'
  })
  card.addEventListener('mouseleave', () => {
    card.style.background = 'transparent'
  })

  const canvas = document.createElement('canvas')
  canvas.width = 300
  canvas.height = 200
  canvas.style.cssText = `
    width: 300px; height: 200px; border-radius: 6px;
    border: 1px solid #555;
  `

  // Renderizar trazos después de agregar al DOM
  requestAnimationFrame(() => {
    renderPreview(canvas, strokes, widthMm, heightMm)
  })

  card.appendChild(canvas)

  const btn = document.createElement('button')
  btn.textContent = label
  btn.style.cssText = `
    background: #3b82f6; color: #fff; border: none; border-radius: 6px;
    padding: 8px 20px; font-size: 13px; cursor: pointer; font-weight: 500;
  `
  card.appendChild(btn)

  return card
}
