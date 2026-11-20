/**
 * La marca vive en packages/brand (nombre, colores de los mails, etc.). Esto la re-exporta para que
 * el resto del API importe de "./brand.js" como siempre.
 * El remitente de los mails se configura aparte, con la variable MAIL_FROM.
 */
export * from "@mortero/brand";
