import { execFile } from "node:child_process";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import path from "node:path";
import sharp from "sharp";
import { env } from "./env.js";

// Por ahora las fotos se guardan en disco. Más adelante: un driver para Cloudflare R2.
const dir = path.join(env.DATA_DIR, "uploads");
const thumbs = path.join(dir, "thumbs");
await mkdir(thumbs, { recursive: true });
const THUMB_PX = 480;

export const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;

/**
 * Normaliza la imagen: la rota según EXIF, la achica y la pasa a WebP.
 * Re-codificar con sharp descarta TODOS los metadatos (incluida la ubicación GPS de la foto).
 */
export async function saveImage(input: ArrayBuffer | Buffer): Promise<string> {
  const out = await sharp(Buffer.isBuffer(input) ? input : Buffer.from(input))
    .rotate()
    .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82 })
    .toBuffer();
  const key = `${crypto.randomUUID()}.webp`;
  await writeFile(path.join(dir, key), out);
  return key;
}

const KEY_RE = /^[0-9a-f-]{36}\.webp$/;
const VIDEO_RE = /^[0-9a-f-]{36}\.mp4$/;

export async function readImage(key: string, thumb = false): Promise<Buffer | null> {
  if (!KEY_RE.test(key)) return null;
  try {
    if (!thumb) return await readFile(path.join(dir, key));
    // La miniatura se genera la primera vez que se pide y queda guardada
    try {
      return await readFile(path.join(thumbs, key));
    } catch {
      const out = await sharp(await readFile(path.join(dir, key)))
        .resize({ width: THUMB_PX, height: THUMB_PX, fit: "cover", position: "attention" })
        .webp({ quality: 74 })
        .toBuffer();
      await writeFile(path.join(thumbs, key), out);
      return out;
    }
  } catch {
    return null;
  }
}

export async function deleteImage(key: string) {
  if (VIDEO_RE.test(key)) {
    await unlink(path.join(dir, key)).catch(() => {});
    return;
  }
  if (!KEY_RE.test(key)) return;
  await unlink(path.join(dir, key)).catch(() => {});
  await unlink(path.join(thumbs, key)).catch(() => {});
}

// ---------- Videos (solo para el álbum privado) ----------

const run = promisify(execFile);
const FFMPEG = process.env.FFMPEG_PATH ?? "ffmpeg";
export const MAX_VIDEO_BYTES = 80 * 1024 * 1024;
export const MAX_VIDEO_SECONDS = 60;

/** ¿Hay ffmpeg en el servidor? Sin ffmpeg no se aceptan videos. */
export const videoEnabled = await run(FFMPEG, ["-version"]).then(() => true, () => false);

/**
 * Normaliza el video: lo corta a 60 s, lo achica a 720 px del lado más largo y lo pasa a H.264 + AAC en MP4,
 * que se reproduce en cualquier celu (los .mov de iPhone en HEVC no andan en Android).
 * Re-codificar descarta los metadatos, incluida la ubicación GPS. También saca un fotograma para la miniatura.
 */
export async function saveVideo(input: ArrayBuffer): Promise<{ key: string; posterKey: string; seconds: number }> {
  const id = crypto.randomUUID();
  const tmpIn = path.join(tmpdir(), `${id}.in`);
  const key = `${id}.mp4`;
  const out = path.join(dir, key);
  const frame = path.join(tmpdir(), `${id}.png`);
  await writeFile(tmpIn, Buffer.from(input));
  try {
    const { stderr } = await run(FFMPEG, [
      "-hide_banner", "-y", "-i", tmpIn,
      "-t", String(MAX_VIDEO_SECONDS),
      "-map", "0:v:0", "-map", "0:a:0?", "-map_metadata", "-1",
      "-vf", "scale='if(gt(iw,ih),min(720,iw),-2)':'if(gt(iw,ih),-2,min(720,ih))'",
      "-c:v", "libx264", "-preset", "veryfast", "-crf", "26", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart",
      out,
    ], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
    const m = /Duration: (\d+):(\d+):(\d+)/.exec(stderr);
    const seconds = m ? Math.min(MAX_VIDEO_SECONDS, Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3])) : 0;
    await run(FFMPEG, ["-hide_banner", "-y", "-ss", "0.5", "-i", out, "-frames:v", "1", frame], { timeout: 30_000 })
      .catch(() => run(FFMPEG, ["-hide_banner", "-y", "-i", out, "-frames:v", "1", frame], { timeout: 30_000 }));
    const posterKey = await saveImage(await readFile(frame));
    return { key, posterKey, seconds };
  } catch (err) {
    await unlink(out).catch(() => {});
    throw err;
  } finally {
    await unlink(tmpIn).catch(() => {});
    await unlink(frame).catch(() => {});
  }
}

/** Ruta y tamaño de un video guardado, para servirlo por partes (Safari lo exige para reproducir). */
export async function videoFile(key: string): Promise<{ file: string; size: number } | null> {
  if (!VIDEO_RE.test(key)) return null;
  const file = path.join(dir, key);
  try {
    return { file, size: (await stat(file)).size };
  } catch {
    return null;
  }
}
