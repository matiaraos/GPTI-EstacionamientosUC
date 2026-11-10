# 02 · Inventario y accesibilidad

**Fuente** · RF-18, RF-23 y SC-002. **Dependencia** · [01](01-cuentas.md).

La Dirección de Campus puede configurar la oferta de plazas y administrar quién tiene acceso a las preferentes. Este inventario alimenta la asignación diaria.

## 02A · Catálogo geográfico y plazas de prueba

**Base y dependencias** · 01A y migración inicial de zonas. Usar el [catálogo de San Joaquín](../campus-san-joaquin/README.md) como fuente geográfica.

**Entrega** · Cargar los bloques, salas y edificios del GeoJSON con sus identificadores de origen. Cargar el CSV como una distancia por par de bloque y sala, conservando metros, método y calidad de las conexiones. Para los edificios habilitados como destinos de la demo, generar distancias con la misma red y reglas usando sus ubicaciones publicadas. La API comparte con 03A los destinos con ID, nombre y tipo (`sala` o `edificio`). Habilitar al menos dos bloques con plazas regulares, horarios y QR de prueba para demostrar el cambio de bloque cuando se agotan los cupos del primero.

**Aceptación** · Cargar el catálogo dos veces conserva los identificadores y evita duplicados. Salas con el mismo nombre conservan IDs distintos. Un acceso vehicular queda fuera de los bloques reservables. La app puede consultar los destinos y la API identifica la plaza de prueba correcta a partir de su QR.

## 02B · Inventario y autorizaciones

**Base y dependencias** · 01A, 02A y 04A.

**Entrega** · Panel y API para gestionar zonas, plazas, edificios, horarios, QR, bloqueos y autorizaciones. Al desactivar una plaza, conservar historial y advertir de reservas afectadas. Guardar estado y vigencia de las autorizaciones. 04B aplicará esos datos a la asignación.

**Aceptación** · Una cuenta común no puede cambiar inventario ni autorizaciones. Una plaza bloqueada o inactiva queda excluida de nuevas asignaciones. Se distinguen plazas regulares y preferentes. Una habilitación revocada o vencida deja de ser válida y el flujo no solicita certificados ni motivos médicos.

**Pendiente para piloto** · Confirmar qué bloques se habilitarán, su inventario, horarios, permisos, salidas peatonales y ubicación de las plazas preferentes.
