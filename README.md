# MiEstacionamientoUC

MVP para gestionar los estacionamientos del Campus San Joaquín. Una persona de la comunidad UC registra su cuenta y patente, conecta su horario, reserva una plaza cerca de su clase y registra la llegada y la salida escaneando el QR de la plaza. Administración gestiona el inventario, la ocupación, los incidentes y los indicadores del piloto desde un panel web.

| Ruta | Componente |
| --- | --- |
| `apps/api` | API REST con Express, TypeScript, Prisma 7 y PostgreSQL. |
| `apps/admin` | Panel web de administración con React y Vite. |
| `apps/mobile` | App Android e iOS con React Native, Expo SDK 55 y Expo Router. |
| `docs/specs` | Specs del MVP por tramo, con la evidencia de cada uno. |
| `docs/campus-san-joaquin` | Catálogo geográfico, distancias y cursos UC de prueba. |
| `tests/load` | Pruebas de carga con k6. |

Consulta el [alcance y las decisiones técnicas](docs/alcance.md) y el [índice de specs](docs/specs/README.md) para ver qué cubre cada tramo y qué queda pendiente para el piloto.

## Instalación

Necesitas:

- **Node.js 22** (mínimo 22.12) y npm. Con nvm, `nvm use` toma la versión de `.nvmrc`. [Ciclo de soporte de Node.js](https://nodejs.org/en/about/previous-releases)
- **Docker** con Docker Compose, para PostgreSQL y el correo de prueba.
- Para la app, **una** de estas opciones (ver [Probar la app móvil](#probar-la-app-móvil)): un teléfono Android o iPhone con Expo Go, el emulador de Android Studio o un Mac con Xcode. Expo SDK 55 funciona desde Android 10 e iOS 15.1. [Compatibilidad de Expo SDK 55](https://docs.expo.dev/versions/v55.0.0/#support-for-android-and-ios-versions)

Desde la raíz del repo:

```bash
nvm use
npm ci
cp apps/api/.env.example apps/api/.env
cp apps/admin/.env.example apps/admin/.env
cp apps/mobile/.env.example apps/mobile/.env
docker compose up -d --wait db mailpit
npm run db:deploy
npm run db:seed
```

`npm run db:seed` deja todo listo para la demo y se puede repetir sin duplicar nada:

- Catálogo de San Joaquín: 10 bloques de estacionamiento, salas, edificios y distancias.
- Plazas de prueba con su QR (los imprime en la consola): A1–A2 en el Centro de Innovación, B1–B3 en el Estacionamiento 4 e I1–I10 en Estacionamiento Ingeniería, la zona piloto de reservas semanales.
- 121 secciones reales de Buscacursos (2026-2, San Joaquín) y tres estudiantes de prueba para conectar el horario UC.
- La cuenta de administración `admin@demo.uc.cl` / `admin-demo-2026` (se cambia con `ADMIN_SEED_EMAIL` y `ADMIN_SEED_PASSWORD` en `apps/api/.env`).

## Levantar el sistema

Usa una terminal para cada proceso:

```bash
npm run dev:api
```

```bash
npm run dev:admin
```

```bash
npm run dev:mobile:go
```

| Servicio | Dirección |
| --- | --- |
| API | `http://localhost:3000` (`/health` y `/ready` para verificar) |
| Panel | [localhost:5173](http://localhost:5173), con la cuenta de administración |
| Correo de prueba (Mailpit) | [localhost:8025](http://localhost:8025): recuperación de contraseña y avisos |
| Metro (app) | puerto 8081; muestra un QR para abrir la app |

`npm run dev:mobile:go` abre la app en **Expo Go**. `npm run dev:mobile` la abre en una **compilación de desarrollo** propia (ver la opción D).

## Probar la app móvil

La app necesita llegar a dos puertos del computador: **8081** (Metro, que entrega la app) y **3000** (la API). La dirección de la API va en `EXPO_PUBLIC_API_URL` dentro de `apps/mobile/.env`. Después de cambiarla, reinicia Metro con `-c` para limpiar la caché (por ejemplo, `npx expo start --go -c` desde `apps/mobile`).

| Opción | Cuándo conviene | `EXPO_PUBLIC_API_URL` |
| --- | --- | --- |
| A. Teléfono Android por USB | La más confiable: no depende de la red. | `http://localhost:3000` |
| B. Teléfono por Wi‑Fi | Android o iPhone sin cable, en la misma red. | `http://<IP-del-computador>:3000` |
| C. Emulador de Android Studio | Sin teléfono. | `http://10.0.2.2:3000` |
| D. Compilación de desarrollo | Notificaciones push y enlaces `miestacionamientouc://`. | Según dónde corra |

Expo Go se instala desde Google Play o la App Store y debe ser compatible con **SDK 55**. Expo Go no recibe notificaciones remotas (desde SDK 53 en Android) y no abre el enlace propio de la app. En esos casos, los avisos llegan por correo a Mailpit y a la bandeja **Cuenta → Avisos**, y el enlace de recuperación se pega en la app.

### A. Teléfono Android por USB

1. En el teléfono, activa **Opciones de desarrollador** (toca siete veces *Número de compilación*) y luego **Depuración USB**.
2. Conecta el cable y acepta el aviso de depuración en el teléfono.
3. Redirige los puertos del teléfono al computador. Necesitas `adb`, que viene con Android Studio (`platform-tools`) o con las [Platform Tools](https://developer.android.com/tools/releases/platform-tools).

   ```bash
   adb devices
   ```

   ```bash
   adb reverse tcp:8081 tcp:8081
   ```

   ```bash
   adb reverse tcp:3000 tcp:3000
   ```

4. En `apps/mobile/.env`, usa `EXPO_PUBLIC_API_URL=http://localhost:3000`.
5. Inicia `npm run dev:mobile:go`, abre Expo Go y entra a `exp://localhost:8081` con **Enter URL manually**.

`adb reverse` se pierde al desconectar el cable: repite el paso 3 al reconectar.

### B. Teléfono por Wi‑Fi (Android o iPhone)

1. Conecta el teléfono y el computador a la misma red. Las redes de la universidad suelen bloquear el tráfico entre equipos; usa un hotspot o la red de la casa.
2. Averigua la IP del computador en esa red (`ipconfig` en Windows, `ipconfig getifaddr en0` en macOS, `hostname -I` en Linux) y escríbela en `EXPO_PUBLIC_API_URL=http://<IP>:3000`.
3. Inicia `npm run dev:mobile:go` y escanea el QR de la terminal: con la cámara en iPhone o desde Expo Go en Android.

Si el teléfono no carga la app:

- Revisa que el firewall del computador permita conexiones entrantes a los puertos 3000 y 8081.
- Si el computador tiene varias interfaces de red (VPN, máquinas virtuales, contenedores), Metro puede anunciar una IP equivocada. Define `REACT_NATIVE_PACKAGER_HOSTNAME=<IP>` antes de iniciarlo.
- Si la red no permite la conexión directa, usa el túnel de Expo (`npx expo start --go --tunnel` desde `apps/mobile`; la primera vez instala `@expo/ngrok`). El túnel solo cubre Metro: la API debe seguir siendo alcanzable, así que en ese caso conviene la opción A.

### C. Emulador de Android Studio

1. Instala [Android Studio](https://developer.android.com/studio). El emulador necesita la virtualización por hardware activa (en la BIOS y, en Windows, la *Plataforma del hipervisor de Windows*).
2. En **Device Manager**, crea un dispositivo (por ejemplo, Pixel 8 con Android 15, imagen *Google Play*) y ábrelo.
3. Instala Expo Go en el emulador desde Google Play.
4. Usa `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000`: `10.0.2.2` es el computador visto desde el emulador.
5. Inicia `npm run dev:mobile:go` y, en Expo Go, entra a `exp://10.0.2.2:8081`. Si `adb` está disponible, también puedes pulsar `a` en la terminal de Metro.

Para registrar la llegada sin estar en el campus, fija la ubicación del emulador en *Extended controls → Location* dentro del campus (por ejemplo, `-33.4975, -70.6153`) o usa `PERIMETRO_PRUEBA` (ver la [guía de prueba](#guía-de-prueba)). La cámara del emulador puede mostrar una escena virtual o la cámara web; si no lee el QR, escribe su contenido en el campo bajo el visor.

### D. Compilación de desarrollo

Es la app nativa propia, con `expo-dev-client`. Es necesaria para las notificaciones push y para que el enlace `miestacionamientouc://` abra la app.

- **Local**: desde `apps/mobile`, `npx expo run:android` (requiere el SDK de Android de Android Studio y un teléfono o emulador conectado) o `npx expo run:ios` (macOS con Xcode). Luego inicia Metro con `npm run dev:mobile` y abre la app instalada. [Compilaciones de desarrollo](https://docs.expo.dev/develop/development-builds/introduction/)
- **En la nube**: con una cuenta Expo y [EAS Build](https://docs.expo.dev/develop/development-builds/create-a-build/), genera una compilación de desarrollo para Android o iPhone sin instalar Android Studio ni Xcode. Para las notificaciones push, el proyecto EAS agrega `extra.eas.projectId` en `app.json`.

### iPhone

En un iPhone usa la opción B con Expo Go. En un Mac, el simulador de iOS (Xcode) abre la app con `i` en la terminal de Metro y usa `EXPO_PUBLIC_API_URL=http://localhost:3000`.

## Guía de prueba

Abre el panel en [localhost:5173](http://localhost:5173) con `admin@demo.uc.cl` / `admin-demo-2026` y la app en el teléfono o el emulador.

1. **Cuenta.** Regístrate con un correo `@demo.uc.cl` y una patente chilena (`AB1234` o `BCDF12`). Para recuperar la contraseña, usa *¿Olvidaste tu contraseña?*: el correo llega a Mailpit. En Expo Go, copia el enlace del correo y pégalo en *Ya tengo el enlace*.
2. **Horario.** En *Cuenta → Mi horario*, conecta tu horario UC con un estudiante de prueba (es una simulación: no pide tu clave UC), revisa los bloques y sincroniza. También puedes cambiarte de sección, agregar bloques a mano o importar un `.ics`.
3. **Reserva.** En *Reservar*, elige fecha y horario. Si ese día tienes clases, el destino sale de tu horario; si no, elige una sala o un edificio. Los bloques abren de lunes a viernes de 07:00 a 22:00 y el sábado de 08:00 a 14:00. Sin cupo, la app ofrece la lista de espera. En *Mi reserva* puedes cambiar el horario o cancelar.
4. **Llegada y salida.** El check-in se acepta desde 15 minutos antes hasta 15 minutos después de la llegada: reserva para unos minutos más tarde. Muestra el QR de la plaza desde el panel (*Códigos QR*) en otra pantalla o impreso, y escanéalo desde *Mi reserva*. La llegada exige estar dentro del campus. Para probar desde otro lugar, define `PERIMETRO_PRUEBA` en `apps/api/.env` con un polígono que te incluya (hay un ejemplo en `.env.example`) y reinicia la API. Al salir, la app pide una evaluación de 1 a 5.
5. **Puntaje y avisos.** *Cuenta → Mi puntaje* muestra los ajustes por llegar, salir a tiempo o no presentarse. *Cuenta → Avisos* muestra confirmaciones, cambios y recordatorios.
6. **Reservas semanales.** En *Reservar → Reservas semanales*, fija tus días y horario en la zona piloto (Estacionamiento Ingeniería). Caben tres series (30 % de 10 plazas). Una ausencia revoca la serie.
7. **Panel.** Revisa Ocupación, Incidentes, Inventario, Bloqueos, Preferentes, Ranking e Indicadores. *Ranking → Procesar vencimientos ahora* marca ausencias sin esperar el proceso automático.

Para ver Indicadores con datos, genera una simulación con cuentas ficticias:

```bash
npm run piloto:simular -w @miestacionamientouc/api -- --desde 2026-11-23 --dias 5 --usuarios 60
```

Los datos simulados aparecen en el panel con el modo *Simulación* y no acreditan las metas. Al cerrar el piloto, `npm run piloto:cerrar -w @miestacionamientouc/api -- --confirmar` guarda los indicadores agregados y **elimina** los datos personales.

### Problemas frecuentes

| Síntoma | Qué revisar |
| --- | --- |
| «No se pudo contactar al servidor» | La API está corriendo, `EXPO_PUBLIC_API_URL` apunta a una dirección que el teléfono alcanza y reiniciaste Metro con `-c`. *Verificar conexión*, en el inicio de sesión, prueba `/ready`. |
| Expo Go no abre el proyecto | La versión de Expo Go es para SDK 55; el teléfono llega al puerto 8081 (`adb reverse` o la misma red). |
| «Tu ubicación está fuera del campus» | Usa `PERIMETRO_PRUEBA` o fija la ubicación del emulador. |
| «Aún es temprano» o «Tu ventana de llegada terminó» | El check-in es ±15 minutos de la llegada reservada. |
| No llegan notificaciones | En Expo Go no hay notificaciones push: los avisos están en Mailpit y en *Cuenta → Avisos*. |
| El emulador no arranca | Activa la virtualización por hardware (BIOS y, en Windows, la *Plataforma del hipervisor*). |

## Desarrollo

```bash
npm run typecheck
npm test
npm run build
```

`npm test` requiere PostgreSQL (`docker compose up -d --wait db`) y usa una base separada, `estacionamientos_test`, sin tocar los datos de desarrollo. Una sola prueba: `npm test -w @miestacionamientouc/api -- test/reservas.test.js`. Tras cambiar `apps/api/prisma/schema.prisma`, crea la migración con `npm run db:migrate`.

GitHub Actions revisa los tipos, ejecuta las pruebas contra PostgreSQL, compila el panel, exporta los bundles de Android e iOS y comprueba que `/ready` pase de `503` a `200` al migrar.

Pruebas de carga con [k6](https://k6.io/), con la API local migrada y con datos:

```bash
k6 run tests/load/readiness.js
```

```bash
k6 run -e FECHA=2026-11-23 tests/load/asignacion.js
```

`asignacion.js` repite PP-25: 50 usuarios solicitan una plaza a la vez y cada respuesta debe tardar menos de 5 segundos.

### Servicios previstos

| Servicio | Configuración del proyecto |
| --- | --- |
| Render | Ejecutar desde la raíz del repo con `npm ci --include=dev && npm run build -w @miestacionamientouc/api` y `npm start -w @miestacionamientouc/api`. Configurar `DATABASE_URL`, el origen HTTPS de Vercel en `ADMIN_ORIGIN` y `SMTP_URL` del proveedor de correo. [Versión de Node en Render](https://render.com/docs/node-version) |
| Supabase | PostgreSQL para la API. Aplicar las migraciones con `npm run db:deploy` antes de iniciar el servicio. Si la conexión de migración es distinta, configurar `DIRECT_URL`. |
| Vercel | Seleccionar Node 22 y `apps/admin` como directorio raíz. Habilitar acceso a los archivos externos del monorepo y definir `VITE_API_URL` con la URL HTTPS de Render. [Monorepos en Vercel](https://vercel.com/docs/monorepos/monorepo-faq) |
| UptimeRobot | Configurar una comprobación HTTP de `/ready` para medir la disponibilidad del piloto y registrarla en *Indicadores*. |

## Skills de GitHub

Consulta [SKILLS.md](SKILLS.md) para ver las skills de Expo, Vercel, Prisma y Supabase y cuándo usar cada una.
