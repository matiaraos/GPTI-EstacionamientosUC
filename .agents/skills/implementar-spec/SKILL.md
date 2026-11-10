---
name: implementar-spec
description: Implementa un tramo o una spec numerada de MiEstacionamientoUC en docs/specs y registra la evidencia de sus criterios de aceptación. Usar con pedidos como implementar 01A, 04A o una feature del MVP.
---

# Implementar una spec de MiEstacionamientoUC

1. Identifica el tramo en el [índice](../../../docs/specs/README.md). Lee su entrega, aceptación y dependencias. Si el pedido indica la spec completa, recorre sus tramos en orden de dependencias. Contrasta el código y las pruebas existentes. Consulta el [alcance técnico](../../../docs/alcance.md) si hay dudas sobre una regla del DRS.
2. Usa los datos ficticios y parámetros de prueba del tramo. Separa las decisiones técnicas de las confirmaciones del piloto. Si una decisión de producto bloquea un criterio, avanza con los criterios independientes y registra el bloqueo. En tareas de planificación, conserva el estado del tramo.
3. Sigue [AGENTS.md](../../../AGENTS.md) para elegir skills. En móvil, comienza por `expo-overview` y usa la documentación del SDK instalado. La primera pantalla establece colores, tipografía, espaciado y los componentes que necesita. Las siguientes reutilizan esa base y la amplían cuando corresponda. La API es la autoridad para permisos, disponibilidad y estados.
4. Verifica desde el punto de entrada real. Cubre el camino principal y los errores del tramo. Usa PostgreSQL real para conflictos de reserva y reintentos, y un emulador o dispositivo para flujos móviles. Registra por separado los chequeos de compilación y las pruebas del flujo.
5. Actualiza solo la fila del tramo trabajado. Usa `En curso` si quedan criterios por verificar y `Verificada` si existe evidencia para todos sus criterios. Anota pruebas, resultados, validaciones de piloto pendientes y el enlace al commit o PR cuando exista.
