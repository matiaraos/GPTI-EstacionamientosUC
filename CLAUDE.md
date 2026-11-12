# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Contexto

MiEstacionamientoUC gestiona estacionamientos del Campus San Joaquín (UC). La prioridad del MVP es una demo móvil: cuenta ficticia, destino y permanencia, reserva diaria de una plaza regular y entrada/salida por QR. El trabajo se organiza por tramos en [docs/specs/README.md](docs/specs/README.md), que también registra el estado y la evidencia de cada tramo. La UI, los mensajes de error, la documentación y los commits se escriben en español (commits en tercera persona: «Agrega…», «Documenta…»).

## Skills

Las skills viven en `.agents/skills/` (compartidas con Codex) y `.claude/skills` es un enlace simbólico a esa carpeta, así que Claude Code las carga como skills nativas (por ejemplo `/implementar-spec` o la herramienta Skill con `expo-overview`). Edítalas siempre en `.agents/skills/`. [SKILLS.md](SKILLS.md) indica cuándo usar cada una. Si falta una skill o un plugin que facilite el trabajo, propónlo o agrégalo. Para implementar un tramo, sigue [implementar-spec](.agents/skills/implementar-spec/SKILL.md): leer entrega, aceptación y dependencias; verificar desde el punto de entrada real; actualizar solo la fila del tramo con `En curso` o `Verificada` y la evidencia.

## Comandos

Node 22 (`>=22.12 <23`, ver `.nvmrc`; ejecutar `nvm use`), npm workspaces. Desde la raíz:

```bash
npm ci
docker compose up -d --wait db      # PostgreSQL 16 en 127.0.0.1:5433
npm run db:deploy                   # aplica migraciones
npm run dev:api                     # API en :3000 (tsx watch)
npm run dev:admin                   # panel en :5173
npm run dev:mobile                  # Metro para la dev build (no Expo Go)
npm run typecheck                   # todos los workspaces
npm test                            # Jest de la API (compila antes; requiere la base levantada)
npm run build
npm run db:migrate                  # nueva migración tras cambiar schema.prisma
```

- Una sola prueba: `npm test -w @miestacionamientouc/api -- -t "nombre del test"` o `-- test/health.test.js`.
- Las pruebas usan la base `estacionamientos_test` (o `TEST_DATABASE_URL`), que `test/helpers/global-setup.js` crea y migra automáticamente; `resetDatabase(db)` de `test/helpers/db.js` vacía las tablas entre casos. Los datos de desarrollo no se tocan.
- Los `.env` se crean desde los `.env.example` de cada app. Móvil usa `EXPO_PUBLIC_API_URL` (`10.0.2.2` en emulador Android, `localhost` en simulador iOS, IP LAN en dispositivo); el panel usa `VITE_API_URL`; la API usa `DATABASE_URL`, `ADMIN_ORIGIN` y opcionalmente `DIRECT_URL` para migrar.
- Compilación móvil: `npx expo run:android` / `npx expo run:ios` desde `apps/mobile`. Chequeo de bundles igual que CI: `npx expo export --platform android --platform ios` en `apps/mobile`.
- No hay linter configurado. CI (`.github/workflows/ci.yml`) ejecuta typecheck, tests, build del panel, export móvil y comprueba que `/ready` pasa de 503 a 200 al migrar.
- Carga: `k6 run tests/load/readiness.js` (requiere API local migrada).

## Arquitectura

- **API (`apps/api`)** · Express 5, ESM con `module: NodeNext` (imports relativos con extensión `.js`). `src/app.ts` exporta `createApp({ config, db, clock?, checkDatabase? })`: las dependencias se inyectan para que las pruebas usen la base de pruebas y un reloj fijo. `src/server.ts` lee la configuración validada (`src/config.ts`), crea la base (`src/lib/prisma.ts`) y arranca. Los errores se lanzan como `HttpError` (`src/lib/errors.ts`, respuesta `{ error: { code, message, details? } }` en español) y la entrada se valida con `parseInput(schemaZod, datos)` (`src/lib/validation.ts`). Cada área nueva va en `src/modules/<área>/`. Prisma 7 usa driver adapter (`@prisma/adapter-pg`); la URL de conexión vive en `prisma.config.ts`, no en `schema.prisma`. El cliente se genera en `src/generated/prisma` (ignorado por git); `dev`, `build` y `typecheck` ejecutan `prisma generate` primero. Las pruebas son `.js` en `test/` que importan desde `dist/` con supertest, por eso `npm test` compila antes.
- **Sesiones** · Token opaco `Bearer`; la base guarda solo su hash SHA-256 en `Sesion` (revocable al cerrar sesión). `requiereSesion(db, clock)` y `requiereRol("admin")` en `src/modules/cuentas/sesiones.ts` protegen las rutas; `sesionDe(response)` entrega `{ cuentaId, rol }`. Correo y patente se normalizan con `src/modules/cuentas/normalizacion.ts`.
- **Móvil (`apps/mobile`)** · Expo SDK 55 + Expo Router, alias `@/` → `src/`. Las rutas en `src/app` solo reexportan pantallas de `src/screens` (archivos en kebab-case). `src/app/_layout.tsx` espera a leer el token de `expo-secure-store` y separa rutas con `Stack.Protected` (`(app)` con sesión; `iniciar-sesion` y `registro` sin ella). Red con `apiRequest` (`src/api/client.ts`, `expo/fetch`, `ApiError` con `details` por campo) y TanStack Query; un 401 cierra la sesión (`src/session/session-provider.tsx`). Tema único en `src/theme` (colores semánticos con `Color` de `expo-router`) y componentes en `src/components` (`Button`, `TextField`, `Notice`, `FormScreen`, `ThemedText`): las pantallas no definen colores ni tamaños propios.
- **Panel (`apps/admin`)** · React 19 + Vite + `react-router` + TanStack Query. Sesión en `sessionStorage` (`src/session.tsx`), solo para cuentas `admin`; páginas en `src/pages`, tokens CSS en `src/styles.css`. `vercel.json` reescribe las rutas a `index.html`.
- **Datos geográficos (`docs/campus-san-joaquin`)** · `catalogo.geojson` (salas, edificios, 10 bloques `PARKING-0..9` y accesos vehiculares `PARKING-10..19`, que no son reservables) y `distancias.csv` (sala–bloque con `metros`, `metodo` = `peatonal`/`linea_recta`, calidad de conexión y `orden`). `generar.py` regenera CSV y mapa. Cada bloque se modela como una zona y sus plazas heredan su cercanía.
- **Modelo de datos** · [docs/modelo-datos](docs/modelo-datos/README.md) propone las entidades por tramo; hoy el esquema solo tiene `ParkingZone`. Reglas clave: instantes en `timestamptz`, horas locales en `America/Santiago`, intervalos `[inicio, fin)`, restricciones de exclusión por plaza, cuenta y vehículo, clave de idempotencia por solicitud, y transiciones de estado con su evento en la misma transacción. La API es la autoridad sobre permisos, disponibilidad y estados.
- **Asignación** · Ordena bloques elegibles por cercanía al destino: primero distancias peatonales, luego línea recta, por metros y desempate por ID de bloque (detalle en [04-reservas.md](docs/specs/04-reservas.md)).

## Verificación de tramos

Conflictos de reserva y reintentos se prueban contra PostgreSQL real; flujos móviles en emulador o dispositivo. Exportar bundles acredita compilación, no el flujo. Registrar por separado los chequeos de compilación y las pruebas del flujo, y lo que queda pendiente para el piloto.
