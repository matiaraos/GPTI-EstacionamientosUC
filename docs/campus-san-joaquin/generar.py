"""Genera el catálogo y el mapa local de San Joaquín con Python estándar."""
import argparse
import csv
from collections import defaultdict
import heapq
import json
from math import hypot, inf
from pathlib import Path
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parent
BLOCKS = {f"PARKING-{i}" for i in range(10)}
GATES = {f"PARKING-{i}" for i in range(10, 20)}
WALKABLE = {"footway", "pedestrian", "path", "steps", "corridor", "living_street",
            "service", "residential"}
FORBIDDEN = {"no", "private"}
MAX_LINK = 45


def save_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(",", ":")) + "\n",
                    encoding="utf-8")


def tags(element):
    return {tag.get("k"): tag.get("v") for tag in element.findall("tag")}


def import_sources(ubicate, osm):
    features = []
    for item in json.loads(ubicate.read_text(encoding="utf-8"))["features"]:
        p = item["properties"]
        if p.get("campus") != "SJ":
            continue
        ident = p["identifier"]
        categories = set(p["categories"])
        if ident in BLOCKS:
            kind = "bloque"
        elif ident in GATES:
            kind = "acceso_vehicular"
        else:
            kind = next((key for category, key in [
                ("campus", "campus"), ("classroom", "sala"), ("building", "edificio")
            ] if category in categories), None)
        if kind is None:
            continue
        properties = {"id": ident, "nombre": p["name"].strip(), "tipo": kind}
        if kind == "sala":
            properties["pisos"] = p.get("floors", [])
        if kind == "bloque":
            properties["acceso"] = ("Exclusivo comunidad UC" if ident == "PARKING-9"
                                    else "Confirmar condiciones de acceso")
        features.append({"type": "Feature", "properties": properties,
                         "geometry": item["geometry"]})
    save_json(ROOT / "catalogo.geojson", {"type": "FeatureCollection", "features": features})

    tree = ET.parse(osm)
    nodes = {}
    entrances = []
    for node in tree.findall("node"):
        coord = [float(node.get("lon")), float(node.get("lat"))]
        nodes[node.get("id")] = coord
        attrs = tags(node)
        if (attrs.get("entrance") in {"yes", "main", "exit", "secondary"}
                and attrs.get("access") not in FORBIDDEN and attrs.get("foot") not in FORBIDDEN):
            entrances.append(coord)
    ways = []
    for way in tree.findall("way"):
        attrs = tags(way)
        if (attrs.get("highway") not in WALKABLE or attrs.get("foot") in FORBIDDEN
                or attrs.get("access") in FORBIDDEN or attrs.get("area") == "yes"):
            continue
        ids = [nd.get("ref") for nd in way.findall("nd")]
        if len(ids) >= 2 and all(key in nodes for key in ids):
            ways.append({"id": way.get("id"), "tipo": attrs["highway"], "nodos": ids})
    used = {key for way in ways for key in way["nodos"]}
    latest = max(el.get("timestamp", "") for el in tree.getroot())
    save_json(ROOT / "red-peatonal-osm.json", {
        "bbox": tree.find("bounds").attrib, "ultima_edicion_en_extracto": latest,
        "nodos": {key: nodes[key] for key in sorted(used)}, "vías": ways, "entradas": entrances,
    })


def xy(point):
    return (point[0] + 70.61) * 92800, (point[1] + 33.5) * 111200


def distance(a, b):
    u, v = xy(a), xy(b)
    return hypot(u[0] - v[0], u[1] - v[1])


def ring(feature):
    geometry = feature["geometry"]
    return geometry["coordinates"][0] if geometry["type"] == "Polygon" else []


def center(feature):
    if not ring(feature):
        return feature["geometry"]["coordinates"]
    points = ring(feature)[:-1]
    return [sum(axis) / len(axis) for axis in zip(*points)]


def on_boundary(point, outline):
    px, py = xy(point)
    best = (inf, None)
    for a, b in zip(outline, outline[1:]):
        ax, ay = xy(a)
        bx, by = xy(b)
        dx, dy = bx - ax, by - ay
        size = dx * dx + dy * dy
        ratio = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / size)) if size else 0
        length = hypot(px - ax - ratio * dx, py - ay - ratio * dy)
        if length < best[0]:
            best = length, [a[i] + ratio * (b[i] - a[i]) for i in range(2)]
    return best


def inside(point, outline):
    x, y = point
    hits = sum((a[1] > y) != (b[1] > y) and
               x < a[0] + (b[0] - a[0]) * (y - a[1]) / (b[1] - a[1])
               for a, b in zip(outline, outline[1:]))
    return hits % 2 == 1


