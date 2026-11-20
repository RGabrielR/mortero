# Términos y privacidad

Los textos que se ven en la app están en:

- [`apps/web/src/legal/terminos.md`](../../apps/web/src/legal/terminos.md): se ven en `/terminos`
- [`apps/web/src/legal/privacidad.md`](../../apps/web/src/legal/privacidad.md): se ven en `/privacidad`

Son Markdown simple: títulos `#` y `##`, párrafos, listas con `-` (un nivel de anidado), `**negrita**`, `[links](url)` y citas con `>`. Los links que empiezan con `/` se abren dentro de la app.

## Cómo se registra la aceptación

- Al crear el perfil hay que tildar "Leí y acepto". La API guarda en `profile.terms_version` y `profile.terms_accepted_at` qué versión se aceptó y cuándo. Es la prueba del consentimiento que pide la Ley 25.326 para los datos sensibles.
- Quien no aceptó la versión vigente (cuentas viejas, o cuando los textos cambian) ve un cartel arriba con "Leí y acepto".

**Si cambiás algo importante de los textos**, subí la fecha en los dos lados para que a todes les vuelva a aparecer el cartel:
- `apps/api/src/legal.ts` → `TERMS_VERSION`
- `apps/web/src/legal/version.ts` → `TERMS_VERSION`

Un arreglo de redacción no necesita cambiar la versión.

## Lo que falta completar

Esta es una versión beta, escrita con lo que sabemos hoy. Pendiente:

- [ ] **Responsable de la base de datos:** quién figura (nombre y DNI/CUIT, o una organización) y un domicilio. La ley lo exige. Lo define Gabriel; no completar con nada provisorio.
- [ ] **Mail de contacto** para pedidos sobre datos personales. Hoy el contacto es GitHub Discusiones, que es público. Lo define Gabriel.
- [x] **Servidor:** VPS de Contabo en Europa (confirmado por Gabriel). El disco no está cifrado y así lo dice la política.
- [ ] **País exacto del servidor:** probablemente Alemania; Gabriel lo confirma en el panel de Contabo.
- [ ] **Inscribir la base de datos en la AAIP:** es obligatorio y gratuito. Después, sumar el número de registro a la política.
- [ ] **Mensajes borrados en grupos:** hoy el texto queda en la base (`status = 'deleted'`). Decidir si se borra de verdad o si se guarda un tiempo para moderar, y actualizar el punto 6 de la política.
- [ ] **Backups:** hoy quedan en el mismo servidor (14 días). Gabriel arma una copia cifrada afuera; cuando esté, actualizar el punto 7 de la política.
- [ ] **Proveedor de mails:** nombrarlo cuando esté definido.
- [ ] **Jurisdicción:** definir si se fija una ciudad.
- [ ] **Revisión legal:** que lo lea alguien que sepa de derecho, por ejemplo una organización LGBTIQ+ con área legal.
