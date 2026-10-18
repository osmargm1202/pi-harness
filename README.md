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

- `git:github.com/osmargm1202/pi-banner`
- `git:github.com/osmargm1202/pi-caveman`
- `git:github.com/osmargm1202/pi-clear`
- `git:github.com/osmargm1202/pi-footer`
- `git:github.com/osmargm1202/pi-init`
- `git:github.com/osmargm1202/pi-limit`
- `git:github.com/osmargm1202/pi-notify`
- `git:github.com/osmargm1202/pi-rename`
- `git:github.com/osmargm1202/pi-themes`
- `git:github.com/osmargm1202/pi-title`
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
pi install git:github.com/osmargm1202/pi-footer
pi uninstall git:github.com/osmargm1202/pi-footer
```

## Intercom: reactivar agentes al recibir mensajes

Si los mensajes llegan pero la sesión receptora no empieza a trabajar, revisa
`~/.pi/agent/intercom/config.json`. Con `"inboundTrigger": "replies"`, un `send`
nuevo o un `ask` inicial se entrega, pero no inicia un turno en una sesión idle.
La confirmación de entrega no implica que el agente haya ejecutado la tarea.

Configura explícitamente la política de colaboración:

```bash
pi-harness --configure-intercom --dry-run
pi-harness --configure-intercom
```

Desde un clon del repositorio, sin instalar ni reinstalar el stack:

```bash
node scripts/install-orgm-pi-packages.mjs --configure-intercom --dry-run
node scripts/install-orgm-pi-packages.mjs --configure-intercom
```

La opción solo configura Intercom; no ejecuta `pi install`. Escribe:

```json
{
  "enabled": true,
  "inboundTrigger": "always",
  "busyDelivery": "human-first",
  "replyHint": true
}
```

- `always` permite iniciar un turno con mensajes nuevos, tanto `send` como `ask`.
- `human-first` da prioridad al input humano cuando el agente está ocupado; los
  mensajes de otros agentes esperan un punto de entrega seguro.
- Conserva el resto de opciones existentes, incluido `replyHint` si ya estaba
  definido, y crea una copia exacta `config.json.backup-*` antes de modificarlo.
- Respeta `PI_CODING_AGENT_DIR` si está definido. No sobrescribe JSON inválido ni
  enlaces simbólicos: para configuraciones gestionadas con Nix, cambia el origen.
- Es idempotente y `--dry-run` no escribe nada.

**Ejecuta `/reload` o reinicia Pi en cada sesión receptora.** Intercom lee esta
configuración al cargar la extensión. No hace falta instalar `pi-loop` ni otra
extensión de reactivación. Esto funciona con sesiones vivas; no revive procesos
cerrados ni crea sesiones nuevas.

**Consumo de tokens:** los mensajes entrantes pueden iniciar llamadas al modelo.
Evita intercambios de confirmación infinitos entre agentes. Por eso la opción es
explícita: la instalación normal y `postinstall` no cambian tu política de Intercom.

## Verificación

```bash
npm test
npm run pack:check
```

Prueba de integración opcional contra paquetes instalados (Pi 1.3.0 e Intercom
0.17.1 verificados). Usa un broker aislado y un proveedor ficticio local: no accede
a credenciales, no hace llamadas a modelos de pago y no toca sesiones reales.
Reproduce que `replies` no inicia turnos con mensajes nuevos y comprueba que la
configuración generada sí reactiva una `AgentSession` real con `send` y `ask`.

```bash
PI_INTERCOM_PACKAGE=/ruta/al/paquete/pi-intercom \
PI_SDK_PACKAGE=/ruta/al/paquete/@earendil-works/pi-coding-agent \
npm run test:intercom
```

Las rutas deben ser absolutas y apuntar a los directorios de los paquetes (con su
`package.json`), no a los ejecutables. Sin ambas rutas, la prueba se omite.

## Nota de seguridad

Pi instala código ejecutable de paquetes de terceros. Revisa orígenes antes de actualizar.
