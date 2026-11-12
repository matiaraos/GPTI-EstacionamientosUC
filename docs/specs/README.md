# Specs de MiEstacionamientoUC

La prioridad es una demo móvil con cuenta ficticia, destino y permanencia, reserva diaria y entrada y salida por QR. El [alcance técnico](../alcance.md) enlaza el DRS, el plan de pruebas y las solicitudes de cambio.

| Etapa | Tramo | Alcance | Requisitos | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| Acceso y datos | [01A](01-cuentas.md#01a--acceso-y-base-visual) | Acceso y base visual | RF-01–02 | Base del repo | Verificada · [evidencia](#01a--evidencia) |
| Acceso y datos | [02A](02-inventario.md#02a--catálogo-geográfico-y-plazas-de-prueba) | Catálogo de la demo | RF-18 | 01A | Verificada · [evidencia](#02a--evidencia) |
| Acceso y datos | [03A](03-horarios.md#03a--destino-y-permanencia) | Destino y permanencia | RF-05 | 01A | Verificada · [evidencia](#03a--evidencia) |
| Demo móvil | [04A](04-reservas.md#04a--reserva-diaria) | Reserva y cancelación | RF-06–08 | 01A, 02A, 03A | Verificada · [evidencia](#04a--evidencia) |
| Demo móvil | [05A](05-uso-y-ranking.md#05a--entrada-y-salida-qr) | Entrada y salida QR | RF-10–12 | 02A, 04A | Verificada · [evidencia](#05a--evidencia) |
| Flujos principales | [01B](01-cuentas.md#01b--recuperación-por-correo) | Recuperación | RF-03 | 01A | En curso · [evidencia](#01b--evidencia) |
| Flujos principales | [02B](02-inventario.md#02b--inventario-y-autorizaciones) | Inventario y autorizaciones | RF-18, RF-23 | 01A, 02A, 04A | Verificada · [evidencia](#02b--evidencia) |
| Flujos principales | [03B](03-horarios.md#03b--horario-semanal-e-importación) | Horario e importación | RF-04–05 | 02A, 03A, 04A | En curso · [evidencia](#03b--evidencia) |
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
| En móvil, campos y acción principal accesibles con teclado abierto | Verificado (dispositivo) | Galaxy A36 (Android 16) con Expo Go 55, 12-11-2026: la prueba detectó que el botón quedaba tapado en Android edge-to-edge; se corrigió con `KeyboardAwareScrollView` (PR #7) y se confirmó con el teclado abierto. Pendiente en iOS. |
| App: registro, inicio y cierre de sesión con almacenamiento seguro | Verificado (dispositivo) | Galaxy A36 (Android 16) con Expo Go 55, 12-11-2026: errores por campo de correo externo y patente inválida sin perder lo escrito, registro válido, sesión conservada al cerrar y reabrir la app, cierre de sesión y error genérico con contraseña incorrecta. |
| Panel con acceso administrativo | Verificado (navegador) | Inicio de sesión del administrador de prueba y listado con las cuentas creadas en el teléfono. La prueba detectó una página en blanco por dos copias de React, corregida en PR #7 y comprobada con Edge sin interfaz. |

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
| Buscar por código o nombre y enviar el ID del registro | Verificado (dispositivo) | Galaxy A36 (Android 16) con Expo Go 55, 12-11-2026: «ed113» muestra los dos registros distinguidos por `ED113` y `ED113-SJ`; la reserva quedó con el destino elegido. |
| Conservar los datos ingresados tras un error | Verificado (dispositivo) | Galaxy A36 (Android 16) con Expo Go 55, 12-11-2026: una salida anterior a la llegada muestra el error bajo «Salida» y conserva destino y horario. |

### 04A · Evidencia

Rama `tramo/04a-reserva`. Pruebas en `apps/api/test/reservas.test.js` contra PostgreSQL real. Restricciones `EXCLUDE USING gist` (con `btree_gist`) sobre `tstzrange(inicio, fin, '[)')` por plaza, cuenta y vehículo para reservas `confirmada` o `en_uso`.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Primer bloque lleno y segundo con plaza: confirma en el segundo | Verificado (API) | Tres solicitudes para ED113: A1 y A2 en PARKING-7 y luego B1 en PARKING-5. |
| Ruta peatonal antes que línea recta | Verificado (API) | Con PARKING-7 a 50 m en línea recta y PARKING-5 a 400 m a pie, asigna PARKING-5. |
| Solo línea recta: la más cercana, con el método etiquetado | Verificado (API) | Responde `metodoDistancia: "linea_recta"` con el bloque de menos metros; la app lo muestra como «estimación». |
| Hay cupo pero faltan todas las distancias | Verificado (API) | `422 sin_cercania` sin crear reserva. Un bloque sin distancia se omite del orden. |
| Sin cupo, se informa sin crear reserva | Verificado (API) | `409 sin_cupo` con las 5 plazas ocupadas, fuera del horario del bloque o con plaza inactiva excluida. |
| Cancelar libera el intervalo | Verificado (API) | Tras cancelar, otra cuenta obtiene la misma plaza; cancelar dos veces no cambia nada; no se cancela una reserva ajena ni una en uso. |
| Concurrencia sin solapes por plaza, cuenta ni patente | Verificado (PostgreSQL) | 9 cuentas simultáneas: 5 reservas en plazas distintas y 4 `sin_cupo`. Tres solicitudes simultáneas de una cuenta: una confirmada. Inserciones directas en la base que solapan plaza o vehículo se rechazan (23P01). |
| Intervalos contiguos admitidos | Verificado (PostgreSQL) | 09:00–12:00 y 12:00–14:00 en la misma plaza y cuenta. |
| El reintento devuelve la misma reserva | Verificado (API) | Misma `Idempotency-Key`: `200` con la misma reserva, también con 6 reintentos simultáneos; la clave con otros datos se rechaza. Probado además con `curl` contra la API local (reserva, reintento y cancelación). |
| App: bloque, plaza, horario y distancia, o falta de cupo | Verificado (dispositivo) | Galaxy A36 (Android 16) con Expo Go 55, 12-11-2026: reservas para ED113-SJ confirmadas en A1 y A2 del Est. Subterráneo Centro de innovación con su horario y distancia a pie. La falta de cupo y la cancelación se verificaron en la API; en el teléfono no se ejercitaron. |

### 05A · Evidencia

Rama `tramo/05a-qr`. Pruebas en `apps/api/test/uso.test.js` contra PostgreSQL real.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Un QR correcto permite entrada y salida | Verificado (API) | Entrada pasa la reserva a `en_uso` con la hora del servidor; salida la deja `finalizada` y otra cuenta puede reservar la plaza liberada. Probado también con `curl` y el reloj real contra la API local. |
| Se rechazan QR ajenos, revocados o ilegibles | Verificado (API) | `qr_otra_plaza` (indica la plaza correcta), `qr_revocado` y `qr_ilegible`, sin cambiar la reserva ni registrar eventos. |
| Se rechazan check-ins fuera de zona o de ventana | Verificado (API) | `fuera_de_zona` con una ubicación a varios kilómetros; `fuera_de_ventana` antes de 08:45 y después de 09:15 para una llegada a las 09:00. Sin ubicación, error por campo. `PERIMETRO_PRUEBA` permite usar otro perímetro. |
| Una lectura fallida permite reintentar | Verificado (API) | Tras los rechazos, la misma reserva acepta la lectura correcta. |
| Repetir una operación confirmada no duplica eventos | Verificado (API) | Entrada repetida responde 200 con el mismo evento; cinco salidas simultáneas dejan un solo evento. Único `(reservaId, tipo)`. |
| Ocupación real: un uso activo por plaza, cuenta y vehículo | Verificado (PostgreSQL) | Índices únicos parciales sobre `estado = 'en_uso'`: si la reserva anterior sigue en uso, el check-in siguiente en esa plaza responde `plaza_ocupada`. |
| Coordenadas personales fuera del historial | Verificado (diseño) | `EventoReserva` guarda tipo, QR y hora; la ubicación solo se usa para validar. |
| Flujo en emulador o dispositivo | Verificado (dispositivo) | Galaxy A36 (Android 16) con Expo Go 55, 12-11-2026: escaneando los QR del panel, el QR de otra plaza se rechaza indicando la plaza correcta; entrada a las 17:03:03 y salida a las 17:03:19 registradas con la cámara y el GPS del teléfono (perímetro de prueba `PERIMETRO_PRUEBA` sobre Santiago). Tras la prueba se agregó la plaza destacada en la confirmación y el escaneo (PR #7). |

**Pendiente para piloto** · Confirmar perímetro y las tolerancias propuestas de 15 minutos para llegada y 10 para salida (configurables). El check-out se admite mientras la reserva está en uso; los atrasos se tratan en 05B.

### 01B · Evidencia

Rama `tramo/01b-recuperacion`. Pruebas en `apps/api/test/recuperacion.test.js` contra PostgreSQL real. Canal de prueba: Mailpit (`docker compose up -d mailpit`, bandeja en `localhost:8025`); vigencia `RECUPERACION_TTL_MIN` (30 min por defecto) y enlace `RECUPERACION_URL`.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Un enlace válido permite cambiar la contraseña una vez | Verificado (API) | La nueva contraseña inicia sesión y la anterior no; repetir el enlace responde `enlace_usado`. Tres confirmaciones simultáneas con el mismo enlace: una `200` y dos `400`. Probado también con `curl` contra la API local leyendo el correo desde la API de Mailpit. |
| Enlaces vencidos o reutilizados se rechazan | Verificado (API) | `enlace_vencido` al cumplirse la vigencia, `enlace_usado` al repetir, `enlace_invalido` con un token inventado. Cambiar la contraseña anula los demás enlaces pendientes y cierra todas las sesiones de la cuenta. Solo se guarda el hash SHA-256 del token. |
| Un correo desconocido recibe la misma respuesta pública | Verificado (API) | Correo registrado, desconocido y externo reciben el mismo `202`; solo el registrado genera correo. El envío no se espera, para que la respuesta no dependa de la existencia de la cuenta. Una cuenta desactivada no recibe enlace. |
| App: solicitud y nueva contraseña | Compilación | «¿Olvidaste tu contraseña?» en el inicio de sesión, pantalla de solicitud y pantalla `restablecer` que abre el enlace `miestacionamientouc://restablecer?token=` o acepta el enlace pegado. `tsc` y `expo export` pasan. **Pendiente**: recorrer el flujo en el teléfono. |

**Pendiente para piloto** · Confirmar proveedor de correo, vigencia y entrega real. En Expo Go el esquema propio no abre la app: configurar `RECUPERACION_URL=exp://<IP>:8081/--/restablecer` o pegar el enlace.

### 02B · Evidencia

Rama `tramo/02b-inventario`. Pruebas en `apps/api/test/inventario.test.js` contra PostgreSQL real. Panel: páginas Inventario (bloques, horario semanal, plazas, tipo, QR), Bloqueos, Edificios y salas y Preferentes.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Una cuenta común no puede cambiar inventario ni autorizaciones | Verificado (API) | Doce operaciones `/admin/*` (zonas, horarios, plazas, QR, bloqueos, destinos, habilitaciones) responden `403` a un usuario y `401` sin sesión, sin cambios en la base. |
| Plaza bloqueada o inactiva excluida de nuevas asignaciones | Verificado (API) | Con A1 y A2 bloqueadas de 08:00 a 13:00 se asigna el bloque siguiente; fuera del bloqueo y al levantarlo vuelve A1. Plaza desactivada: se asigna A2. Bloque inactivo o sin horario ese día también se excluye. |
| Conservar historial y advertir reservas afectadas | Verificado (API) | Las plazas no se eliminan; desactivar, cambiar tipo o bloquear devuelve las reservas vigentes afectadas (con correo) sin cancelarlas, y el panel las muestra antes de confirmar. Los bloqueos levantados quedan en el historial. |
| Se distinguen plazas regulares y preferentes | Verificado (API) | Al pasar A1 a preferente, una cuenta sin habilitación recibe A2. Crear plaza emite su QR y rechaza códigos repetidos en el bloque. |
| Habilitación revocada o vencida deja de ser válida; sin certificados ni motivos médicos | Verificado (API) | Vigente hasta el fin del día indicado en Santiago; al vencer o revocarse, `tieneAutorizacionVigente` es falso y `GET /cuenta` informa el estado. El cuerpo con `motivo` o `certificado` se rechaza y la tabla solo tiene vigencia, revocación y quién la otorgó. |
| QR: rotar y revocar | Verificado (API) | Rotar deja el anterior como `qr_revocado` y el nuevo identifica la plaza; revocar la deja sin QR vigente. |
| Panel | Compilación | `tsc` y `vite build` pasan. No se recorrió en navegador. |

**Pendiente para piloto** · Confirmar bloques habilitados, inventario, horarios, permisos, salidas peatonales y ubicación de las plazas preferentes. 04B aplica las habilitaciones a la asignación.

### 03B · Evidencia

Rama `tramo/03b-horario`. Pruebas en `apps/api/test/horario.test.js` contra PostgreSQL real con el calendario de prueba `apps/api/test/fixtures/horario.ics`. `BloqueClase` impide solapes del mismo día con `EXCLUDE USING gist` sobre `int4range`.

| Criterio | Estado | Evidencia (API) |
| --- | --- | --- |
| Los bloques persisten al reabrir la app | Verificado (API) | El horario vive en la API (`GET/PUT /horario`, `POST/PATCH/DELETE /horario/bloques`); se lee igual desde otra sesión. Cada cuenta ve y edita solo el suyo. |
| Bloques inválidos y archivos ilegibles se informan sin perder el horario anterior | Verificado (API) | `PUT /horario` valida todo antes de reemplazar: término anterior al inicio, destino inexistente y solapes se informan por bloque (`bloques.N.campo`) y el horario previo queda igual. Un archivo sin calendario o sin eventos responde `archivo_ilegible`. |
| Importar un archivo de prueba permite revisar los bloques antes de guardar | Verificado (API) | `POST /horario/importar` no guarda: expande `BYDAY` (lunes y miércoles), marca «ED113» con dos coincidencias (`ED113` y `ED113-SJ`) y una sala inexistente para elegir destino, y omite el evento de día completo. Tras elegir, `PUT /horario` guarda los cuatro bloques. |
| Editar el horario conserva la reserva confirmada | Verificado (API) | Reemplazar el horario deja la reserva `confirmada` con su destino e intervalo. El cambio de reserva se completa en 04B. |
| App: horario, editor e importación | Compilación | Cuenta → Mi horario: bloques por día, editor con día, horas y destino, e importación con `expo-document-picker` y vista previa donde se elige el destino de los bloques dudosos y se agrega o reemplaza el horario. `tsc` y `expo export` pasan. **Pendiente**: recorrer el flujo en el teléfono. |

**Pendiente para piloto** · Validar un `.ics` representativo y el mapeo de sus ubicaciones. Una integración directa con sistemas UC requiere autorización.
