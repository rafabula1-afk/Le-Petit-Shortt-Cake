#!/usr/bin/env python3
"""Exporta los recursos de los PDFs para usarlos en la web de Le Petit Shortt Cake.

Genera:
  assets/fondo-le-petit.png      -> fondo de la página 1 de la identidad gráfica
  assets/catalogo/producto-*.png -> fotos del catálogo (con transparencia cuando aplica)

Requiere: poppler-utils (pdftoppm, pdfimages) y Pillow.
Uso: python3 scripts/extraer_assets.py
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "assets"
TMP = Path("/tmp/opencode/lepetit/extraccion")


def encontrar_pdf(nombre: str) -> Path:
    """Los PDF pueden estar en la raíz o dentro de assets/."""
    for candidato in (ASSETS / nombre, ROOT / nombre):
        if candidato.exists():
            return candidato
    raise FileNotFoundError(f"No se encontró {nombre} en assets/ ni en la raíz del proyecto")


IDENTIDAD = encontrar_pdf("identidad grafica le petit shortt cake 2027.pdf")
CATALOGO = encontrar_pdf("Catalogo le petit shortt cake 2026.pdf")


def ejecutar(comando: list[str]) -> None:
    subprocess.run(comando, check=True)


def exportar_fondo() -> None:
    ASSETS.mkdir(exist_ok=True)
    ejecutar([
        "pdftoppm", "-f", "1", "-l", "1", "-r", "150", "-png",
        str(IDENTIDAD), str(TMP / "fondo"),
    ])
    pagina = sorted(TMP.glob("fondo-*.png"))[0]
    destino = ASSETS / "fondo-le-petit.png"
    shutil.copy(pagina, destino)
    print(f"Fondo exportado: {destino}")


def exportar_catalogo() -> None:
    destino = ASSETS / "catalogo"
    destino.mkdir(parents=True, exist_ok=True)
    temporal = TMP / "img"
    temporal.mkdir(parents=True, exist_ok=True)
    ejecutar(["pdfimages", "-png", str(CATALOGO), str(temporal / "img")])

    archivos = sorted(temporal.glob("img-*.png"))
    indice = 0
    contador = 0
    while indice < len(archivos):
        imagen = Image.open(archivos[indice]).convert("RGBA")
        indice += 1

        # Los PDF de Canva guardan la transparencia como una imagen gris (smask)
        # inmediatamente después de la imagen RGB. La combinamos como canal alpha.
        if indice < len(archivos):
            candidata = Image.open(archivos[indice])
            if candidata.mode == "L" and candidata.size == imagen.size:
                imagen.putalpha(candidata)
                indice += 1

        contador += 1
        imagen.save(destino / f"producto-{contador:03d}.png")

    print(f"Imágenes del catálogo: {contador} -> {destino}")


def main() -> None:
    shutil.rmtree(TMP, ignore_errors=True)
    TMP.mkdir(parents=True, exist_ok=True)
    exportar_fondo()
    exportar_catalogo()


if __name__ == "__main__":
    main()
