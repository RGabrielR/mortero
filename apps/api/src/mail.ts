import nodemailer from "nodemailer";
import { env } from "./env.js";
import { APP_NAME } from "./brand.js";

// Mails por SMTP: sirve cualquier proveedor (Resend, Brevo, Mailgun, un servidor propio…).
// Sin SMTP_URL no se manda nada; en desarrollo el mail se muestra en la consola para poder probar.
export const mailEnabled = Boolean(env.SMTP_URL);
const transport = env.SMTP_URL ? nodemailer.createTransport(env.SMTP_URL) : null;
const dev = process.env.NODE_ENV !== "production";

type Mail = { to: string; subject: string; text: string; html: string };

export async function sendMail(mail: Mail) {
  if (!transport) {
    if (dev) console.log(`\n✉️  Mail para ${mail.to}: ${mail.subject}\n${mail.text}\n`);
    else console.warn("Mail sin enviar: falta SMTP_URL");
    return;
  }
  try {
    await transport.sendMail({ from: env.MAIL_FROM, ...mail });
  } catch (err) {
    // Que un mail falle no tiene que romper el registro ni el login
    console.error("No se pudo mandar el mail:", err);
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => `&#${ch.charCodeAt(0)};`);

/** Plantilla simple: se ve bien en clientes claros y oscuros. */
function layout(title: string, paragraphs: string[], button?: { label: string; url: string }) {
  const p = paragraphs.map((t) => `<p style="margin:0 0 14px;font-size:15px;line-height:1.5;color:#2b2730">${t}</p>`).join("");
  const b = button
    ? `<p style="margin:22px 0"><a href="${esc(button.url)}" style="background:#ff6a3d;color:#1a0d08;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;display:inline-block">${esc(button.label)}</a></p>`
    : "";
  return `<!doctype html><html><body style="margin:0;padding:24px;background:#f4f1f6;font-family:Inter,system-ui,-apple-system,'Segoe UI',sans-serif">
<div style="max-width:480px;margin:0 auto;background:#fff;border-radius:16px;padding:28px">
<p style="margin:0 0 18px;font-size:24px;font-weight:800;letter-spacing:-0.03em;color:#ff6a3d">${esc(APP_NAME)}</p>
<h1 style="margin:0 0 14px;font-size:20px;color:#141216">${esc(title)}</h1>${p}${b}
<p style="margin:24px 0 0;font-size:12px;color:#8a8392">App comunitaria, gratuita y de código abierto.</p>
</div></body></html>`;
}

export function welcomeMail(to: string, name: string): Mail {
  const first = name.trim().split(/\s+/)[0] || "";
  const hi = first ? `¡Hola, ${first}!` : "¡Hola!";
  return {
    to,
    subject: `Bienvenide a ${APP_NAME}`,
    text: `${hi}\n\nYa tenés tu cuenta en ${APP_NAME}. Es una app comunitaria, gratuita y de código abierto: todo lo que en otras apps se paga, acá viene incluido.\n\nRecién arrancamos y somos pocas personas, así que te recomendamos pasar por el chat general y los grupos para conocer gente.\n\nEntrá: ${env.APP_URL}\n\nSi querés proponer ideas o sumarte a construirla: https://github.com/RGabrielR/mortero/discussions`,
    html: layout(hi, [
      `Ya tenés tu cuenta en ${esc(APP_NAME)}. Es una app comunitaria, gratuita y de código abierto: todo lo que en otras apps se paga, acá viene incluido.`,
      "Recién arrancamos y somos pocas personas, así que te recomendamos pasar por el <b>chat general</b> y los <b>grupos</b> para conocer gente.",
      `¿Tenés ideas? Sumate a <a href="https://github.com/RGabrielR/mortero/discussions" style="color:#e2532a">construirla entre todes</a>.`,
    ], { label: `Entrar a ${APP_NAME}`, url: env.APP_URL }),
  };
}

export function resetMail(to: string, url: string): Mail {
  return {
    to,
    subject: "Cambiá tu contraseña",
    text: `Pediste cambiar tu contraseña de ${APP_NAME}. Entrá a este link para elegir una nueva (vence en 1 hora):\n\n${url}\n\nSi no fuiste vos, ignorá este mail: tu contraseña sigue igual.`,
    html: layout("Cambiá tu contraseña", [
      "Pediste cambiar tu contraseña. Tocá el botón para elegir una nueva. El link vence en 1 hora.",
      "Si no fuiste vos, ignorá este mail: tu contraseña sigue igual.",
    ], { label: "Elegir contraseña nueva", url }),
  };
}
