# Alcance técnico de MiEstacionamientoUC

El [reporte de avance](Entregas/Entrega%202/2.6%20Reporte%20de%20Avance%20-%20Grupo%2018.pptx) define el stack, el [DRS v1.2](Entregas/Entrega%202/2.1%20Documento%20de%20requerimientos%20de%20software%20-%20Grupo%2018.docx) describe el MVP y el [plan de pruebas](Entregas/Entrega%202/2.4%20Plan%20de%20Pruebas%20-%20Grupo%2018%20%282%29.xlsx) detalla sus criterios. Se toman como referencias de alcance las solicitudes y el certificado de la Entrega 3.

## Dependencias y flujos

| Requisito | Base y trabajo pendiente |
| --- | --- |
| RF-01–03 · Cuenta UC | `jsonwebtoken`, `bcrypt`, `expo-secure-store` y `nodemailer`. Implementar registro con patente, acceso por rol y recuperación por correo. Definir el proveedor de correo. |
| RF-04–05 · Horarios | Mantener ingreso manual, permanencia y destino. El [certificado de aceptación](Entregas/Entrega%203/3.3%20Certificado%20de%20Aceptaci%C3%B3n%20-%20Grupo%2018%20%281%29.docx) describe importación `.ics`, para la cual se incluye `node-ical`. Una conexión directa a sistemas UC requiere autorización. |
| RF-06–09 y RF-14–15 · Reservas y ranking | Implementar selección por disponibilidad, cercanía y prioridad, lista de espera y ajustes de ranking con historial. Persistir los cambios en transacciones que eviten solapamientos por plaza, cuenta y patente, y duplicados por reintento. Usar intervalos con salida excluida y reglas horarias de `America/Santiago`. |
| RF-10–13 · Entrada y salida | `qrcode` genera los códigos por plaza. La app incorpora `expo-camera` y `expo-location`. Implementar validación en el servidor de la cuenta, la reserva, el QR y la ventana horaria. El check-in requiere ubicación en la zona piloto. El cambio a QR reemplaza el OCR de patentes. |
| RF-16–17 · Avisos | `expo-notifications` y `nodemailer`. Implementar confirmaciones y recordatorios de salida después de registrar el resultado de la operación. |
| RF-18–21 · Administración | La migración inicial crea la tabla de zonas. Quedan pendientes la gestión de plazas y bloqueos, la ocupación, los incidentes y los indicadores agregados. |
| RF-22 · Recurrencia | [SC-001](Entregas/Entrega%203/3.2%20Solicitud%20de%20Cambio%20SC-001%20-%20Grupo%2018.docx). Modelar series semanales, cancelación por fecha o serie, renovación según cumplimiento y un máximo del 30 % de las plazas de la zona piloto. |
| RF-23 · Accesibilidad | [SC-002](Entregas/Entrega%203/3.2%20Solicitud%20de%20Cambio%20SC-002%20-%20Grupo%2018.docx). Registrar autorización con vencimiento, validar el acceso a plazas preferentes en la API y guardar solo el estado administrativo y su vigencia. |
| RNF-01–02 · Calidad | El flujo de asignación deberá responder en hasta cinco segundos con 50 usuarios concurrentes (PP-25). La disponibilidad deberá superar el 95 % durante el horario habilitado (PP-24). Los chequeos actuales cubren únicamente el arranque y la conexión con PostgreSQL. |

La EDT, el cronograma, el presupuesto y el registro de riesgos sitúan la señalética, el inventario de la zona piloto y la autorización institucional como insumos del despliegue. Las métricas, el acta de cierre y el registro de lecciones de la Entrega 3 aportan criterios de seguimiento del piloto. La evidencia verificable de este repositorio corresponde al entorno de desarrollo y sus chequeos.
