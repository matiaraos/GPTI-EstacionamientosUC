# 07 · Reservas recurrentes

**Fuente** · RF-22, SC-001 y PP-29–34. **Dependencias** · [04](04-reservas.md), [05](05-uso-y-ranking.md) y [06](06-avisos.md).

El usuario elegible puede fijar bloques semanales, cancelar una fecha o una serie y renovar según su cumplimiento.

## Implementación

- Desde la app y la API, registrar la serie y sus ocurrencias con el mismo control de conflictos que una reserva diaria. Aplicar un máximo del 30 % de las plazas de la zona piloto, incluso al crear o renovar en paralelo.
- Revisar el cumplimiento automáticamente el fin de semana antes de renovar. Una ausencia revoca el beneficio y libera la plaza correspondiente según SC-001. Cancelar una fecha conserva la serie y cancelar la serie libera las ocurrencias futuras.

## Aceptación

- En una zona de diez plazas, una nueva serie que exceda tres plazas recurrentes se rechaza. El usuario aún puede solicitar una reserva diaria.
- Una semana que cumple genera la siguiente sin duplicados si se reintenta la tarea. Una semana incumplida no se renueva.
- Cancelación por fecha, cancelación de serie y ausencia producen los estados y liberaciones previstos.

## Decisión abierta

Confirmar el umbral de elegibilidad y los límites de bloques por persona. Usar los escenarios PP-29–34 para fijar el comportamiento antes de habilitarlo en el piloto.
