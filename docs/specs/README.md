# Specs de MiEstacionamientoUC

La app móvil es el producto principal. Cada spec agrupa un resultado que se puede verificar y describe los cambios que lo respaldan en la API, el panel y la base de datos cuando corresponde. El [alcance técnico](../alcance.md) enlaza el DRS, el plan de pruebas y los cambios de alcance.

| Orden | Spec | Requisitos | Depende de | Estado |
| --- | --- | --- | --- | --- |
| 01 | [Cuentas y acceso](01-cuentas.md) | RF-01–03 | Base del repo | Pendiente |
| 02 | [Inventario y accesibilidad](02-inventario.md) | RF-18, RF-23 | 01 | Pendiente |
| 03 | [Horarios y destino](03-horarios.md) | RF-04–05 | 01 | Pendiente |
| 04 | [Reservas diarias](04-reservas.md) | RF-06–09 | 01–03 | Pendiente |
| 05 | [Entrada, salida y ranking](05-uso-y-ranking.md) | RF-10–15 | 02, 04 | Pendiente |
| 06 | [Avisos](06-avisos.md) | RF-16–17 | 03–05 | Pendiente |
| 07 | [Reservas recurrentes](07-recurrencia.md) | RF-22 | 04–06 | Pendiente |
| 08 | [Operación y piloto](08-operacion.md) | RF-19–21 y RNF del piloto | 02, 04–07 | Pendiente |

Las specs 02 y 03 pueden avanzar en paralelo. La primera demostración completa en la app termina en la 05, cuando una persona puede iniciar sesión, declarar su visita, reservar una plaza y registrar llegada y salida. La operación básica de ocupación e incidentes puede empezar tras la 05. La 08 agrega la evaluación del piloto cuando los flujos previos estén disponibles.

## Cómo usar una spec

1. Revisar las dependencias y contrastar los criterios con el DRS y el plan de pruebas. Confirmar las decisiones abiertas que afecten el alcance de esa iteración.
2. Implementar el flujo en las capas necesarias y comprobar cada escenario de aceptación. La API es la autoridad para permisos, estados de reserva y asignación. Usar datos ficticios en desarrollo y pruebas.
3. Actualizar el estado a `En curso` o `Verificada`. Para marcarla como verificada, enlazar el PR o commit y anotar las pruebas ejecutadas y las validaciones de piloto pendientes. El acta de cierre describe el alcance académico y el estado de este índice se basa en evidencia del repositorio.

Para empezar, pedir «Implementa la spec 01 de `docs/specs`. Revisa sus decisiones abiertas y valida sus criterios de aceptación».
