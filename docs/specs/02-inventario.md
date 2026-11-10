# 02 · Inventario y accesibilidad

**Fuente** · RF-18, RF-23 y SC-002. **Dependencia** · [01](01-cuentas.md).

La Dirección de Campus puede configurar la oferta de plazas y administrar quién tiene acceso a las preferentes. Este inventario alimenta la asignación diaria.

## 02A · Catálogo ficticio

**Base y dependencias** · 01A y migración inicial de zonas.

**Entrega** · API y PostgreSQL con una zona ficticia, edificios identificables por ID y nombre, plazas regulares activas, horarios de prueba y un QR identificable por plaza. Compartir con 03A un catálogo de destinos con ID y nombre. Usar datos reproducibles para integración y demo.

**Aceptación** · La app puede consultar destinos y la API identifica la plaza correcta a partir de su QR. Un destino inexistente se rechaza. La carga repetida de los datos de demo no duplica plazas.

## 02B · Inventario y autorizaciones

**Base y dependencias** · 01A, 02A y 04A.

**Entrega** · Panel y API para gestionar zonas, plazas, edificios, horarios, QR, bloqueos y autorizaciones. Al desactivar una plaza, conservar historial y advertir de reservas afectadas. Guardar estado y vigencia de las autorizaciones. 04B aplicará esos datos a la asignación.

**Aceptación** · Una cuenta común no puede cambiar inventario ni autorizaciones. Una plaza bloqueada o inactiva queda excluida de nuevas asignaciones. Se distinguen plazas regulares y preferentes. Una habilitación revocada o vencida deja de ser válida y el flujo no solicita certificados ni motivos médicos.

**Pendiente para piloto** · Confirmar inventario, horarios y ubicación de las plazas preferentes.
