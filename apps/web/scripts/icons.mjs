// Genera todos los íconos de la app a partir de brand/icono.png (el mate, sobre fondo negro).
// Correr después de cambiar el ícono: npm run icons --workspace web
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const pub = (name) => fileURLToPath(new URL(`../public/${name}`, import.meta.url));
const SRC = fileURLToPath(new URL("../brand/icono.png", import.meta.url));
const BG = { r: 0, g: 0, b: 0, alpha: 1 };

// Dónde está el dibujo dentro de la imagen (todo lo que no es casi negro)
const { data, info } = await sharp(SRC).removeAlpha().raw().toBuffer({ resolveWithObject: true });
let x0 = info.width, y0 = info.height, x1 = 0, y1 = 0;
for (let y = 0; y < info.height; y++) {
  for (let x = 0; x < info.width; x++) {
    const i = (y * info.width + x) * 3;
    if (data[i] + data[i + 1] + data[i + 2] > 90) {
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
    }
  }
}
const box = { left: x0, top: y0, width: x1 - x0 + 1, height: y1 - y0 + 1 };
const art = await sharp(SRC).extract(box).png().toBuffer();

/** El dibujo centrado en un cuadrado negro de `size`, ocupando `fill` del lado (0 a 1). */
async function icon(size, fill) {
  const scale = (size * fill) / Math.max(box.width, box.height);
  const w = Math.round(box.width * scale);
  const h = Math.round(box.height * scale);
  return sharp({ create: { width: size, height: size, channels: 4, background: BG } })
    .composite([{ input: await sharp(art).resize(w, h).png().toBuffer(), left: Math.round((size - w) / 2), top: Math.round((size - h) / 2) }])
    .png();
}

// "maskable": Android lo recorta en círculo, así que todo el dibujo tiene que entrar en el 80 % del centro.
// Se calcula con la diagonal del dibujo para que ni la punta de la bombilla quede afuera.
const maskableFill = (0.8 * Math.max(box.width, box.height)) / Math.hypot(box.width, box.height);

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
// Android usa solo la forma; la raya y la boca del mate quedan caladas porque en el original son negras.
{
  const { data: px, info: i } = await sharp(art).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const rgba = Buffer.alloc(i.width * i.height * 4);
  for (let p = 0; p < i.width * i.height; p++) {
    const lum = px[p * 3] + px[p * 3 + 1] + px[p * 3 + 2];
    rgba[p * 4] = rgba[p * 4 + 1] = rgba[p * 4 + 2] = 255;
    rgba[p * 4 + 3] = Math.max(0, Math.min(255, (lum - 60) * 2));
  }
  const side = Math.round(Math.max(i.width, i.height) * 1.08);
  // En dos pasos: sharp siempre achica antes de agregar margen, aunque se escriba al revés
  const square = await sharp(rgba, { raw: { width: i.width, height: i.height, channels: 4 } })
    .extend({
      top: Math.floor((side - i.height) / 2), bottom: Math.ceil((side - i.height) / 2),
      left: Math.floor((side - i.width) / 2), right: Math.ceil((side - i.width) / 2),
      background: { r: 255, g: 255, b: 255, alpha: 0 },
    })
    .png()
    .toBuffer();
  await sharp(square).resize(96, 96).png().toFile(pub("badge-96.png"));
  console.log("✓ badge-96.png");
}
