# Ampliaciones del modelo para el MVP

Las entidades de este documento se agregan al [modelo de la demo](01-demo.md) cuando las requiere el tramo correspondiente. Las tablas compartidas aparecen con los atributos que cambian o son necesarios para leer las relaciones. [Specs del MVP](../specs/README.md)

## Horarios, acceso preferente y asignación

```mermaid
erDiagram
    CUENTA ||..o{ RECUPERACION : solicita
    CUENTA ||..o{ BLOQUE_CLASE : guarda
    DESTINO ||..o{ BLOQUE_CLASE : ubica
    CUENTA ||..o| AUTORIZACION_PREFERENTE : recibe
    PLAZA ||..o{ BLOQUEO_PLAZA : restringe
    CUENTA ||..o{ SOLICITUD_ESPERA : solicita
    VEHICULO ||..o{ SOLICITUD_ESPERA : usa
    DESTINO ||..o{ SOLICITUD_ESPERA : destino
    SOLICITUD_ESPERA |o..o| RESERVA : se_convierte_en

    RECUPERACION {
        int id PK
        int cuenta_id FK
        text hash_token UK
        timestamptz vence_en
        timestamptz usado_en
    }
    BLOQUE_CLASE {
        int id PK
        int cuenta_id FK
        int destino_id FK
        int dia_semana
        time inicio_local
        time fin_local
    }
    AUTORIZACION_PREFERENTE {
        int cuenta_id PK, FK
        timestamptz vigente_hasta
        timestamptz revocada_en
    }
    BLOQUEO_PLAZA {
        int id PK
        int plaza_id FK
        timestamptz inicio
        timestamptz fin
        text motivo
    }
    SOLICITUD_ESPERA {
        int id PK
        int cuenta_id FK
        int vehiculo_id FK
        int destino_id FK
        timestamptz inicio
        timestamptz fin
        timestamptz aceptada_en
        text estado
    }
    RESERVA {
        int id PK
        int solicitud_espera_id FK, UK
        text origen_destino
    }
```

- **Recuperación y horarios.** Consumir el token una sola vez y guardar su hash. La importación `.ics` produce bloques de clase tras la confirmación del usuario. La reserva conserva el destino e intervalo asignados aunque se edite un bloque. `origen_destino` distingue horario académico de destino declarado para medir el piloto.
- **Horario UC simulado.** `CursoUC` y `ActividadUC` guardan secciones de Buscacursos con su formato de módulos y la sala enlazada al catálogo cuando la coincidencia es única. `PerfilUC` son estudiantes de prueba y `ConexionUC` la inscripción simulada de una cuenta. Los bloques de clase registran su `origen` (`manual`, `ics` o `uc`) y la actividad UC de la que vienen, para sincronizar sin tocar los propios.
- **Accesibilidad.** La API verifica vigencia y revocación al asignar una plaza preferente. La autorización solo guarda estado administrativo y vigencia.
- **Asignación.** Excluir plazas inactivas y bloqueadas durante la ventana. Asignar una solicitud de espera una sola vez y registrar el vínculo con la reserva en la misma transacción. Usar cercanía por bloque para elegir la plaza, y ranking y antigüedad para ordenar solicitudes simultáneas compatibles. La ventana de simultaneidad sigue pendiente en 04B.

## Operación, ranking, avisos y recurrencia

```mermaid
erDiagram
    CUENTA ||..o{ AJUSTE_RANKING : recibe
    CUENTA |o..o{ AJUSTE_RANKING : rectifica
    RESERVA |o..o{ AJUSTE_RANKING : origina
    INCIDENTE |o..o{ AJUSTE_RANKING : justifica
    PLAZA ||..o{ INCIDENTE : afecta
    RESERVA |o..o{ INCIDENTE : asociada
    CUENTA |o..o{ INCIDENTE : resuelve
    INCIDENTE |o..o{ BLOQUEO_PLAZA : origina
    CUENTA ||..o{ CANAL_AVISO : registra
    CUENTA ||..o{ AVISO : recibe
    RESERVA |o..o{ AVISO : motiva
    CUENTA ||..o{ SERIE_RESERVA : solicita
    VEHICULO ||..o{ SERIE_RESERVA : usa
    ZONA ||..o{ SERIE_RESERVA : limita
    SERIE_RESERVA ||..|{ BLOQUE_SERIE : programa
    DESTINO ||..o{ BLOQUE_SERIE : destino
    BLOQUE_SERIE |o..o{ RESERVA : genera

    AJUSTE_RANKING {
        int id PK
        int cuenta_id FK
        int reserva_id FK
        int incidente_id FK
        int autor_rectificacion_id FK
        text clave_origen UK
        int variacion
        text motivo
        timestamptz registrado_en
    }
    INCIDENTE {
        int id PK
        int plaza_id FK
        int reserva_id FK
        int resuelto_por_cuenta_id FK
        text estado
        text descripcion
        timestamptz reportado_en
        text motivo_resolucion
        timestamptz resuelto_en
    }
    BLOQUEO_PLAZA {
        int id PK
        int incidente_id FK
    }
    CANAL_AVISO {
        int id PK
        int cuenta_id FK
        text token_push UK
        boolean activo
    }
    AVISO {
        int id PK
        int cuenta_id FK
        int reserva_id FK
        text tipo
        text estado
        text clave_deduplicacion UK
        timestamptz programado_en
    }
    SERIE_RESERVA {
        int id PK
        int cuenta_id FK
        int vehiculo_id FK
        int zona_id FK
        text estado
    }
    BLOQUE_SERIE {
        int id PK
        int serie_id FK
        int destino_id FK
        int dia_semana
        time inicio_local
        time fin_local
    }
    RESERVA {
        int id PK
        int bloque_serie_id FK
        date fecha_ocurrencia
    }
```

- **Ranking y ocupación.** Calcular el puntaje a partir del valor inicial y los ajustes registrados una vez por hecho. Conservar los motivos de rectificación y la justificación administrativa. Distinguir la ausencia y el vencimiento de una salida registrada. Un incidente pendiente no aplica una sanción y un bloqueo por incidente verificado se conserva hasta su resolución.
- **Avisos.** Registrar cada aviso junto con el resultado que lo origina. Reintentar con la misma clave y cancelar recordatorios pendientes al finalizar o cancelar la reserva. El correo alternativo usa el correo de la cuenta.
- **Recurrencia.** Cada ocurrencia es una reserva normal y comparte las restricciones de solapamiento. Hacer único el par `bloque_serie_id` y `fecha_ocurrencia` para las reservas generadas. Una fecha cancelada conserva su registro para impedir que un reintento la vuelva a crear. Comprobar el cupo del 30 % en la misma operación que crea o renueva la serie y serializar la decisión por zona para evitar que dos operaciones consuman el mismo cupo.
- **Piloto.** Derivar ocupación e indicadores a partir de reservas, eventos e incidentes, con resultados de encuestas, monitoreo y casos de prueba de asignación como insumos adicionales. Conservar al cierre resultados agregados por período con sus denominadores y distinguir simulaciones de mediciones reales. Eliminar los datos identificables según la spec 08B.
