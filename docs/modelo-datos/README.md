# Modelo de datos de MiEstacionamientoUC

Propuesta para la API y PostgreSQL. El esquema Prisma actual parte con `ParkingZone`. Los diagramas muestran las entidades que se incorporarían conforme se implementen los [tramos del MVP](../specs/README.md).

| Documento | Qué muestra |
| --- | --- |
| [Modelo de la demo](01-demo.md) | Cuentas, vehículos, catálogo, reservas y registro de entrada y salida por QR. Incluye las reglas que evitan reservas dobles. |
| [Ampliaciones del MVP](02-mvp.md) | Horarios, autorizaciones, lista de espera, ranking, avisos, recurrencia e incidentes. |

Los diagramas usan Mermaid y se renderizan al abrir estos Markdown en GitHub. `PK` identifica la clave primaria, `FK` una referencia a otra entidad y `UK` un valor único. Los nombres y campos sirven como referencia para implementar las specs.

| Tramo | Datos que incorpora |
| --- | --- |
| 01A y 01B | Cuenta, vehículo, sesión y recuperación |
| 02A y 02B | Catálogo de bloques, salas, edificios y plazas, cercanía, QR, horario, bloqueos y autorizaciones |
| 03A y 03B | Solicitud con destino y permanencia, y bloques de clases guardados |
| 04A y 04B | Reserva, control de reintentos y lista de espera |
| 05A y 05B | Entrada, salida, ausencia, vencimiento e historial de ranking |
| 06 y 07 | Avisos programados y series semanales |
| 08A y 08B | Incidentes, ocupación e indicadores agregados |
