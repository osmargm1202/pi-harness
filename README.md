# pi-harness

Instalador standalone para el stack de ORGM.

Ya no contiene manifiesto `pi` ni actúa como paquete bundle del runtime.
Ahora su único rol es instalar de forma explícita los paquetes `pi-*` que este proyecto define.

## Qué hace

- Lee `dependencies` de este `package.json`.
- Genera instalaciones `pi install` para cada paquete `pi-*`.
- Ejecuta cada instalación de forma secuencial.
- Acepta `github:` y `npm:` (incluyendo paquetes que no son de `osmargm1202`).

## Instalación (global)

```bash
npm i -g pi-harness
```

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

Incluye paquetes `pi-*` desde `dependencies`:

- `pi-banner` (github)
- `pi-caveman` (github)
- `pi-clear` (github)
- `pi-footer` (github)
- `pi-init` (github)
- `pi-intercom` (npm)
- `pi-limit` (github)
- `pi-lens` (npm)
- `pi-mcp-adapter` (npm)
- `pi-notify` (github)
- `pi-rename` (github)
- `pi-subagents-j0k3r` (npm)
- `pi-themes` (github)
- `pi-title` (github)
- `pi-web-access` (npm)
- `@juicesharp/rpiv-ask-user-question` (npm)
- `@juicesharp/rpiv-todo` (npm)
- `gentle-engram` (npm)

Puedes instalar/desinstalar individualmente con `pi` siempre:

```bash
pi install git:github.com/osmargm1202/pi-footer
pi uninstall git:github.com/osmargm1202/pi-footer
```

## Verificación

```bash
node --test tests/harness-bundle-only.test.mjs
npm run pack:check
```

## Nota de seguridad

Pi instala código ejecutable de paquetes de terceros. Revisa origenes antes de actualizar.
