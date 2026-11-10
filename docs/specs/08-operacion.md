# 08 · Operación y piloto

**Fuente** · RF-19–21, RNF del DRS, plan de pruebas y certificado de aceptación. **Dependencias** · [02](02-inventario.md), [04](04-reservas.md), [05](05-uso-y-ranking.md), [06](06-avisos.md) y [07](07-recurrencia.md).

El personal autorizado consulta ocupación, resuelve incidentes y obtiene un reporte agregado del piloto.

## 08A · Ocupación e incidentes

**Base y dependencias** · 02B y 05A.

**Entrega** · Panel y API para mostrar plazas libres, reservadas, en uso y bloqueadas. Distinguir salida registrada, vencimiento cuando exista 05B e incidente pendiente. Registrar resoluciones con responsable y motivo.

**Aceptación** · Los totales coinciden con eventos y reservas del período. Una cuenta común recibe rechazo. Un incidente sin validar no genera una sanción.

## 08B · Indicadores y cierre del piloto

**Base y dependencias** · 01B, 07 y 08A, junto con sus dependencias.

**Entrega** · Reporte agregado con período y denominadores para participantes, asignaciones con horario, errores, disponibilidad y satisfacción. Distinguir simulación y medición real. Eliminar datos identificables al cierre y conservar solo resultados anónimos.

**Aceptación** · Comprobar las metas de al menos 50 usuarios, al menos 90 % de asignaciones con horario, satisfacción de al menos 80 %, disponibilidad superior al 95 %, errores de asignación inferiores al 5 % y cero dobles reservas. Verificar el flujo en Android e iOS. Medir por separado el objetivo de al menos 95 % de lecturas QR al primer intento (PP-15). Una simulación debe quedar identificada y no acreditar las metas del piloto real. Verificar el cierre de datos con registros ficticios antes del piloto.

**Pendiente para piloto** · Confirmar zona, señalética, período de monitoreo, reclutamiento y responsable de la evidencia.
