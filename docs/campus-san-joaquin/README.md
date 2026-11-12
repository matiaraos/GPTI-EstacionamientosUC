# Estacionamientos y salas de San Joaquín

Descarga [mapa.html](mapa.html) y ábrelo en un navegador. El mapa funciona sin conexión y permite buscar una sala por código, nombre o identificador. Al elegirla, muestra hasta tres bloques cercanos por la red peatonal y dibuja la primera ruta. Si un bloque queda fuera de la red conectable, aparece en una lista aparte de estimaciones en línea recta.

| Archivo | Contenido |
| --- | --- |
| [catalogo.geojson](catalogo.geojson) | Perímetro, edificios, 404 registros de salas, 10 bloques y 10 accesos vehiculares de San Joaquín. Los identificadores se conservan desde Ubícate UC. |
| [distancias.csv](distancias.csv) | Las 4.040 combinaciones sala–bloque, con distancia en metros, método, tipo de conexión en cada extremo y orden dentro del método. |
| [distancias-edificios.csv](distancias-edificios.csv) | Las 250 combinaciones edificio–bloque, calculadas con la misma red y reglas desde la ubicación publicada de cada edificio. La columna `conexion_edificio` reemplaza a `conexion_sala`. |
| [cursos-uc.json](cursos-uc.json) | 121 secciones de 2026-2 dictadas en San Joaquín (Buscacursos): NRC, sigla, sección, nombre, créditos y horario con el formato `L-W-V:4`, tipo de actividad (CLAS, AYU, LAB, TAL) y sala. Incluye los 9 módulos UC y 3 estudiantes de prueba con inscripciones sin topes. No guarda nombres de docentes. |
| [red-peatonal-osm.json](red-peatonal-osm.json) | Extracto separado de nodos, vías y entradas de OpenStreetMap, disponible bajo ODbL. |

## Cómo leer las distancias

- **A pie.** La distancia combina la ruta más corta por los senderos y los tramos estimados que conectan sus extremos a la red. Se excluyen vías marcadas como privadas o cerradas al tránsito peatonal. Se admite un enlace de hasta 45 m desde cada extremo.
- **Entrada cartografiada.** Se encontró un punto de entrada etiquetado por OpenStreetMap cerca del contorno correspondiente. **Conexión inferida** significa que se usó un borde del bloque o el punto publicado para el bloque o sala. Los trayectos interiores y las salidas peatonales de subterráneos requieren confirmación en terreno. El mapa incluye caminos con escaleras.
- **Línea recta.** Distancia entre los puntos representativos de la sala y el bloque cuando la red disponible no conecta el par. Se ordena por separado. Hay 393 salas con rutas por la red disponible y 11 con estimaciones en línea recta.
- **Acceso.** CyT es exclusivo de la comunidad UC. Los otros sectores muestran que sus condiciones de acceso requieren confirmación. Las distancias no representan cupos disponibles. [Infraestructura UC](https://infraestructura.uc.cl/estacionamientos)

Como referencia, el catálogo ordena primero Centro de Innovación para ED113 (240 m), Estacionamiento 3 para AE213 (193 m) y Estacionamiento 1 para F203 (288 m). Esas rutas usan una conexión inferida en el bloque. Ubícate contiene registros de ED113 con identificadores diferentes y ambos se conservan.

## Horario UC de prueba

Buscacursos muestra cada actividad como `DÍAS:MÓDULOS`, con los días `L M W J V S` separados por `-` y los módulos por `,`: `L-W-V:4` es lunes, miércoles y viernes en el módulo 4, y `M:5,6` es martes en los módulos 5 y 6 seguidos. Los nueve módulos duran 70 minutos: 1 08:20, 2 09:40, 3 11:00, 4 12:20, 5 14:50, 6 16:10, 7 17:30, 8 18:50 y 9 20:10 (almuerzo entre el 4 y el 5). La API une los módulos consecutivos en un solo bloque.

Las salas de Buscacursos se cruzan con el catálogo por nombre o por ID con sufijo `-SJ` (`AE002` → `AE002-SJ`). Más del 90 % de las actividades con sala tienen una coincidencia única. Las demás (por ejemplo `CS-101`, `M2` con dos registros o «SIN SALA») piden elegir el destino al sincronizar.

La app usa estos datos para simular la conexión con el horario UC, que en el piloto requiere autorización institucional: la persona elige un estudiante de prueba, revisa sus bloques, puede cambiarse de sección como en la modificación de horario y sincroniza.

## Fuentes y regeneración

- **Ubícate UC / Open Source UC.** Se usó el commit `44792716e727a0067eb90fd4ae06bc3ed2cca0fd`, campus `SJ`. Los bloques provienen de `PARKING-0` a `PARKING-9`. `PARKING-10` a `PARKING-19` son accesos vehiculares. Se conservan los polígonos y puntos publicados. [GeoJSON original](https://github.com/open-source-uc/UbiCate-v2/blob/44792716e727a0067eb90fd4ae06bc3ed2cca0fd/data/places.json)
- **© colaboradores de OpenStreetMap.** Extracto consultado el 10 de noviembre de 2026, bbox `-70.6166,-33.5020,-70.6054,-33.4953`. El JSON conserva el bbox y la fecha de la edición más reciente presente en el extracto. [Atribución de OpenStreetMap](https://www.openstreetmap.org/copyright) · [Licencia ODbL](https://opendatacommons.org/licenses/odbl/1-0/)

- **Buscacursos UC.** Consulta del semestre 2026-2, campus San Joaquín, el 12 de noviembre de 2026, con las siglas listadas en `buscacursos.py`. [Buscacursos](https://buscacursos.uc.cl/)

Para actualizar los cursos, ejecuta `python3 buscacursos.py --semestre 2026-2` desde esta carpeta: hace una consulta por sigla, con una pausa entre ellas, y vuelve a armar los estudiantes de prueba sin topes. Desde esta carpeta, ejecuta `python3 generar.py` para regenerar los CSV y el HTML con las fuentes normalizadas del repo. Para actualizar los datos de origen, descarga el GeoJSON de Ubícate y el XML del área de OpenStreetMap y ejecuta `python3 generar.py --fuentes ubicate.json osm.xml`. Actualiza la versión y la fecha de las fuentes al cambiar el extracto.

La API carga estos archivos con `npm run catalogo:importar -w @miestacionamientouc/api`; `npm run db:seed` carga además `cursos-uc.json`. La carga se puede repetir: identifica cada registro por su ID de origen.
