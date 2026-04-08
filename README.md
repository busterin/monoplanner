# Mono Planner

Proyecto estilo Trello con listas y tarjetas, pensado para correr en web y empaquetar como app de escritorio (Mac y Windows).

## Funcionalidades incluidas

- Tablero con varias listas
- Tarjetas dentro de cada lista
- Drag & drop de listas
- Drag & drop de tarjetas entre listas
- Crear nuevas listas y tarjetas
- Persistencia local en `localStorage`

## Stack

- React + TypeScript + Vite
- `@dnd-kit` para drag & drop
- Electron para app desktop
- Electron Builder para generar instaladores (`.dmg` y `.exe`)

## Comandos

```bash
npm install
npm run dev:web
```

App web en desarrollo.

```bash
npm run dev:desktop
```

App de escritorio en desarrollo (levanta Vite + Electron).

```bash
npm run build:web
npm run build:desktop
```

Build web y empaquetado desktop.

```bash
npm run build:mac
npm run build:win
```

Builds específicos por plataforma.

## Notas

- El estado se guarda en el navegador/app localmente.
- Para publicar en web puedes desplegar la carpeta `dist/` en Vercel, Netlify o similar.
- El instalador de macOS se genera en `dist/` (por ejemplo `.dmg`).
- Para generar `.exe` de Windows de forma fiable, lo ideal es ejecutar `npm run build:win` desde Windows o CI de Windows.