def snap(point, nodes):
    key = min(nodes, key=lambda k: distance(point, nodes[k]))
    gap = distance(point, nodes[key])
    return (key if gap <= MAX_LINK else None, gap, point)


def anchor(feature, buildings, entrances, nodes):
    point = center(feature)
    outline = ring(feature)
    if feature["properties"]["tipo"] == "sala":
        building = next((item for item in buildings if inside(point, ring(item))), None)
        outline = ring(building) if building else []
    if outline:
        candidates = sorted((door for door in entrances if on_boundary(door, outline)[0] <= 6),
                            key=lambda door: distance(point, door))
        for door in candidates:
            connection = snap(door, nodes)
            if connection[0] is not None:
                return connection, "entrada_osm"
    if outline and feature["properties"]["tipo"] == "bloque":
        gap, key, edge = min((length, key, edge) for key, location in nodes.items()
                             for length, edge in [on_boundary(location, outline)])
        return (key if gap <= MAX_LINK else None, gap, edge), "inferida"
    return snap(point, nodes), "inferida"


def shortest(graph, start):
    lengths, parent = {start: 0}, {}
    queue = [(0, start)]
    while queue:
        cost, node = heapq.heappop(queue)
        if cost != lengths[node]:
            continue
        for other, meters in graph[node]:
            total = cost + meters
            if total < lengths.get(other, inf):
                lengths[other] = total
                parent[other] = node
                heapq.heappush(queue, (total, other))
    return lengths, parent


def generate():
    features = json.loads((ROOT / "catalogo.geojson").read_text(encoding="utf-8"))["features"]
    osm = json.loads((ROOT / "red-peatonal-osm.json").read_text(encoding="utf-8"))
    nodes = osm["nodos"]
    graph = defaultdict(list)
    for way in osm["vías"]:
        for a, b in zip(way["nodos"], way["nodos"][1:]):
            length = distance(nodes[a], nodes[b])
            graph[a].append((b, length))
            graph[b].append((a, length))
    groups = defaultdict(list)
    for item in features:
        groups[item["properties"]["tipo"]].append(item)
    buildings = [item for item in groups["edificio"] if ring(item)]
    options = {}
    for block in groups["bloque"]:
        connection, quality = anchor(block, buildings, osm["entradas"], nodes)
        key, _, _ = connection
        lengths, parent = shortest(graph, key) if key is not None else ({}, {})
        options[block["properties"]["id"]] = connection, quality, lengths, parent
    results = {}
    rows = []
    for room in groups["sala"]:
        ident = room["properties"]["id"]
        (end, room_gap, room_point), room_quality = anchor(room, buildings, osm["entradas"], nodes)
        ranked = []
        for block in groups["bloque"]:
            block_id = block["properties"]["id"]
            (start, block_gap, block_point), quality, lengths, parent = options[block_id]
            if end in lengths:
                path = [end]
                while path[-1] != start:
                    path.append(parent[path[-1]])
                route = [block_point] + [nodes[key] for key in reversed(path)] + [room_point]
                meters = block_gap + lengths[end] + room_gap
                method = "peatonal"
            else:
                route = []
                meters = distance(center(block), center(room))
                method = "linea_recta"
            ranked.append({"bloque": block_id, "metros": round(meters), "metodo": method,
                           "conexion_bloque": quality if route else "",
                           "conexion_sala": room_quality if route else "", "ruta": route})
        ranked.sort(key=lambda row: (row["metodo"] != "peatonal", row["metros"], row["bloque"]))
        count = defaultdict(int)
        for row in ranked:
            count[row["metodo"]] += 1
            row["orden"] = count[row["metodo"]]
            rows.append({"sala": ident, **{k: v for k, v in row.items() if k != "ruta"}})
        results[ident] = [row for row in ranked if row["orden"] <= 3]
    with (ROOT / "distancias.csv").open("w", newline="", encoding="utf-8") as output:
        writer = csv.DictWriter(output, fieldnames=list(rows[0]), lineterminator="\n")
        writer.writeheader()
        writer.writerows(rows)
    payload = {"lugares": features, "vias": [[nodes[k] for k in w["nodos"]] for w in osm["vías"]],
               "resultados": results}
    template = (ROOT / "plantilla.html").read_text(encoding="utf-8")
    data = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).replace("<", "\\u003c")
    (ROOT / "mapa.html").write_text(template.replace("<!-- DATOS_DEL_MAPA -->", data), encoding="utf-8")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fuentes", nargs=2, type=Path, metavar=("UBICATE_JSON", "OSM_XML"))
    args = parser.parse_args()
    if args.fuentes:
        import_sources(*args.fuentes)
    generate()
