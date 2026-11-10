# 04 · Reservas diarias

**Fuente** · RF-06–09, RN-02–04 y RN-10, PP-06–10 y PP-25. **Dependencias** · [01](01-cuentas.md), [02](02-inventario.md) y [03](03-horarios.md).

Desde la app, un usuario puede solicitar una plaza, ver su confirmación, cancelarla antes del check-in o entrar en lista de espera cuando se agotan los cupos.

## Regla de cercanía por bloque

La API evalúa los bloques con alguna plaza habilitada, elegible y libre durante todo el intervalo. Para el destino solicitado, ordena primero los bloques con distancia por red peatonal y luego los que solo tienen una estimación en línea recta. Dentro de cada método, usa los metros de menor a mayor. Si dos bloques empatan, aplica el desempate del tramo y luego el ID de bloque. Dentro del bloque elegido, asigna una plaza compatible con un orden estable por ID. Si un bloque se llena antes de confirmar, vuelve a buscar entre los bloques elegibles.

La ubicación y la distancia provienen del [catálogo de San Joaquín](../campus-san-joaquin/README.md). Una plaza hereda la cercanía de su bloque. Si falta la distancia de un par destino–bloque, se omite ese bloque del orden geográfico. Si hay bloques elegibles pero ninguno tiene distancia, se informa que falta información de cercanía para ese destino.

## 04A · Reserva diaria

**Base y dependencias** · 01A, 02A y 03A.

**Entrega** · Usar el destino declarado y los bloques habilitados para la demo. La app muestra el bloque, la plaza, el horario y la distancia estimada con su método, o informa la falta de cupo. Confirmar de forma transaccional y permitir cancelación antes del check-in. La salida queda excluida del intervalo.

**Aceptación** · Si el primer bloque está lleno y el segundo tiene una plaza elegible, se confirma en el segundo. Un bloque con ruta peatonal tiene prioridad sobre otro cuya única distancia sea en línea recta. Si solo hay bloques compatibles con distancia en línea recta, se elige el más cercano según esa estimación y se etiqueta el método. Si hay cupo pero faltan todas las distancias para el destino, se informa el problema de catálogo. Sin cupo, se informa sin crear una reserva. Cancelar libera el intervalo. Con PostgreSQL real, comprobar que solicitudes concurrentes no solapan plaza, cuenta ni patente, que se admiten intervalos contiguos y que el reintento de una solicitud confirmada devuelve la misma reserva.

## 04B · Asignación completa y espera

**Base y dependencias** · 02B, 03B, 04A y 05B.

**Entrega** · Usar el destino de la primera clase de la visita y la última clase para desempatar bloques con igual método y distancia. Aplicar a ese desempate el mismo orden de métodos y metros, dejando al final los bloques sin distancia a la última clase. Usar el destino declarado cuando no hay clases. Resolver el orden entre solicitudes simultáneas por ranking descendente y luego antigüedad. Las cuentas con autorización vigente pueden optar por plazas preferentes y regulares. Permitir cambios sin perder la reserva original si falla la alternativa. Ofrecer espera con consentimiento o una zona habilitada disponible y procesar la espera al liberar capacidad compatible.

**Aceptación** · Con dos bloques empatados para la primera clase, gana el más cercano a la última según la regla de métodos. Si dos solicitudes simultáneas compiten por el mismo cupo, se procesa primero la de mayor ranking, o la más antigua si empatan. Una autorización vencida excluye plazas preferentes. Una alternativa fallida conserva la reserva anterior y una liberación atiende al siguiente candidato compatible. PP-25 comprueba el máximo de cinco segundos con 50 usuarios concurrentes.

**Pendiente de producto** · Confirmar las conexiones peatonales inferidas para el piloto y la ventana que define solicitudes simultáneas.
