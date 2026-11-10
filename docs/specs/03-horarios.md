# 03 · Horarios y destino

**Fuente** · RF-04–05, PP-04–05 y certificado de aceptación. **Dependencia** · [01](01-cuentas.md).

El usuario puede guardar su horario semanal e indicar cuánto tiempo estará en el campus. Si ese día no tiene clases, declara un edificio de destino.

## Implementación

- Desde la app y la API, crear, editar y consultar bloques semanales con día, inicio, término y ubicación. Registrar el intervalo de permanencia para la fecha solicitada y usar la zona horaria de Santiago.
- Añadir importación de archivos `.ics` con vista previa de los bloques válidos y reporte de los que requieran corrección. El ingreso manual debe funcionar por sí solo.
- Al incorporar reservas, conservar las confirmadas hasta que el usuario acepte una alternativa cuando una edición afecte su asignación.

## Aceptación

- Los bloques válidos persisten al reabrir la app. Se rechazan bloques sin ubicación o con término anterior o igual al inicio.
- Sin clases, se requiere un destino para solicitar la asignación. Se rechaza una permanencia cuyo término no sea posterior al inicio.
- Un archivo de ejemplo permite revisar los bloques importados antes de guardarlos. Los errores de lectura se informan y conservan el horario anterior.

## Decisión abierta

Validar un archivo `.ics` representativo y cómo asociar sus ubicaciones al catálogo antes de cerrar la importación. Una integración directa con sistemas UC requiere autorización.
