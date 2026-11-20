# Cómo sumarte a qule.ar

qule.ar es una app comunitaria, gratuita y de código abierto. No tiene empresa atrás: la armamos entre quienes quieran. Toda ayuda suma, también si no programás.

## Dónde se habla cada cosa

| Qué | Dónde |
|---|---|
| Ideas, propuestas, preguntas, debates | [Discusiones](https://github.com/RGabrielR/qule.ar/discussions) |
| Diseño, colores, tipografía, tono | el hilo [Look and feel](https://github.com/RGabrielR/qule.ar/discussions/3) (y [docs/LOOK.md](docs/LOOK.md)) |
| La historia del nombre | el hilo [El nombre](https://github.com/RGabrielR/qule.ar/discussions/2) |
| Bugs concretos y tareas ya acordadas | [Issues](https://github.com/RGabrielR/qule.ar/issues) |
| Cambios de código | Pull requests |

La regla: **las ideas arrancan en Discusiones**. Cuando una idea se acuerda, se convierte en un issue y alguien la toma.

## Primeros pasos

1. Leé el [README](README.md) para levantarlo en tu compu (no hace falta instalar Postgres).
2. Mirá los issues con la etiqueta [`para empezar`](https://github.com/RGabrielR/qule.ar/labels/para%20empezar).
3. Comentá en el issue que lo vas a tomar, así no se pisan dos personas.
4. Hacé un fork, una rama y mandá el pull request.

## Cómo está armado

- `apps/api`: Node + Hono + Socket.IO + Better Auth + Drizzle. Las rutas están en `src/routes/`, el antispam en `src/antispam.ts`.
- `apps/web`: React + Vite, es una PWA. Las pantallas están en `src/pages/`, todos los estilos en `src/styles.css`.
- `packages/brand`: la marca en un solo lugar (nombre, colores, temas, tipografía, radios). La usan la web y el API. Ver [docs/LOOK.md](docs/LOOK.md).
- `docs/PLAN.md`: el plan y las decisiones de diseño. `docs/DEPLOY.md`: cómo se sube a un servidor.

Si cambiás la base de datos, editá `apps/api/src/db/schema.ts` y corré `npm run db:generate`. Incluí la migración generada en el PR.

## Cosas que no se negocian

Son la razón de ser de la app. Si un cambio va en contra de alguna, mejor charlarlo antes en Discusiones.

- **Todo gratis.** No hay funciones pagas, ni publicidad, ni venta de datos.
- **Privacidad primero.** Nunca se guarda ni se muestra la ubicación exacta. Las distancias van en tramos. Las fotos pierden sus metadatos. Las notificaciones no dicen quién escribió ni qué.
- **Solo mayores de 18.**
- **Nadie acapara los chats.** El antispam (modo lento, cola y rotación) se puede ajustar, pero no sacar.
- **Datos mínimos.** Si una función no necesita un dato, no se pide.

## Pull requests

- Uno por tema, chico si se puede.
- Contá qué cambia y cómo lo probaste. Si toca la pantalla, sumá una captura.
- Si toca la pantalla, seguí [docs/LOOK.md](docs/LOOK.md): nada de colores, tamaños ni radios sueltos, todo con las variables de la marca. Antes de mandarlo corré `npm run check` (marca + tipos + build); en el PR lo corre solo.
- Todos los textos de la app van en español rioplatense, con voseo ("Tenés un mensaje nuevo").
- Si encontrás un problema de seguridad o privacidad, **no abras un issue público**: escribile a la persona que mantiene el repo por mensaje privado en GitHub.

## Convivencia

Este es un proyecto hecho por y para una comunidad diversa. Leé el [código de convivencia](CODE_OF_CONDUCT.md) antes de participar.
