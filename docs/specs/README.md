# Specs de MiEstacionamientoUC

La prioridad es una demo móvil con cuenta ficticia, destino y permanencia, reserva diaria y entrada y salida por QR. El [alcance técnico](../alcance.md) enlaza el DRS, el plan de pruebas y las solicitudes de cambio.

| Etapa | Tramo | Alcance | Requisitos | Depende de | Estado |
| --- | --- | --- | --- | --- | --- |
| Acceso y datos | [01A](01-cuentas.md#01a--acceso-y-base-visual) | Acceso y base visual | RF-01–02 | Base del repo | Pendiente |
| Acceso y datos | [02A](02-inventario.md#02a--catálogo-geográfico-y-plazas-de-prueba) | Catálogo de la demo | RF-18 | 01A | Pendiente |
| Acceso y datos | [03A](03-horarios.md#03a--destino-y-permanencia) | Destino y permanencia | RF-05 | 01A | Pendiente |
| Demo móvil | [04A](04-reservas.md#04a--reserva-diaria) | Reserva y cancelación | RF-06–08 | 01A, 02A, 03A | Pendiente |
| Demo móvil | [05A](05-uso-y-ranking.md#05a--entrada-y-salida-qr) | Entrada y salida QR | RF-10–12 | 02A, 04A | Pendiente |
| Flujos principales | [01B](01-cuentas.md#01b--recuperación-por-correo) | Recuperación | RF-03 | 01A | Pendiente |
| Flujos principales | [02B](02-inventario.md#02b--inventario-y-autorizaciones) | Inventario y autorizaciones | RF-18, RF-23 | 01A, 02A, 04A | Pendiente |
| Flujos principales | [03B](03-horarios.md#03b--horario-semanal-e-importación) | Horario e importación | RF-04–05 | 02A, 03A, 04A | Pendiente |
| Flujos principales | [05B](05-uso-y-ranking.md#05b--vencimientos-y-ranking) | Vencimientos y ranking | RF-13–15 | 05A | Pendiente |
| Flujos principales | [04B](04-reservas.md#04b--asignación-completa-y-espera) | Prioridad, cambios y espera | RF-06–09, RF-23, RNF-01 | 02B, 03B, 04A, 05B | Pendiente |
| Flujos principales | [08A](08-operacion.md#08a--ocupación-e-incidentes) | Ocupación e incidentes | RF-19–20 | 02B, 05A | Pendiente |
| Piloto | [06](06-avisos.md#06--avisos) | Avisos y recordatorios | RF-16–17 | 04B, 05B | Pendiente |
| Piloto | [07](07-recurrencia.md#07--reservas-recurrentes) | Recurrencia semanal | RF-22 | 06 | Pendiente |
| Piloto | [08B](08-operacion.md#08b--indicadores-y-cierre-del-piloto) | Indicadores y cierre | RF-21 y RNF del piloto | 01B, 07, 08A | Pendiente |

02A y 03A pueden avanzar en paralelo. Para desarrollar 03A, usar un catálogo de prueba con el contrato compartido en la spec 02. Integrar el catálogo geográfico de San Joaquín con plazas de prueba al cerrar 04A. La asignación ordena los bloques por su cercanía al destino. 01B, 02B, 03B y 05B se pueden tomar por separado al cumplir sus dependencias. La demo usa solo plazas regulares.

## Verificación

- Ejecutar los chequeos del repo y las pruebas específicas del tramo. Usar PostgreSQL real para verificar conflictos de reserva y reintentos y un emulador o dispositivo para verificar flujos móviles. Exportar bundles acredita la compilación. Para acreditar el flujo, ejecutarlo.
- Actualizar solo el tramo trabajado. Usar `En curso` mientras queden criterios pendientes y `Verificada` cuando exista evidencia de los criterios del tramo. Anotar aquí las pruebas, resultados y validaciones del piloto pendientes. Enlazar el commit o PR si existe. El certificado y el acta son fuentes de alcance académico.
