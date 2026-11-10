# 04 · Reservas diarias

**Fuente** · RF-06–09, RN-02–04 y RN-10, PP-06–10 y PP-25. **Dependencias** · [01](01-cuentas.md), [02](02-inventario.md) y [03](03-horarios.md).

Desde la app, un usuario puede solicitar una plaza, ver su confirmación, cancelarla antes del check-in o entrar en lista de espera cuando se agotan los cupos.

## 04A · Reserva diaria

**Base y dependencias** · 01A, 02A y 03A.

**Entrega** · La app solicita y muestra la reserva o la falta de cupo. La API elige una plaza regular habilitada y libre durante todo el intervalo de prueba, usando el orden de cercanía del catálogo ficticio. Confirmar de forma transaccional y permitir cancelación antes del check-in. La salida queda excluida del intervalo.

**Aceptación** · Una solicitud válida muestra plaza, horario y confirmación. Sin cupo, se informa sin crear una reserva. Cancelar libera el intervalo. Con PostgreSQL real, comprobar que solicitudes concurrentes no solapan plaza, cuenta ni patente, que se admiten intervalos contiguos y que el reintento de una solicitud confirmada devuelve la misma reserva.

## 04B · Asignación completa y espera

**Base y dependencias** · 02B, 03B, 04A y 05B.

**Entrega** · Usar cercanía a la primera clase, la última como desempate y el destino declarado si no hay clases. Ordenar solicitudes simultáneas por ranking descendente y antigüedad. Las cuentas con autorización vigente pueden optar por plazas preferentes y regulares. Permitir cambios sin perder la reserva original si falla la alternativa. Ofrecer espera con consentimiento o una zona habilitada disponible y procesar la espera al liberar capacidad compatible.

**Aceptación** · Se respeta cercanía, ranking, antigüedad y vigencia de la autorización. Una alternativa fallida conserva la reserva anterior. Una liberación atiende al siguiente candidato compatible. PP-25 comprueba el máximo de cinco segundos con 50 usuarios concurrentes.

**Pendiente de producto** · Confirmar la fuente de distancias del piloto y la ventana que define solicitudes simultáneas antes de verificar la prioridad de 04B.
