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
| Flujos principales | [05B](05-uso-y-ranking.md#05b--vencimientos-y-ranking) | Vencimientos y ranking | RF-13–15 | 05A | En curso · [evidencia](#05b--evidencia) |
| Flujos principales | [04B](04-reservas.md#04b--asignación-completa-y-espera) | Prioridad, cambios y espera | RF-06–09, RF-23, RNF-01 | 02B, 03B, 04A, 05B | En curso · [evidencia](#04b--evidencia) |
| Flujos principales | [08A](08-operacion.md#08a--ocupación-e-incidentes) | Ocupación e incidentes | RF-19–20 | 02B, 05A | Verificada · [evidencia](#08a--evidencia) |
| Piloto | [06](06-avisos.md#06--avisos) | Avisos y recordatorios | RF-16–17 | 04B, 05B | En curso · [evidencia](#06--evidencia) |
| Piloto | [07](07-recurrencia.md#07--reservas-recurrentes) | Recurrencia semanal | RF-22 | 06 | En curso · [evidencia](#07--evidencia) |
| Piloto | [08B](08-operacion.md#08b--indicadores-y-cierre-del-piloto) | Indicadores y cierre | RF-21 y RNF del piloto | 01B, 07, 08A | En curso · [evidencia](#08b--evidencia) |

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

**Horario UC simulado** · Rama `tramo/03b-horario-uc`. Pruebas en `apps/api/test/horario-uc.test.js` con `docs/campus-san-joaquin/cursos-uc.json` (121 secciones reales de San Joaquín en 2026-2 y 3 estudiantes de prueba).

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Formato UC de módulos y actividades | Verificado (API) | `L-W-V:4` produce tres bloques de 12:20 a 13:30; `M:5,6` un bloque de 14:50 a 17:20; formatos o módulos desconocidos se rechazan al cargar. La carga es idempotente, conserva los IDs de las actividades y enlaza más del 90 % de las salas con el catálogo. |
| Conectar y revisar antes de guardar | Verificado (API) | Conectar un estudiante de prueba no cambia el horario. La vista previa marca las actividades sin sala o fuera del catálogo y los topes (quedan fuera hasta elegir destino o activarlas) y si cada bloque es nuevo, cambió o sigue igual. Probado también con `curl` contra la API local con el seed (`ing-2`: 11 bloques guardados, 3 por resolver). |
| Modificación de horario | Verificado (API) | Cambiarse de sección muestra los bloques nuevos y los que saldrán, y sincronizar los aplica. Agregar un curso ya inscrito, cambiar a otra sigla o tocar una sección no inscrita se rechazan. Un destino elegido para una actividad sin sala se conserva al volver a sincronizar. |
| Bloques propios y reservas | Verificado (API) | Sincronizar reemplaza solo los bloques UC; `PUT /horario` (bloques propios o `.ics`) no toca los UC. Bloques ajenos a la inscripción se rechazan sin cambios. Las clases sincronizadas definen el destino de la reserva (C003) y el desempate (B25). Desconectar quita los bloques UC o los conserva como propios. |
| App | Compilación | Mi horario muestra la conexión, la inscripción (cambiar sección, agregar, quitar), la búsqueda de secciones como Buscacursos y la revisión con un interruptor por bloque; el editor permite elegir módulos UC. `tsc` y `expo export` pasan. **Pendiente**: recorrer en el teléfono. |

**Pendiente para piloto** · Validar un `.ics` representativo y el mapeo de sus ubicaciones. Una integración directa con sistemas UC requiere autorización: reemplazaría a los estudiantes de prueba con el inicio de sesión UC y la lectura autorizada de la inscripción.

### 05B · Evidencia

Rama `tramo/05b-ranking`. Pruebas en `apps/api/test/ranking.test.js` contra PostgreSQL real con reloj fijo. Estados nuevos `ausente` y `vencida` (liberan capacidad) y `AjusteRanking` con `claveOrigen` única. Tabla de ajustes configurable: inicial 100, ausencia −10, vencimiento −5, salida tardía −3 y salida a tiempo +1. `procesarVencimientos(ahora)` corre cada `VENCIMIENTOS_INTERVALO_S` en la API y desde el panel.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Una ausencia o un vencimiento genera el estado y el ajuste correctos una sola vez | Verificado (API) | Sin check-in a las 09:15 sigue confirmada; a las 09:16 queda `ausente` con −10. Sin salida a las 10:11 (fin 10:00 + 10 min) queda `vencida` con −5. Repetir el proceso, también tres veces en paralelo, no cambia nada. Estado y ajuste se escriben en la misma transacción. |
| Liberar capacidad en el vencimiento | Verificado (API) | Tras la ausencia, otra cuenta obtiene la misma plaza en el resto del intervalo; la reserva ya no admite entrada ni cancelación. Una reserva vencida libera el uso activo y aún admite registrar la salida sin otro ajuste. |
| Una salida a tiempo queda diferenciada | Verificado (API) | Salida a tiempo → `finalizada` con +1; salida tardía antes del proceso → `finalizada` con −3; sin salida → `vencida` con −5. |
| Un error de lectura no sanciona | Verificado (API) | QR ilegible y QR de otra plaza no generan ajustes ni cambian la reserva. |
| El mal uso requiere validación administrativa | Verificado (API) | Solo `POST /admin/cuentas/:id/ranking/rectificaciones` (rol `admin`, justificación obligatoria e `Idempotency-Key`) registra sanciones manuales, con su autor; un usuario recibe `403` y el reintento no duplica. |
| Puntaje e historial con motivo y reserva | Verificado (API) · Compilación (app y panel) | `GET /ranking` devuelve puntaje e historial con motivo y reserva; la persona ve «Administración» como autor de una rectificación. App: Cuenta → Mi puntaje. Panel: Ranking con historial, rectificación y proceso manual. `tsc`, `expo export` y `vite build` pasan. **Pendiente**: revisar la pantalla en el teléfono. |

**Pendiente para piloto** · Confirmar la tabla de ajustes y niveles RN-06 y RN-07. Los bloqueos por incidentes verificados se agregan en 08A.

### 04B · Evidencia

Rama `tramo/04b-asignacion`. Pruebas en `apps/api/test/asignacion.test.js` contra PostgreSQL real. La reserva guarda `origenDestino` (`horario` o `declarado`), el destino de desempate y, en un cambio, la reserva que reemplaza. `SolicitudEspera` con consentimiento, asignación única y exclusión de esperas pendientes solapadas por cuenta.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Dos bloques empatados para la primera clase: gana el más cercano a la última | Verificado (API) | Con PARKING-7 y PARKING-5 a 200 m de la primera clase, gana PARKING-5 (100 m a la última frente a 300 m). El desempate aplica ruta peatonal antes que línea recta y deja al final el bloque sin distancia a la última clase. Sin clases en la visita se usa el destino declarado, que entonces es obligatorio. |
| Solicitudes simultáneas por ranking y luego antigüedad | Verificado (API) | Con ventana de 400 ms y una plaza libre, la cuenta de mayor puntaje obtiene la plaza aunque llegue 100 ms después; con igual puntaje gana la solicitud más antigua. Ventana configurable `SIMULTANEIDAD_MS` (1 s por defecto). |
| Una autorización vencida excluye plazas preferentes | Verificado (API) | Vigente: recibe la preferente A1 (se usan primero para no restar regulares). Vencida, vencida al inicio de la visita o revocada: recibe una regular. Una cuenta habilitada también recibe regulares. |
| Una alternativa fallida conserva la reserva anterior | Verificado (API) | `POST /reservas/:id/cambiar` cancela la original y asigna la alternativa en una transacción: sin cupo responde `409` y la original sigue `confirmada` en su plaza. Aceptada, la nueva guarda `reemplazaId`, puede solaparse con la original y el reintento devuelve la misma. |
| Una liberación atiende al siguiente candidato compatible | Verificado (API) | Al cancelar A1, de tres esperas se asigna la de mayor puntaje entre las compatibles (la de mayor puntaje que necesitaba hasta las 14:00 se salta); repetir no duplica. Una espera cancelada no se asigna y una pendiente pasada su ventana queda `vencida`. La espera exige `consentimiento: true`. También se atiende al registrar salidas, vencimientos, levantar bloqueos o activar plazas. |
| PP-25: máximo de 5 s con 50 usuarios concurrentes | Verificado (local) | 50 solicitudes simultáneas contra PostgreSQL real con ventana de 400 ms: máximo ~2,2 s, 5 reservas, 45 `sin_cupo` y ninguna plaza repetida. `tests/load/asignacion.js` repite la prueba con k6 contra la API desplegada. |
| App | Compilación | Reservar muestra las clases que definen el destino y ofrece la lista de espera con confirmación al no haber cupo; Mi reserva lista las esperas y permite cambiar el horario. `tsc` y `expo export` pasan. **Pendiente**: recorrer en el teléfono. |

**Pendiente de producto** · Confirmar las conexiones peatonales inferidas y la ventana de simultaneidad. El orden por ranking se resuelve en el proceso de la API (una instancia en el piloto); la base sigue impidiendo solapes con varias. Ejecutar k6 en el entorno del piloto.

### 08A · Evidencia

Rama `tramo/08a-operacion`. Pruebas en `apps/api/test/operacion.test.js` contra PostgreSQL real. `Incidente` (pendiente, validado, descartado, cerrado) con responsable y motivo; los ajustes y bloqueos que origina quedan enlazados al incidente.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Los totales coinciden con eventos y reservas del período | Verificado (API) | A las 10:00, `GET /admin/ocupacion` informa A1 en uso, A2 reservada, B1 bloqueada, B2 inactiva y B3 libre (1 de cada una); a las 08:00 A2 aún figura libre. `GET /admin/ocupacion/periodo` informa 3 reservas (finalizada, cancelada y ausente), 1 entrada y 1 salida y 1 salida a tiempo, igual que el conteo directo de `Reserva` y `EventoReserva`. Distingue salida registrada, vencimiento, ausencia e incidentes pendientes. |
| Una cuenta común recibe rechazo | Verificado (API) | Ocupación, período e incidentes (listar, crear, resolver, cerrar) responden `403`. Una persona solo reporta incidentes de sus propias reservas (`POST /incidentes`). |
| Un incidente sin validar no genera una sanción | Verificado (API) | Reportes pendientes (de la persona y de administración) no generan ajustes; descartar no sanciona y rechaza una sanción. Validar registra responsable y motivo, descuenta una sola vez (`claveOrigen` `incidente:<id>`) y puede bloquear la plaza: queda fuera de nuevas asignaciones, el bloqueo no se levanta a mano y se levanta al cerrar el incidente. |
| Panel | Compilación | Páginas Ocupación (totales, plazas por bloque, resumen del período) e Incidentes (registro, validación, descarte y cierre). `tsc` y `vite build` pasan. No se recorrió en navegador. |

### 06 · Evidencia

Rama `tramo/06-avisos`. Pruebas en `apps/api/test/avisos.test.js` contra PostgreSQL real con un transporte push de prueba y el correo en memoria. `Aviso` funciona como bandeja de salida con `claveDeduplicacion` única; `CanalAviso` guarda los tokens de Expo Push. Canal local de prueba: Mailpit.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Registrar el resultado antes de enviar, con fecha, horario y plaza | Verificado (API) | La confirmación se crea en la misma transacción que la reserva («lunes, 16 de noviembre, 09:00–12:00, plaza A1 en …»); un cambio que falla no deja avisos. Cancelación, cambio y lista de espera generan su aviso en la transacción de su operación. |
| Confirmación, cancelación, cambio y falta de disponibilidad según el resultado real | Verificado (API) | Secuencia confirmación → cambio → cancelación → sin cupo; repetir la cancelación o reintentar la solicitud sin cupo con la misma clave no duplica avisos. Probado también contra la API local: confirmación y cancelación llegaron a Mailpit. |
| Recordatorios al terminar la última clase y a la salida; uno si coinciden | Verificado (API) | Con clase hasta las 11:30 y salida a las 12:00 hay dos; con clase hasta las 12:00, uno. Sin clases, solo el de la salida declarada. |
| Cancelar recordatorios al cancelar o hacer check-out | Verificado (API) | Al cancelar, cambiar, registrar la salida o quedar ausente, los pendientes pasan a `cancelado`; a la hora programada no se envían. Al enviar se comprueba además que la reserva siga activa. |
| Fallas y reintentos no cambian ni duplican la reserva | Verificado (API) | Push fallido → correo. Correo caído → tres intentos con espera creciente y luego `fallido`, sin tocar la reserva ni duplicar el aviso. Dos procesos simultáneos entregan cada aviso una vez. Un token `DeviceNotRegistered` se desactiva. |
| Consultar el estado si la entrega falla | Verificado (API) · Compilación (app) | `GET /avisos` muestra cada aviso con su estado de entrega y los recordatorios programados. App: Cuenta → Avisos y registro del dispositivo con `expo-notifications`; al tocar una notificación abre Mi reserva. `tsc` y `expo export` pasan. |

**Pendiente para piloto** · Las notificaciones remotas requieren una compilación con proyecto EAS (`extra.eas.projectId`); en Expo Go los avisos llegan por correo y a la bandeja. Confirmar proveedores y probar la entrega en un dispositivo del piloto antes de dar por verificado el canal.

### 07 · Evidencia

Rama `tramo/07-recurrencia`. Pruebas en `apps/api/test/recurrencia.test.js` contra PostgreSQL real con la zona piloto de prueba (PARKING-2, Estacionamiento Ingeniería, 10 plazas). `SerieReserva` y `BloqueSerie`; cada ocurrencia es una reserva normal con `(bloqueSerieId, fechaOcurrencia)` único. Parámetros configurables: zona piloto, tope 30 %, puntaje mínimo 100, 5 bloques por persona y −10 adicional al revocar (SC-001).

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Serie y ocurrencias con el mismo orden de cercanía y control de conflictos | Verificado (API) | Crear una serie de lunes y miércoles genera las reservas del 23 y 25 de noviembre en la zona piloto con la asignación diaria (bloqueo por fecha, restricciones de exclusión y aviso); el reintento con la misma clave devuelve la misma serie. |
| En una zona de diez plazas, una serie que excede tres plazas recurrentes se rechaza; la reserva diaria sigue disponible | Verificado (API) | La cuarta serie responde `409 tope_recurrente` («3 de 3 plazas… 30 % de 10») y esa cuenta reserva por día sin problema. Seis creaciones simultáneas: tres aceptadas y tres rechazadas (bloqueo consultivo por zona en la misma transacción). |
| Elegibilidad y límite de bloques | Verificado (API) | Con 90 puntos responde `403 no_elegible`; seis bloques superan el máximo de cinco. |
| Semana cumplida se renueva sin duplicados; incumplida no se renueva | Verificado (API) | El sábado se genera la semana siguiente; repetir la tarea, también en paralelo, no duplica. El viernes no actúa. Una salida vencida en la semana revisada revoca la serie el domingo y no la renueva. |
| Cancelación por fecha, de serie y ausencia | Verificado (API) | Cancelar una fecha conserva la serie y el registro de esa fecha, que la renovación no recrea. Cancelar la serie libera las fechas futuras y el cupo de la zona. Una ausencia (09:16 del lunes) revoca la serie al momento, cancela el miércoles y aplica −10 por ausencia y −10 por revocación una sola vez, con aviso. |
| App | Compilación | Reservar → Reservas semanales: requisitos (puntaje, bloques, cupo de la zona), series con sus fechas, cancelar una fecha o la serie, y nueva serie con días, horario y destino (o el de las clases). `tsc` y `expo export` pasan. **Pendiente**: recorrer en el teléfono. |

**Pendiente para piloto** · Confirmar el umbral de elegibilidad, los límites de bloques por persona, la zona piloto y la penalización con los escenarios PP-29–34.

### 08B · Evidencia

Rama `tramo/08b-indicadores`. Pruebas en `apps/api/test/piloto.test.js` contra PostgreSQL real. Nuevas fuentes: `LecturaQR` (cada intento de lectura, sin contenido ni ubicación), `EncuestaSatisfaccion` (1 a 5 tras la salida), `MedicionDisponibilidad` (monitoreo externo) y `ResultadoPiloto` (agregados anónimos). `Cuenta.simulada` separa la simulación de la medición real.

| Criterio | Estado | Evidencia |
| --- | --- | --- |
| Reporte agregado con período y denominadores | Verificado (API) | `GET /admin/indicadores` entrega por período y modo: participantes (personas con reserva / cuentas registradas), asignaciones con horario, satisfacción (respuestas 4–5 / respuestas), disponibilidad (promedio de mediciones), errores de asignación (incidentes validados / reservas), dobles reservas (pares con uso superpuesto) y PP-15 aparte. En el escenario de prueba: 2/2, 1/2, 1/2, 99,5 %, 1/2, 0 y 1/2. |
| Cero dobles reservas | Verificado (API) | El indicador detecta un par de usos superpuestos en la misma plaza insertado a propósito; con el flujo normal es 0, también en la simulación. |
| Simulación identificada que no acredita las metas | Verificado (API) | `simularPiloto` usa los servicios reales con cuentas `simulada` y un reloj propio; su reporte dice que no acredita y la medición real del mismo período no cambia. `npm run piloto:simular` con 60 cuentas y 5 días: 35 participantes, 84,1 % con horario, 86,5 % de satisfacción, 0 dobles y 95,9 % de QR al primer intento. |
| PP-15 medido por separado | Verificado (API) | La primera lectura de entrada de cada reserva (`ok` o el código del error) define el indicador; un QR de otra plaza seguido del correcto cuenta como segundo intento. |
| Cierre de datos verificado con registros ficticios | Verificado (API) | `cerrarPiloto` guarda los indicadores de todo el período (real y simulación) y elimina cuentas de usuario, patentes, sesiones, horarios, reservas, eventos, lecturas, encuestas, avisos e incidentes. Conserva catálogo, inventario y cuentas de administración; los resultados guardados no contienen correos, patentes ni comentarios. `npm run piloto:cerrar` exige `--confirmar`. |
| Panel y app | Compilación | Panel: Indicadores (período, real o simulación, metas con numerador y denominador, disponibilidad medida, resultados guardados). App: encuesta de 1 a 5 al registrar la salida. `tsc`, `vite build` y `expo export` pasan. |

**Pendiente para piloto** · Verificar el flujo en Android e iOS y medir con usuarios reales: las metas (≥ 50 participantes, ≥ 90 % con horario, ≥ 80 % de satisfacción, > 95 % de disponibilidad, < 5 % de errores y 0 dobles reservas) solo se acreditan con la medición real. Confirmar zona, señalética, período de monitoreo, reclutamiento y responsable de la evidencia. Ejecutar el cierre al terminar el piloto.
