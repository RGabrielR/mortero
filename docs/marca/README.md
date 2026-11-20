# Logo de qule.ar

El mate culo en vectores, listo para usar fuera de la app: redes, presentaciones, stickers.

| Archivo | Qué es | Tamaño del PNG |
|---|---|---|
| `qule-logo.svg` / `.png` | El mate solo, sobre negro. Sirve de foto de perfil: entra entero en el recorte circular. | 2048 × 2048 |
| `qule-logo-transparente.svg` / `.png` | El mate sin fondo, para montarlo sobre otra cosa | 2048 × 2048 |
| `qule-logo-marca.svg` / `.png` | El mate + "qule.ar" | 3200 × 1800 (16:9) |
| `qule-logo-marca-lema.svg` / `.png` | El mate + "qule.ar" + el lema, "Poné la pava." | 3200 × 1800 (16:9) |

Las versiones 16:9 son las que Twitter/X muestra enteras en el timeline.

## Cómo está hecho

- **El mate** es el dibujo original (`original/icono.png`) pasado a vectores con [potrace](https://potrace.sourceforge.net/): una forma para el cuenco (con el degradé) y otra para lo crema (el borde y la bombilla). Los colores del degradé se midieron sobre el original. La raya, la boca y la separación de la bombilla son huecos, así que funciona sobre cualquier fondo.
- **"qule.ar"** está en Bricolage Grotesque 800, la tipografía de la app, convertida a trazos: el SVG se ve igual aunque la fuente no esté instalada. "qule" va en crema y ".ar" con el degradé del mate.
- **El lema** está en Inter 500, en el gris de los textos secundarios.

El mismo mate, sin fondo y recortado al dibujo, es el original de los íconos de la app: [`apps/web/brand/icono.svg`](../../apps/web/brand/icono.svg). Si se cambia el logo, hay que cambiar los dos.
