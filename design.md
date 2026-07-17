# Design Document - PiP BoardNote

## Visión General
PiP BoardNote es un cuaderno de notas manuscritas flotante tipo Picture-in-Picture. Permite tomar notas con lápiz óptico sobre cualquier contenido en pantalla (videos, PDFs, clases) manteniendo transparencia ajustable y formato de hoja estándar.

## Principios de Diseño
1. **Portabilidad**: Único .exe, sin instalación, sin permisos admin
2. **Siempre visible**: Always-on-top sobre cualquier aplicación
3. **Transparencia**: Opacidad ajustable para ver contenido detrás
4. **Formato real**: La hoja simula formato de papel estándar (A4, Carta, etc.)
5. **Sin fricción**: Abrir y empezar a escribir inmediatamente

## Modos de Interacción

### Modo Dibujo (Draw)
- Herramientas: Lápiz, Resaltador, Borrador
- Lápiz: trazos con presión, color y grosor seleccionables
- Resaltador: trazos semitransparentes con grosor fijo
- Borrador: elimina trazos completos al hacer clic sobre ellos
- Atajo: `D`

### Modo Selección (Select)
- Clic en un trazo → bounding box + selección
- Arrastrar trazo seleccionado → moverlo
- Supr → eliminar trazo
- Cambiar color/grosor → aplicar al trazo seleccionado
- Atajo: `S`

### Modo Mano (Hand/Pan)
- Arrastrar → desplazar el lienzo (pan)
- Scroll → zoom hacia el cursor
- No dibuja ni selecciona
- Atajo: `H` o Space (temporal)

## Formatos de Hoja Soportados

| Formato | Ancho (mm) | Alto (mm) | Aspect Ratio |
|---------|-----------|-----------|--------------|
| A4 | 210 | 297 | 1:1.414 |
| Carta (Letter) | 215.9 | 279.4 | 1:1.294 |
| A5 | 148 | 210 | 1:1.419 |
| Oficio (Legal) | 215.9 | 355.6 | 1:1.647 |
| A6 | 105 | 148 | 1:1.410 |
| B5 | 176 | 250 | 1:1.421 |

Al cambiar de formato, el contenido se escala proporcionalmente (scale-to-fit).

## Zoom
- Rango: 20% - 400%
- Paso: 10% con botones, continuo con scroll
- Anchor: hacia el cursor (zoom under cursor)
- Display: porcentaje en toolbar y status bar

## Exportación
- **PDF vectorial**: Trazos como paths nativos, tamaño de hoja exacto para impresión
- **SVG**: Trazos como `<path>` editables en Inkscape/Illustrator
- **HTML+SVG inline**: Documento autocontenido para visualizar en navegador

## Persistencia
- Formato: JSON en `$APPDATA/com.pipboardnote/notes/current.json`
- Contenido: Array de trazos serializados + estado de zoom/pan/tema/opacidad
- Autosave: cada 5 segundos + al perder foco la ventana
- Carga automática al iniciar

## Arquitectura de Capas (Renderizado)

```
Canvas HTML (viewport en píxeles)
  └─ Transformación: scale + translate
      └─ Escena (coordenadas en mm)
          └─ Hoja (fondo blanco con sombra, dimensión del formato activo)
              └─ Trazos (paths vectoriales)
                  └─ Selección (bounding box overlay)
```

## Diseño de UI

### Titlebar
- Sin decoraciones de Windows
- Arrastre con click en titlebar
- Botones: colapsar toolbar, minimizar, cerrar

### Toolbar
- Selector de modo (Dibujo/Selección/Mano)
- Selector de herramienta (Lápiz/Resaltador/Borrador)
- Deshacer/Rehacer
- Selector de color y grosor
- Selector de formato de hoja
- Control de zoom
- Tema claro/oscuro
- Click-through toggle
- Exportar (PDF/SVG/HTML)

### Canvas Area
- Ocupa todo el espacio restante
- Hoja centrada con sombra
- Márgenes opcionales (estilo cuaderno/cuadrícula)

### Status Bar
- Indicador de modo activo
- Formato de hoja actual
- Nivel de zoom
- Contador de trazos
- Indicador PiP y click-through
- Slider de opacidad
