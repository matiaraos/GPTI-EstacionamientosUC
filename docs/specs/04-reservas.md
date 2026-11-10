# 04 · Reservas diarias

**Fuente** · RF-06–09, RN-02–04 y RN-10, PP-06–10 y PP-25. **Dependencias** · [01](01-cuentas.md), [02](02-inventario.md) y [03](03-horarios.md).

Desde la app, un usuario puede solicitar una plaza, ver su confirmación, cancelarla antes del check-in o entrar en lista de espera cuando se agotan los cupos.

## Implementación

- La API filtra plazas habilitadas y libres durante todo el intervalo. Selecciona por cercanía a la primera clase, usa la última como desempate y usa el destino declarado si no hay clases. Entre solicitudes simultáneas se aplica ranking descendente y luego antigüedad. El puntaje inicial sirve hasta que la spec 05 habilite los ajustes por uso.
- Confirmar en una transacción. Impedir solapamientos por plaza, cuenta y patente, y devolver la reserva existente ante un reintento de la misma operación. La salida queda excluida del intervalo.
- Permitir cancelar antes del check-in y procesar la espera cuando se libera capacidad compatible. Exigir consentimiento para entrar a la lista. Si falla un cambio de reserva, conservar la confirmación anterior. La spec 06 agrega la entrega de avisos.

## Aceptación

- La plaza se ajusta al intervalo, la cercanía y la autorización. El usuario sin habilitación vigente nunca recibe una plaza preferente.
- Sin cupo, se informa la situación y se ofrece la espera o una zona habilitada con disponibilidad. Cuando se libera cupo, se respeta ranking y antigüedad.
- Con solicitudes concurrentes no hay dobles reservas. Dos intervalos contiguos pueden reservar la misma plaza. Repetir una solicitud confirmada no consume otro cupo.
- La prueba de carga del flujo de asignación verifica el máximo de cinco segundos con 50 usuarios concurrentes.

## Decisiones abiertas

Definir cómo se mide la cercanía en el catálogo y qué mecanismo agrupa solicitudes simultáneas antes de programar la prioridad. Validar ambos con escenarios reproducibles.
