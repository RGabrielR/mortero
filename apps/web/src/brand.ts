/**
 * La marca vive en packages/brand (nombre, colores, temas, tipografía). Esto la re-exporta para que
 * las pantallas importen de "../brand" como siempre.
 *
 * Las claves de localStorage ("mortero:filtros", etc.) y el evento "mortero:read" NO se renombran:
 * son internas y si cambian se pierden las preferencias que cada persona ya tiene guardadas.
 */
export * from "@mortero/brand";
