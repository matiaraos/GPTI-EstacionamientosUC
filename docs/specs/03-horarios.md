# 03 · Horarios y destino

**Fuente** · RF-04–05, PP-04–05 y certificado de aceptación. **Dependencia** · [01](01-cuentas.md).

El usuario puede guardar su horario semanal e indicar cuánto tiempo estará en el campus. Si ese día no tiene clases, declara una sala o un edificio de destino.

## 03A · Destino y permanencia

**Base y dependencias** · 01A. Durante el trabajo en paralelo con 02A, usar destinos de prueba con ID, nombre y tipo.

**Entrega** · Formulario móvil con fecha, llegada, salida y un destino del catálogo para preparar la solicitud que usará 04A. Buscar por código o nombre y enviar el ID del registro seleccionado. La app y la API deben manejar la zona horaria de Santiago de forma consistente.

**Aceptación** · Un destino válido y una salida posterior a la llegada permiten preparar la solicitud. Si falta destino, el ID no existe o el intervalo es inválido, mostrar el error y conservar los datos ingresados.

## 03B · Horario semanal e importación

**Base y dependencias** · 02A, 03A y 04A.

**Entrega** · App y API para guardar y editar bloques semanales con día, inicio, término y sala o edificio identificado en el catálogo. La importación `.ics` muestra una vista previa y los bloques que requieren corrección. Si una ubicación importada tiene varias coincidencias o carece de ellas, pedir que el usuario elija el destino antes de guardar el bloque. La edición de horario no sustituye una reserva confirmada. El cambio de reserva se completa en 04B.

**Aceptación** · Los bloques persisten al reabrir la app. Bloques inválidos y archivos ilegibles se informan sin perder el horario anterior. Importar un archivo de prueba permite revisar los bloques antes de guardar. Editar una visita conserva la reserva confirmada hasta que se acepte una alternativa.

**Pendiente para piloto** · Validar un `.ics` representativo y el mapeo de sus ubicaciones. Una integración directa con sistemas UC requiere autorización.
