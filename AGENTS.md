# AGENTS.md - PiP BoardNote

## Reglas para agentes de desarrollo

1. **Idioma**: Todos los comentarios en el código fuente deben estar en **español**.
2. **Nombres técnicos**: Variables, funciones, clases, archivos en **inglés**.
3. **Estilo**: Composición sobre herencia, patrón observador, lazy-loading.
4. **Tipado estricto**: TypeScript `strict: true`. Definir interfaces en `src/types/`.
5. **Coordenadas**: Todos los trazos y posiciones se almacenan en **milímetros** (mm).
6. **Sin dependencias innecesarias**: Preferir implementaciones nativas.
7. **Testing**: Verificar `pnpm build` y `pnpm tauri build` antes de dar por terminada una tarea.
8. **Commits**: No commitear sin autorización explícita.
9. **Estados de módulo**: Usar getters/setters públicos, eventos observer (`onChange`).

## Arquitectura General

### Sistema de Coordenadas
- Coordenadas de escena: milímetros (mm) - sistema de almacenamiento
- Coordenadas de vista: píxeles del canvas
- Transformación: `vista = escena * zoom + offset`
- Relación: 1mm = 3.7795px a 96 DPI y 100% zoom

### Flujo de Input
```
Pointer Event (canvas)
  → input-handler.ts (captura cruda)
    → mode-manager.ts (decide según modo activo: hand/select/draw)
      → stroke-manager.ts (crear/editar/borrar trazos)
        → canvas-engine.ts (redibujar)
```

### Estructura de Archivos
- `src/lib/`: Lógica de negocio pura, sin dependencias de DOM
- `src/components/`: Componentes UI que interactúan con el DOM
- `src/types/`: Interfaces y tipos compartidos
- `src/main.ts`: Orquestador

## Convenciones de Código

```typescript
// Nombres de interfaces sin prefijo I
interface Stroke { ... }

// Clases con PascalCase
class CanvasEngine { ... }

// Métodos públicos en camelCase
public zoomIn(): void { ... }

// Eventos observer
private listeners: Array<(data: T) => void> = [];
public onChange(fn: (data: T) => void): void { this.listeners.push(fn); }
```
