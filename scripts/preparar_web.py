#!/usr/bin/env python3
"""Exporta las fotos principales del catálogo a assets/productos/ optimizadas para web.

Requiere: poppler-utils (pdfimages) y Pillow.
Uso: python3 scripts/preparar_web.py
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DESTINO = ROOT / "assets" / "productos"
TMP = Path("/tmp/opencode/lepetit/preparar_web")


def encontrar_catalogo() -> Path:
    """El PDF puede estar en la raíz o dentro de assets/."""
    nombre = "Catalogo le petit shortt cake 2026.pdf"
    for candidato in (ROOT / "assets" / nombre, ROOT / nombre):
        if candidato.exists():
            return candidato
    raise FileNotFoundError(f"No se encontró {nombre} en assets/ ni en la raíz del proyecto")


CATALOGO = encontrar_catalogo()

# (página, número de imagen RGB, nombre de salida, alto máximo)
SELECCION = [
    (1, 2, "hero", 1400),           # foto de portada
    (2, 1, "receta", 900),          # escena de la receta
    (3, 11, "nosotras", 900),       # emprendedora con casita
    (3, 3, "casita", 1000),         # casita de jengibre
    (4, 11, "munecos", 900),        # muñecos de jengibre (grupos)
    (4, 9, "minicasitas", 900),     # escena de minicasitas
    (5, 7, "pesebre", 900),         # pesebre
    (6, 0, "coronas", 1200),        # corona de Adviento
    (7, 2, "extras", 1000),         # manga de glaseado
    (7, 10, "extra-dulces", 700),   # bolsa de dulces
    (4, 10, "extra-mini-casita", 700),
    (4, 7, "extra-muneco", 700),
    (7, 21, "extra-arbolito", 800),
    (7, 25, "extra-reyes", 600),
    (7, 14, "extra-pesebre-2d", 800),
    (4, 5, "extra-gigante", 700),       # muñeco gigante (foto distinta a la del extra)
    (7, 18, "galeria-1", 800),      # local / mostrador
    (6, 9, "galeria-2", 800),       # equipo con osito y casita
    (3, 9, "galeria-3", 800),       # familia decorando
    (7, 0, "galeria-4", 800),       # niña con casita
]


def main() -> None:
    shutil.rmtree(TMP, ignore_errors=True)
    TMP.mkdir(parents=True, exist_ok=True)
    DESTINO.mkdir(parents=True, exist_ok=True)

    cache: dict[int, list[Path]] = {}
    for pagina in sorted({s[0] for s in SELECCION}):
        carpeta = TMP / f"p{pagina}"
        carpeta.mkdir(parents=True, exist_ok=True)
        subprocess.run(
            ["pdfimages", "-f", str(pagina), "-l", str(pagina), "-png",
             str(CATALOGO), str(carpeta / "img")],
            check=True,
        )
        cache[pagina] = sorted(carpeta.glob("img-*.png"))

    for pagina, indice, nombre, alto_max in SELECCION:
        archivos = cache[pagina]
        imagen = Image.open(archivos[indice]).convert("RGBA")

        # La máscara de transparencia (smask) va inmediatamente después del RGB.
        if indice + 1 < len(archivos):
            mascara = Image.open(archivos[indice + 1])
            if mascara.mode == "L" and mascara.size == imagen.size:
                imagen.putalpha(mascara)

        if imagen.height > alto_max:
            nuevo_alto = alto_max
            nuevo_ancho = round(imagen.width * alto_max / imagen.height)
            imagen = imagen.resize((nuevo_ancho, nuevo_alto), Image.LANCZOS)

        salida = DESTINO / f"{nombre}.webp"
        imagen.save(salida, "WEBP", quality=88, method=6)
        print(f"{salida.relative_to(ROOT)}  ({imagen.width}x{imagen.height})")


if __name__ == "__main__":
    main()
