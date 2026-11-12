"""Extrae secciones de Buscacursos UC (campus San Joaquín) y arma perfiles de estudiantes de prueba.

Uso: python3 buscacursos.py [--semestre 2026-2]

Genera `cursos-uc.json` con las secciones de las siglas de `SIGLAS` y su horario en el formato de
Buscacursos (`L-W-V:4`, tipo de actividad y sala). No guarda nombres de docentes. Los perfiles combinan
secciones sin topes de horario para simular la inscripción de un estudiante (la conexión real con los
sistemas UC requiere autorización). Hace una consulta por sigla, con una pausa entre consultas.
"""

import argparse
import datetime
import html
import json
import re
import time
import urllib.parse
import urllib.request
from pathlib import Path

SIGLAS = [
    "MAT1610", "MAT1620", "MAT1630", "MAT1640", "MAT1203",
    "FIS1514", "FIS1523", "FIS1533", "QIM100E",
    "IIC1103", "IIC1253", "IIC2233", "IIC2343", "ICS1513", "ICE1514",
]

# Perfiles ficticios: año de la carrera y siglas que inscribe. Las secciones se eligen sin topes.
PERFILES = [
    {"codigo": "ing-1", "nombre": "Estudiante de prueba 1", "carrera": "Ingeniería · primer año", "siglas": ["MAT1610", "MAT1203", "IIC1103", "QIM100E"]},
    {"codigo": "ing-2", "nombre": "Estudiante de prueba 2", "carrera": "Ingeniería · segundo año", "siglas": ["MAT1620", "FIS1514", "IIC2233", "ICS1513"]},
    {"codigo": "ing-3", "nombre": "Estudiante de prueba 3", "carrera": "Ingeniería · tercer año", "siglas": ["MAT1630", "MAT1640", "FIS1533", "IIC2343"]},
]

DIAS = {"L": 1, "M": 2, "W": 3, "J": 4, "V": 5, "S": 6, "D": 7}


def limpiar(texto: str) -> str:
    return html.unescape(re.sub(r"<[^>]+>", " ", texto)).replace("\xa0", " ").strip()


def consultar(semestre: str, sigla: str) -> list[dict]:
    url = "https://buscacursos.uc.cl/?" + urllib.parse.urlencode(
        {"cxml_semestre": semestre, "cxml_sigla": sigla, "cxml_campus": "San Joaquín"}
    )
    pagina = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=30)
    s = pagina.read().decode("utf-8", "replace")
    secciones = []
    for fila in re.findall(r'<tr class="resultadosRow(?:Par|Impar)">(.*?)<td style="font-size:13px;text-align:center;"><a href="#top"', s, re.S):
        horario = re.findall(
            r'<td style="padding-right:5px;width:50px">\s*(.*?)\s*</td>\s*<td style="padding-right:5px">\s*(.*?)\s*</td>\s*<td>\s*(.*?)\s*</td>',
            fila,
            re.S,
        )
        celdas = [limpiar(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", re.sub(r"<table>.*?</table>", "", fila, flags=re.S), re.S)]
        if len(celdas) < 13 or celdas[11] != "San Joaquín":
            continue
        secciones.append({
            "nrc": celdas[0],
            "sigla": celdas[1].split()[-1],
            "seccion": int(celdas[4]),
            "nombre": celdas[9],
            "creditos": int(celdas[12] or 0),
            "horario": [{"modulos": m.strip(), "tipo": t.strip(), "sala": None if sala.strip() == "SIN SALA" else sala.strip()} for m, t, sala in horario],
        })
    return secciones


def bloques(seccion: dict) -> set[tuple[int, int]]:
    """Pares (día, módulo) que ocupa la sección."""
    ocupados = set()
    for actividad in seccion["horario"]:
        dias, modulos = actividad["modulos"].split(":")
        for d in dias.split("-"):
            for m in modulos.split(","):
                ocupados.add((DIAS[d], int(m)))
    return ocupados


def armar_perfil(perfil: dict, secciones: list[dict]) -> list[str]:
    """Primera combinación de secciones sin topes, probando las siglas en orden."""
    elegidas: list[dict] = []

    def buscar(i: int) -> bool:
        if i == len(perfil["siglas"]):
            return True
        for seccion in (s for s in secciones if s["sigla"] == perfil["siglas"][i]):
            ocupado = set().union(*(bloques(e) for e in elegidas)) if elegidas else set()
            if not bloques(seccion) & ocupado:
                elegidas.append(seccion)
                if buscar(i + 1):
                    return True
                elegidas.pop()
        return False

    if not buscar(0):
        raise SystemExit(f"No hay combinación sin topes para {perfil['codigo']}.")
    return [s["nrc"] for s in elegidas]


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--semestre", default="2026-2")
    args = parser.parse_args()
    secciones = []
    for sigla in SIGLAS:
        secciones += consultar(args.semestre, sigla)
        time.sleep(1.5)
    secciones.sort(key=lambda s: (s["sigla"], s["seccion"]))
    datos = {
        "fuente": "https://buscacursos.uc.cl/",
        "semestre": args.semestre,
        "campus": "San Joaquín",
        "consultado": datetime.date.today().isoformat(),
        "modulos": [
            {"modulo": 1, "inicio": "08:20", "fin": "09:30"},
            {"modulo": 2, "inicio": "09:40", "fin": "10:50"},
            {"modulo": 3, "inicio": "11:00", "fin": "12:10"},
            {"modulo": 4, "inicio": "12:20", "fin": "13:30"},
            {"modulo": 5, "inicio": "14:50", "fin": "16:00"},
            {"modulo": 6, "inicio": "16:10", "fin": "17:20"},
            {"modulo": 7, "inicio": "17:30", "fin": "18:40"},
            {"modulo": 8, "inicio": "18:50", "fin": "20:00"},
            {"modulo": 9, "inicio": "20:10", "fin": "21:20"},
        ],
        "perfiles": [{k: v for k, v in p.items() if k != "siglas"} | {"nrcs": armar_perfil(p, secciones)} for p in PERFILES],
        "secciones": secciones,
    }
    destino = Path(__file__).with_name("cursos-uc.json")
    destino.write_text(json.dumps(datos, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(f"{len(secciones)} secciones y {len(datos['perfiles'])} perfiles en {destino.name}")


if __name__ == "__main__":
    main()
