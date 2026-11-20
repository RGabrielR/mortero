# Look and feel

Así se ve y se siente qule.ar hoy. Es un punto de partida, no algo cerrado: las propuestas se charlan en el hilo [Look and feel](https://github.com/RGabrielR/mortero/discussions/3).

## La idea

- **Oscuro y cálido.** Fondo casi negro con un toque violeta y un solo color de acento, naranja "brasa". Nada de amarillo chillón ni azul corporativo.
- **Discreto.** Se tiene que poder abrir en el colectivo sin que se note qué app es: sin fotos gigantes de entrada, notificaciones que no dicen nada.
- **Pocas cosas, bien hechas.** Cuatro pestañas (Cerca, Grupos, Mensajes, Yo). Si algo nuevo no entra ahí, probablemente vaya dentro de una.
- **Pensada para el celular.** Se diseña primero para una pantalla de 375 px de ancho y una mano.

## Colores

Están definidos como variables al principio de `apps/web/src/styles.css`. Usá siempre las variables, nunca colores sueltos.

| Variable | Color | Para qué |
|---|---|---|
| `--bg` | `#0c0b0d` | Fondo |
| `--surface` / `-2` / `-3` | `#151318` / `#1e1b22` / `#29252e` | Tarjetas, inputs, hover |
| `--line` | `#2e2a33` | Bordes |
| `--text` | `#f2eef5` | Texto |
| `--muted` | `#9b94a4` | Texto secundario |
| `--accent` | `#ff6a3d` | Brasa: botones principales, el logo, lo que está activo |
| `--queue` | `#f5b84a` | Mensajes en cola del antispam |
| `--danger` | `#ff4d6d` | Borrar, bloquear, errores |
| `--ok` | `#4fd18b` | En línea |

El acento se usa poco: si todo es naranja, nada se destaca.

## Tipografía

- **Bricolage Grotesque** (800) para el logo y los títulos grandes.
- **Inter** para todo lo demás. Texto base de 15 px.

## Formas

- Bordes redondeados de 14 px en tarjetas; botones en forma de píldora.
- La grilla de gente es de fotos cuadradas, sin espacio entre ellas, con el nombre y el estado encima.

## Tono de los textos

- Español rioplatense con voseo: "Tenés", "Pedí entrar", "Escribí algo".
- Corto y cálido, sin chistes forzados ni emojis en la interfaz.
- Nunca culpar a quien usa la app: "No se pudo enviar, probá de nuevo", no "Error 500".
- Lenguaje inclusivo cuando hace falta ("todes"), sin forzarlo en cada frase.

## Temas abiertos

Cosas que están para definir entre todes:

- El logo (hoy es solo la palabra en naranja) y el ícono de la app.
- ¿Un modo claro, o oscuro siempre?
- Íconos propios en lugar de los genéricos.
- El nombre definitivo, que cambia todo lo demás.
