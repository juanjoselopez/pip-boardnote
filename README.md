<p align="center">
  <img src="screenshots/hero.png" alt="PiP BoardNote en acción" width="700"/>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/versión-0.1.0-89b4fa?style=flat-square" />
  <img src="https://img.shields.io/badge/licencia-MIT-green?style=flat-square" />
  <img src="https://img.shields.io/badge/plataforma-Windows-lightgrey?style=flat-square" />
  <img src="https://img.shields.io/badge/Tauri-2.x-ffc131?style=flat-square" />
</p>

# PiP BoardNote

Cuaderno de notas manuscritas **Picture-in-Picture** para tomar apuntes con lápiz óptico o tableta gráfica sobre cualquier contenido en pantalla.

## 🎯 Caso de uso principal

Estás viendo un video de YouTube o una clase online y necesitas resolver ejercicios **sobre el mismo video**. PiP BoardNote flota siempre encima, con transparencia ajustable, permitiéndote escribir y dibujar sin cambiar de ventana.

## ✨ Características

- **Always-on-top** — flota sobre cualquier ventana, incluso fullscreen
- **Transparencia ajustable** — slider de opacidad para ver el contenido detrás
- **3 modos de interacción** — Dibujo, Selección (individual y por área), Mano/Desplazamiento
- **Lápiz con presión** — grosor variable según la presión del lápiz óptico
- **Resaltador y borrador** — herramientas completas para notas
- **Selector de color HSL** — color hex + transparencia alpha con preview en tiempo real
- **Suavizado de trazo** — Catmull-Rom spline con 4 niveles (Recto/Bajo/Medio/Alto)
- **Zoom ajustable** — zoom con rueda del ratón, centrado en el cursor
- **Formatos de hoja** — A4, Carta, A5, Oficio, A6, B5 (vertical y horizontal)
- **Lienzo libre** — modo infinito sin límites de hoja
- **Click-through** — los clics pasan a través de la ventana
- **Exportación** — SVG y HTML (mantiene trazos vectoriales)
- **Pegado de imágenes** — Ctrl+V pega imágenes redimensionables
- **Selección por área** — arrastra para seleccionar múltiples trazos
- **Undo/Redo** — historial de 50 acciones
- **Autosave** — guarda automáticamente cada 5 segundos
- **System tray** — minimiza a la bandeja del sistema
- **Portable** — no requiere instalación ni permisos de administrador

## 🛠️ Stack tecnológico

| Componente | Tecnología |
|-----------|------------|
| Shell | Tauri 2.x (Rust) |
| Frontend | TypeScript + Vite |
| Lienzo | HTML5 Canvas API |
| Input | Pointer Events (presión de lápiz) |
| Ventana PiP | WS_EX_TOPMOST, transparent, skipTaskbar |

## 📦 Instalación

Descarga el ejecutable desde [Releases](https://github.com/juanjoselopez/pip-boardnote/releases) o compílalo tú mismo:

```bash
pnpm install
pnpm tauri build
```

El `.exe` portátil estará en `src-tauri/target/release/pip-boardnote.exe`.

## ⌨️ Atajos de teclado

| Atajo | Acción |
|-------|--------|
| `D` | Modo dibujo |
| `S` | Modo selección |
| `H` | Modo mano/desplazamiento |
| `Espacio` | Mano temporal (mantener) |
| `Ctrl+Z` | Deshacer |
| `Ctrl+Y` | Rehacer |
| `Ctrl+=` / `Ctrl+-` | Acercar / Alejar |
| `Ctrl+0` | Restablecer zoom |
| `Ctrl+O` | Abrir proyecto (.html, .json) |
| `Supr` / `Backspace` | Eliminar seleccionado |
| `Ctrl+Shift+K` | Activar/Desactivar click-through |
| `Ctrl+T` | Ocultar/Mostrar toolbar |

## 🚀 Desarrollo

```bash
# Instalar dependencias
pnpm install

# Modo desarrollo (hot-reload)
pnpm tauri dev

# Compilar release
pnpm tauri build

# Firmar el ejecutable (requiere certificado en build/pip-cert.pfx)
pnpm sign
```

## 📄 Licencia

MIT
