# Specs de MiEstacionamientoUC

La prioridad es una demo móvil con cuenta ficticia, destino y permanencia, reserva diaria y entrada y salida por QR. El [alcance técnico](../alcance.md) enlaza el DRS, el plan de pruebas y las solicitudes de cambio.

| Etapa | Tramo | Alcance | Requisitos | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| Acceso y datos | [01A](01-cuentas.md#01a--acceso-y-base-visual) | Acceso y base visual | RF-01–02 | Base del repo | En curso · [evidencia](#01a--evidencia) |
| Acceso y datos | [02A](02-inventario.md#02a--catálogo-geográfico-y-plazas-de-prueba) | Catálogo de la demo | RF-18 | 01A | Verificada · [evidencia](#02a--evidencia) |
| Acceso y datos | [03A](03-horarios.md#03a--destino-y-permanencia) | Destino y permanencia | RF-05 | 01A | En curso · [evidencia](#03a--evidencia) |
| Demo móvil | [04A](04-reservas.md#04a--reserva-diaria) | Reserva y cancelación | RF-06–08 | 01A, 02A, 03A | Pendiente |
| Demo móvil | [05A](05-uso-y-ranking.md#05a--entrada-y-salida-qr) | Entrada y salida QR | RF-10–12 | 02A, 04A | Pendiente |
| Flujos principales | [01B](01-cuentas.md#01b--recuperación-por-correo) | Recuperación | RF-03 | 01A | Pendiente |
| Flujos principales | [02B](02-inventario.md#02b--inventario-y-autorizaciones) | Inventario y autorizaciones | RF-18, RF-23 | 01A, 02A, 04A | Pendiente |
| Flujos principales | [03B](03-horarios.md#03b--horario-semanal-e-importación) | Horario e importación | RF-04–05 | 02A, 03A, 04A | Pendiente |
| Flujos principales | [05B](05-uso-y-ranking.md#05b--vencimientos-y-ranking) | Vencimientos y ranking | RF-13–15 | 05A | Pendiente |
| Flujos principales | [04B](04-reservas.md#04b--asignación-completa-y-espera) | Prioridad, cambios y espera | RF-06–09, RF-23, RNF-01 | 02B, 03B, 04A, 05B | Pendiente |
| Flujos principales | [08A](08-operacion.md#08a--ocupación-e-incidentes) | Ocupación e incidentes | RF-19–20 | 02B, 05A | Pendiente |
| Piloto | [06](06-avisos.md#06--avisos) | Avisos y recordatorios | RF-16–17 | 04B, 05B | Pendiente |
| Piloto | [07](07-recurrencia.md#07--reservas-recurrentes) | Recurrencia semanal | RF-22 | 06 | Pendiente |
| Piloto | [08B](08-operacion.md#08b--indicadores-y-cierre-del-piloto) | Indicadores y cierre | RF-21 y RNF del piloto | 01B, 07, 08A | Pendiente |

02A y 03A pueden avanzar en paralelo. Para desarrollar 03A, usar un catálogo de prueba con el contrato compartido en la spec 02. Integrar el catálogo geográfico de San Joaquín con plazas de prueba al cerrar 04A. La asignación ordena los bloques por su cercanía al destino. 01B, 02B, 03B y 05B se pueden tomar por separado al cumplir sus dependencias. La demo usa solo plazas regulares.

## Verificación

- Ejecutar los chequeos del repo y las pruebas específicas del tramo. Usar PostgreSQL real para verificar conflictos de reserva y reintentos y un emulador o dispositivo para verificar flujos móviles. Exportar bundles acredita la compilación. Para acreditar el flujo, ejecutarlo.
- Actualizar solo el tramo trabajado. Usar `En curso` mientras queden criterios pendientes y `Verificada` cuando exista evidencia de los criterios del tramo. Anotar aquí las pruebas, resultados y validaciones del piloto pendientes. Enlazar el commit o PR si existe. El certificado y el acta son fuentes de alcance académico.

## Evidencia

### 01A · Evidencia

Rama `tramo/01a-acceso` (sobre `tramo/00-base`).

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Un registro válido permite iniciar sesión | Verificado (API) | `apps/api/test/cuentas.test.js` › «un registro válido permite iniciar sesión…» y flujo con `curl` contra la API local: registro → sesión → `GET /cuenta`. |
| Correo externo o duplicado y patente inválida se rechazan sin registros parciales | Verificado (API) | Pruebas de correo externo, patente inválida, correo duplicado con otras mayúsculas, patente repetida y tres registros simultáneos con el mismo correo; todas cuentan filas de `Cuenta` y `Vehiculo` en PostgreSQL real. |
| Credenciales incorrectas reciben un error genérico | Verificado (API) | Contraseña incorrecta y correo desconocido devuelven el mismo cuerpo `401 credenciales_invalidas`; una cuenta desactivada también. |
| Cerrar sesión invalida el acceso de esa sesión | Verificado (API) | `DELETE /auth/sesion` revoca solo esa sesión; otra sesión de la misma cuenta sigue válida. También se rechazan sesiones vencidas y tokens inventados. |
| La API rechaza operaciones administrativas de cuentas comunes | Verificado (API) | `GET /admin/cuentas` responde `403 acceso_denegado` a un usuario y `200` al administrador provisionado con `npm run db:seed`. |
| En móvil, campos y acción principal accesibles con teclado abierto | Pendiente de dispositivo | Formularios dentro de `FormScreen` (`KeyboardAvoidingView` + `ScrollView` con `keyboardShouldPersistTaps`). Falta probarlo en Android/iOS. |
| App: registro, inicio y cierre de sesión con almacenamiento seguro | Pendiente de dispositivo | Token en `expo-secure-store`, compuerta de hidratación y `Stack.Protected`. Compilación: `tsc` y `expo export` para Android e iOS sin errores. |
| Panel con acceso administrativo | Pendiente de navegador | Inicio de sesión que rechaza cuentas sin rol `admin`, guardia de rutas y listado de cuentas. Compilación: `npm run build -w @miestacionamientouc/admin`. |

**Pendiente para piloto** · Confirmar dominios institucionales y el procedimiento para habilitar a los primeros administradores. El seed solo crea un administrador local de prueba.

### 02A · Evidencia

Rama `tramo/02a-catalogo` (sobre `tramo/01a-acceso`). Pruebas en `apps/api/test/catalogo.test.js` contra PostgreSQL real.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Cargar el catálogo dos veces conserva los identificadores y evita duplicados | Verificado | La segunda importación deja iguales los IDs de zonas y destinos y los totales (10 bloques, 429 destinos, 4.290 distancias). La carga usa `ON CONFLICT` por ID de origen. |
| Salas con el mismo nombre conservan IDs distintos | Verificado | Los dos registros `ED113` (`ED113` y `ED113-SJ`) quedan como destinos distintos y la búsqueda devuelve ambos. |
| Un acceso vehicular queda fuera de los bloques reservables | Verificado | `PARKING-10` a `PARKING-19` no se cargan como zonas. |
| La app puede consultar los destinos | Verificado (API) | `GET /destinos?q=` con sesión devuelve ID, nombre, tipo, ID de origen y pisos; también probado con `curl` contra la API local. La pantalla que lo usa se entrega en 03A. |
| La API identifica la plaza de prueba correcta a partir de su QR | Verificado | `resolverQr` identifica las 5 plazas de demo y rechaza QR ilegibles, desconocidos y revocados. Un índice parcial impide dos QR vigentes por plaza. |
| Distancias para edificios con la misma red y reglas | Verificado | `generar.py` produce `distancias-edificios.csv` (250 pares) sin cambiar `distancias.csv` ni `mapa.html`. |
| Al menos dos bloques con plazas regulares, horarios y QR de prueba | Verificado | `npm run db:seed` crea A1–A2 en PARKING-7 y B1–B3 en PARKING-5, los dos más cercanos a ED113, con horario de lunes a sábado. Repetirlo no duplica plazas ni cambia los QR. |

**Pendiente para piloto** · El inventario real, los horarios y los bloques habilitados se confirman en 02B. Las conexiones de los edificios también son inferidas y requieren validación en terreno.

### 03A · Evidencia

Rama `tramo/03a-destino`. Pruebas en `apps/api/test/visitas.test.js` contra PostgreSQL real.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Un destino válido y una salida posterior a la llegada permiten preparar la solicitud | Verificado (API) | `POST /visitas/validar` devuelve el destino y el intervalo `[inicio, fin)` en UTC para salas y edificios. |
| Falta de destino, ID inexistente o intervalo inválido muestran el error | Verificado (API) | Errores por campo (`destinoId`, `fecha`, `llegada`, `salida`), varios a la vez si corresponde. |
| Zona horaria de Santiago consistente | Verificado (API) | Conversión en horario de verano e invierno, hora inexistente del 6 de septiembre de 2026 rechazada y hora repetida del 4 de abril resuelta a la primera ocurrencia. La app envía horas de pared de Santiago y la API las convierte. |
| Buscar por código o nombre y enviar el ID del registro | Pendiente de dispositivo | Pantalla «Elegir destino» con búsqueda en `GET /destinos`; muestra el ID de origen para distinguir homónimos y envía el ID interno. |
| Conservar los datos ingresados tras un error | Pendiente de dispositivo | El borrador vive en `SolicitudProvider` mientras la sesión está abierta; los errores se muestran junto a cada campo. Compilación: `tsc` y `expo export` sin errores. |
