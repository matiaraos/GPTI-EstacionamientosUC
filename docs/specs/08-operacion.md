# 08 · Operación y piloto

**Fuente** · RF-19–21, RNF del DRS, plan de pruebas y certificado de aceptación. **Dependencias** · [02](02-inventario.md), [04](04-reservas.md), [05](05-uso-y-ranking.md), [06](06-avisos.md) y [07](07-recurrencia.md).

El personal autorizado consulta ocupación, resuelve incidentes y obtiene un reporte agregado del piloto.

## Implementación

- Desde el panel y la API, mostrar plazas libres, reservadas, en uso y bloqueadas. Diferenciar salida registrada, vencimiento e incidente pendiente de verificación. Registrar las resoluciones con responsable y motivo.
- Reportar participantes, asignaciones con horario, errores, disponibilidad y satisfacción, con período y denominadores. Separar simulación de medición real y conservar solo resultados anónimos al cierre según el DRS.

## Aceptación

- Los totales del panel coinciden con los eventos y las reservas del período consultado. Un incidente sin validar no sanciona al usuario.
- Registrar evidencia de la meta del piloto de al menos 50 usuarios, al menos 90 % de asignaciones con horario, satisfacción de al menos 80 %, disponibilidad superior al 95 %, errores de asignación inferiores al 5 % y cero dobles reservas.
- Verificar el flujo completo en Android e iOS. Medir aparte el objetivo de al menos 95 % de escaneos exitosos al primer intento (PP-15). El porcentaje de reservas con check-in corresponde a una métrica distinta.
- Confirmar el proceso de eliminación de datos identificables y que el reporte final conserve solo datos agregados.

## Decisiones abiertas

Confirmar la zona, inventario y señalética, período de monitoreo, forma de reclutamiento y quién custodia la evidencia del piloto.
