# 02 · Inventario y accesibilidad

**Fuente** · RF-18, RF-23 y SC-002. **Dependencia** · [01](01-cuentas.md).

La Dirección de Campus puede configurar la oferta de plazas y administrar quién tiene acceso a las preferentes. Este inventario alimenta la asignación diaria.

## Implementación

- Desde el panel y la API, gestionar zonas, plazas, edificios de referencia, horarios, tipo de plaza, QR y bloqueos. Conservar historial al desactivar una plaza y advertir si el cambio afecta reservas vigentes cuando exista el flujo de reservas.
- Permitir que administración otorgue o revoque autorizaciones con fecha de vigencia. Guardar solo el estado administrativo y su vigencia. El algoritmo de la spec 04 consumirá estos datos.

## Aceptación

- Una cuenta común no puede editar inventario ni autorizaciones. Una plaza desactivada o bloqueada queda excluida de nuevas asignaciones.
- Una autorización revocada o vencida deja de habilitar plazas preferentes. Las autorizaciones vigentes permiten optar por plazas preferentes y regulares.
- El catálogo de prueba permite distinguir plaza regular, preferente, bloqueada e inactiva. La configuración no solicita certificados ni motivos médicos.

## Decisiones abiertas

Confirmar inventario, ubicación de plazas preferentes y horarios de operación con la Dirección de Campus antes del piloto. Para desarrollo, usar un catálogo ficticio.
