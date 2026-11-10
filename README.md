# MiEstacionamientoUC

Base del MVP para gestionar estacionamientos del Campus San Joaquín. La app móvil y el panel administrativo tienen una pantalla inicial en español que verifica la conexión con la API y PostgreSQL.

| Ruta | Componente |
| --- | --- |
| `apps/api` | API REST con Express, TypeScript y Prisma 7. Incluye la migración inicial del catálogo de zonas. |
| `apps/admin` | Panel web con React, Vite y TypeScript. |
| `apps/mobile` | App Android e iOS con React Native, Expo SDK 55, Expo Router y TypeScript. |
| `tests/load` | Prueba básica de disponibilidad con k6. |
| `docs/Entregas` | Documentos fuente de las entregas 2 y 3. |

Consulta el [alcance y las decisiones técnicas](docs/alcance.md) para ver la relación entre las entregas y los flujos pendientes. El [índice de specs](docs/specs/README.md) organiza la implementación del MVP por feature.

## Desarrollo local

Se requiere Node.js 22 (mínimo 22.12), npm y Docker Compose. Node 22 reemplaza al Node 20 del reporte, que terminó su ciclo de soporte. Expo SDK 55 admite Android 10 y exige iOS 15.1 como mínimo. [Ciclo de soporte de Node.js](https://nodejs.org/en/about/previous-releases) · [Compatibilidad de Expo SDK 55](https://docs.expo.dev/versions/v55.0.0/#support-for-android-and-ios-versions)

Prepara el entorno desde la raíz del repo.

```bash
nvm use
npm ci
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env
docker compose up -d --wait db
npm run db:deploy
```

En terminales separadas, ejecuta `npm run dev:api` y `npm run dev:admin`. El panel abre en [localhost:5173](http://localhost:5173) y la API escucha en el puerto 3000. `GET /health` comprueba el proceso y `GET /ready` comprueba la conexión a PostgreSQL y la presencia de la tabla creada por la migración. El botón **Verificar conexión** consulta `/ready`.

Usa `npm run db:migrate` para crear una nueva migración al cambiar el esquema.

### App móvil

Configura `EXPO_PUBLIC_API_URL` en `apps/mobile/.env`. El ejemplo usa `10.0.2.2` para el emulador Android. En un simulador iOS usa `http://localhost:3000`. En un teléfono físico usa la IP local del equipo que ejecuta la API, en la misma red.

Crea e instala la compilación de desarrollo desde `apps/mobile` con `npx expo run:android` o `npx expo run:ios` (macOS y Xcode). Para iniciar Metro en sesiones posteriores, ejecuta `npm run dev:mobile` desde la raíz y abre la compilación instalada. La ruta inicial `/` muestra el diagnóstico. Las rutas viven en `src/app`, las pantallas en `src/screens` y las consultas HTTP en `src/api` dentro del workspace móvil. [Compilaciones de desarrollo de Expo](https://docs.expo.dev/develop/development-builds/introduction/)

### Verificación

```bash
npm run typecheck
npm test
npm run build
k6 run tests/load/readiness.js
```

GitHub Actions instala el lockfile, revisa los tipos, ejecuta Jest, compila el panel y exporta los bundles móviles de Android e iOS. También levanta PostgreSQL y comprueba que `/health` devuelva `200` y que `/ready` pase de `503` a `200` al aplicar la migración inicial.

Para verificar las interfaces, abre el panel en el navegador y la app en Android o iOS. Pulsa **Verificar conexión** con la API en ejecución y confirma el mensaje de disponibilidad. Detén solo la API, pulsa de nuevo y confirma el mensaje de error.

El script k6 requiere una API local con la migración aplicada. Las pruebas PP-24 y PP-25 se ejecutarán sobre el entorno del piloto y el flujo de asignación, respectivamente.

### Servicios previstos

| Servicio | Configuración del proyecto |
| --- | --- |
| Render | Ejecutar desde la raíz del repo con `npm ci --include=dev && npm run build -w @miestacionamientouc/api` y `npm start -w @miestacionamientouc/api`. Configurar `DATABASE_URL` y el origen HTTPS de Vercel en `ADMIN_ORIGIN`. [Versión de Node en Render](https://render.com/docs/node-version) |
| Supabase | PostgreSQL para la API. Aplicar la migración con `npm run db:deploy` antes de iniciar el servicio. Si la conexión de migración es distinta, configurar `DIRECT_URL`. |
| Vercel | Seleccionar Node 22 y `apps/admin` como directorio raíz. Habilitar acceso a los archivos externos del monorepo y definir `VITE_API_URL` con la URL HTTPS de Render. [Monorepos en Vercel](https://vercel.com/docs/monorepos/monorepo-faq) |
| UptimeRobot | Configurar una comprobación HTTP de `/ready` para medir disponibilidad durante el piloto. |

## Skills de GitHub

Consulta [SKILLS.md](SKILLS.md) para ver las skills de Expo, Vercel, Prisma y Supabase y cuándo usar cada una.
