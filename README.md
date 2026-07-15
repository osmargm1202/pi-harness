# pi-harness

Instalador standalone para el stack de ORGM.

Ya no contiene manifiesto `pi` ni actúa como paquete bundle del runtime.
Ahora su único rol es instalar de forma explícita los paquetes `pi-*` que este proyecto define.

## Qué hace

- Usa una lista interna en el script (`scripts/install-orgm-pi-packages.mjs`).
- Genera instalaciones `pi install` para cada paquete.
- Ejecuta cada instalación de forma secuencial.
- Acepta `github:` y `npm:` (incluyendo paquetes que no son de `osmargm1202`).

## Instalación (global)

```bash
npm i -g @osmargm1202/pi-harness
```

> Nota: el nombre correcto del paquete es scoped. `npm i -g osmargm1202/pi-harness` instala desde GitHub y no es el flujo recomendado.

Al instalar en modo global, `postinstall` ejecuta el instalador y hace `pi install ...` por paquete.

También puedes ejecutar manualmente el binario:

```bash
pi-harness
pi-harness --dry-run
```

También está disponible por npm-script:

```bash
npm run install:orgm-pi
npm run install:orgm-pi -- --dry-run
```

## Qué instala hoy

Lista del instalador (ordenada):

- `git:github/osmargm1202/pi-banner`
- `git:github/osmargm1202/pi-caveman`
- `git:github/osmargm1202/pi-clear`
- `git:github/osmargm1202/pi-footer`
- `git:github/osmargm1202/pi-init`
- `git:github/osmargm1202/pi-limit`
- `git:github/osmargm1202/pi-notify`
- `git:github/osmargm1202/pi-rename`
- `git:github/osmargm1202/pi-themes`
- `git:github/osmargm1202/pi-title`
- `npm:@juicesharp/rpiv-ask-user-question`
- `npm:@juicesharp/rpiv-todo`
- `npm:gentle-engram`
- `npm:pi-intercom`
- `npm:@hypabolic/pi-hypa`
- `npm:pi-lens`
- `npm:pi-mcp-adapter`
- `npm:pi-subagents-j0k3r`
- `npm:pi-web-access`

Puedes instalar/desinstalar individualmente con `pi` siempre:

```bash
pi install git:github/osmargm1202/pi-footer
pi uninstall git:github/osmargm1202/pi-footer
```

## Verificación

```bash
node --test tests/harness-bundle-only.test.mjs
npm run pack:check
```

## Nota de seguridad

Pi instala código ejecutable de paquetes de terceros. Revisa orígenes antes de actualizar.
