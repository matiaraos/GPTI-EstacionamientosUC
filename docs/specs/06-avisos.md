# 06 · Avisos

**Fuente** · RF-16–17, PP-13 y PP-21. **Dependencias** · [03](03-horarios.md), [04](04-reservas.md) y [05](05-uso-y-ranking.md).

El usuario recibe el resultado de su solicitud o cambio de reserva y recordatorios al finalizar su última clase y al llegar la hora de salida declarada.

## Implementación

- Registrar el resultado de la reserva antes de enviar la confirmación o el aviso de cambio. Incluir fecha, horario y plaza cuando corresponda. Usar notificaciones de la app y correo institucional como canal alternativo.
- Programar recordatorios al finalizar la última clase y al llegar la salida declarada. Para usuarios sin clases, usar la permanencia declarada. Si coinciden, enviar uno. Cancelar los pendientes al cancelar la reserva o completar el check-out.
- Permitir consultar el estado de la reserva si la entrega del aviso falla.

## Aceptación

- Confirmación, cancelación, cambio y falta de disponibilidad se comunican según el resultado real.
- Fallas y reintentos de envío no cambian ni duplican la reserva. Un recordatorio cancelado no se entrega después del check-out.

## Decisión abierta

Confirmar los proveedores y probar la entrega en un dispositivo del piloto antes de dar por verificado el canal.
