# 05 · Entrada, salida y ranking

**Fuente** · RF-10–15, RN-05–08 y PP-11–20/PP-28. **Dependencias** · [02](02-inventario.md) y [04](04-reservas.md).

La persona registra llegada y salida escaneando el QR de su plaza. La app muestra el estado de la reserva y el historial de cumplimiento.

## Implementación

- La app escanea el QR y pide ubicación para registrar la llegada. La API comprueba sesión, plaza, reserva vigente, ventana horaria y, en check-in, presencia dentro de la zona piloto. Usar la hora del servidor.
- Registrar entrada, salida, ausencia o vencimiento con estados diferenciados. Un check-out confirmado libera capacidad. El cierre por vencimiento libera capacidad lógica y conserva los bloqueos por incidentes verificados.
- Aplicar el ajuste de ranking una vez por hecho y conservar historial, motivo y reserva. Las rectificaciones administrativas requieren justificación.

## Aceptación

- Se rechaza QR de otra plaza, revocado o ilegible. Se rechaza check-in fuera de zona o de tolerancia. Un error de lectura permite reintentar sin sanción.
- El check-in válido marca la plaza en uso. El check-out válido la libera. Repetir cualquiera de los dos no duplica eventos ni ajustes.
- Las tareas de vencimiento distinguen ausencia y salida no registrada. Una sanción por mal uso exige validación administrativa.

## Decisiones abiertas

Confirmar el perímetro del piloto, las tolerancias propuestas de 15 minutos para llegada y 10 para salida, y la tabla de ajustes y niveles de RN-06/RN-07 antes de fijar pruebas operativas.
