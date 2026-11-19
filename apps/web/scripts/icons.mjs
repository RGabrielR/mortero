// Genera los íconos PNG de la app a partir de public/icon.svg.
// Correr después de cambiar el ícono: npm run icons --workspace web
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const pub = new URL("../public/", import.meta.url);
const svg = await readFile(new URL("icon.svg", pub));
const out = [
  ["icon-192.png", 192, 0],
  ["icon-512.png", 512, 0],
  // Para "maskable" (Android recorta en círculo): el dibujo más chico, con margen
  ["icon-maskable-512.png", 512, 0.12],
  ["apple-touch-icon.png", 180, 0],
];
for (const [name, size, pad] of out) {
  const inner = Math.round(size * (1 - pad * 2));
  await sharp({ create: { width: size, height: size, channels: 4, background: "#0c0b0d" } })
    .composite([{ input: await sharp(svg).resize(inner, inner).png().toBuffer(), gravity: "center" }])
    .png()
    .toFile(fileURLToPath(new URL(name, pub)));
  console.log("✓", name);
}

// Ícono chico de las notificaciones: silueta blanca sobre fondo transparente (Android solo usa la forma;
// si el PNG tiene fondo, se ve un cuadrado blanco).
await sharp(await readFile(new URL("badge.svg", pub)), { density: 300 })
  .resize(96, 96)
  .png()
  .toFile(fileURLToPath(new URL("badge-96.png", pub)));
console.log("✓ badge-96.png");
