// Genera todos los íconos de la app a partir de brand/icono.svg (el mate en vectores, con fondo transparente).
// Correr después de cambiar el ícono: npm run icons --workspace web
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { DEFAULT_THEME, themes } from "@mortero/brand";
import sharp from "sharp";

const pub = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const SVG = readFileSync(fileURLToPath(new URL("../brand/icono.svg", import.meta.url)));
// Fondo de los íconos: el mismo de la app (tema por defecto), no negro puro
const BG = themes[DEFAULT_THEME].bg;

// El SVG ya está recortado al dibujo: su proporción es la del mate
const { width: vbW, height: vbH } = await sharp(SVG).metadata();

/** El mate dibujado desde el vector al tamaño justo (nítido en cualquier tamaño). */
function art(w, h) {
  // densidad suficiente para que el vector se rasterice directo al tamaño final, sin agrandar un bitmap
  const density = Math.max(72, Math.ceil((72 * Math.max(w / vbW, h / vbH)) * 1.01));
  return sharp(SVG, { density }).resize(w, h).png().toBuffer();
}

/** El dibujo centrado en un cuadrado de `size` con el fondo de la app, ocupando `fill` del lado (0 a 1). */
async function icon(size, fill) {
  const scale = (size * fill) / Math.max(vbW, vbH);
  const w = Math.round(vbW * scale);
  const h = Math.round(vbH * scale);
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: await art(w, h), left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .flatten({ background: BG })
    .png();
}

// "maskable": Android lo recorta en círculo, así que todo el dibujo tiene que entrar en el 80 % del centro.
// Se calcula con la diagonal del dibujo para que ni la punta de la bombilla quede afuera.
const maskableFill = (0.8 * Math.max(vbW, vbH)) / Math.hypot(vbW, vbH);

const out = [
  ["icon-192.png", 192, 0.8],
  ["icon-512.png", 512, 0.8],
  ["icon-maskable-512.png", 512, maskableFill],
  // iPhone redondea las esquinas solo y no deja transparencias
  ["apple-touch-icon.png", 180, 0.8],
  // Favicon de la pestaña: casi sin margen para que se vea en 32 px
  ["favicon-32.png", 32, 0.94],
  ["favicon-64.png", 64, 0.94],
];
for (const [name, size, fill] of out) {
  await (await icon(size, fill)).toFile(pub(name));
  console.log("✓", name);
}

// Ícono chico de las notificaciones (barra de estado de Android): solo la silueta, en blanco sobre transparente.
// Android usa solo la forma. La raya, la boca y el borde de la bombilla quedan calados porque en el SVG son huecos.
{
  const size = 96;
  const side = Math.round(Math.max(vbW, vbH) * 1.08);
  const w = Math.round((vbW / side) * size);
  const h = Math.round((vbH / side) * size);
  const { data, info } = await sharp(await art(w, h)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let p = 0; p < info.width * info.height; p++) data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = 255;
  const white = await sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 0 } } })
    .composite([{ input: white, left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png()
    .toFile(pub("badge-96.png"));
  console.log("✓ badge-96.png");
}
