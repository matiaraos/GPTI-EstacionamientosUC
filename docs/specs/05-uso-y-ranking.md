# 05 · Entrada, salida y ranking

**Fuente** · RF-10–15, RN-05–08 y PP-11–20/PP-28. **Dependencias** · [02](02-inventario.md) y [04](04-reservas.md).

La persona registra llegada y salida escaneando el QR de su plaza. La app muestra el estado de la reserva y el historial de cumplimiento.

## 05A · Entrada y salida QR

**Base y dependencias** · 02A y 04A.

**Entrega** · App con cámara y solicitud de ubicación para la llegada. La API valida sesión, reserva, QR, plaza y ventana horaria, y en el check-in comprueba el perímetro de prueba. Usa el reloj del servidor. El check-in marca la plaza en uso y el check-out la libera. Configurar perímetro y tolerancias de demo con datos ficticios.

**Aceptación** · Un QR correcto permite entrada y salida en el emulador o dispositivo. Se rechazan QR ajenos, revocados o ilegibles y check-ins fuera de zona o ventana. Una lectura fallida permite reintentar. Repetir una operación confirmada no duplica eventos.

**Pendiente para piloto** · Confirmar perímetro y tolerancias propuestas de 15 minutos para llegada y 10 para salida.

## 05B · Vencimientos y ranking

**Base y dependencias** · 05A.

**Entrega** · Distinguir ausencia, vencimiento y salida registrada. Liberar capacidad lógica en el vencimiento y conservar bloqueos por incidentes verificados cuando exista 08A. Mostrar puntaje e historial con motivo y reserva. Exponer rectificaciones justificadas a través de una operación administrativa.

**Aceptación** · Una ausencia o un vencimiento genera el estado y ajuste correctos una sola vez. Una salida a tiempo queda diferenciada. Un error de lectura no sanciona y el mal uso requiere validación administrativa.

**Pendiente para piloto** · Confirmar la tabla de ajustes y niveles RN-06 y RN-07.
