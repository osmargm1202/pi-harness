# pi-harness

Instalador standalone de la base de Pi elegida por ORGM. Instala una matriz de
**11 paquetes fijados a versiones o commits**, configura Intercom para que una
petición entrante pueda iniciar un turno y termina. Después, cada usuario puede
cambiar su instalación libremente; no hay sincronización ni políticas en segundo plano.

No es un paquete bundle del runtime ni contiene extensiones propias.

## Instalación rápida (Linux/macOS)

Requisitos: **Node.js >= 22.19**, npm, git, curl y tar. Si falta Node, instálalo
primero desde <https://nodejs.org/> o con tu gestor de versiones. No usa `sudo`.

```bash
curl -fsSL https://raw.githubusercontent.com/osmargm1202/pi-harness/main/install.sh | bash
```

La rama del repositorio es **`main`, no `master`**. Una vez publicado `install.sh`,
el enlace corto previsto debe redirigir por HTTPS a esa URL:

```text
https://pi.or-gm.com/install.sh
  → https://raw.githubusercontent.com/osmargm1202/pi-harness/main/install.sh
```

Cuando hayas configurado esa redirección:

```bash
curl -fsSL https://pi.or-gm.com/install.sh | bash
```

Para revisar antes de ejecutar (recomendado):

```bash
curl -fsSL https://raw.githubusercontent.com/osmargm1202/pi-harness/main/install.sh -o install.sh
less install.sh
bash install.sh --dry-run
bash install.sh
```

`install.sh` descargado obtiene un único snapshot de `main` para usar juntos el
catálogo y los scripts. Desde un clon del repositorio usa los archivos locales:

```bash
bash install.sh --dry-run
bash install.sh
```

### Qué hace

1. Comprueba los requisitos. Si `pi` ya está en el `PATH`, lo conserva sin actualizarlo.
2. Si falta Pi, instala **Pi 1.3.0** con npm en `~/.local`, sin scripts de ciclo de
   vida ni permisos de administrador. Indica cómo agregar `~/.local/bin` al `PATH`
   para futuras terminales; no modifica archivos del shell.
3. Ejecuta `pi install <source>` secuencialmente para los 11 paquetes. Los comandos
   se ejecutan fuera del proyecto actual y configuran el ámbito personal de Pi.
4. Añade `-builtin:mcp` a `settings.json` para que `pi-mcp-adapter` no se solape con
   el MCP integrado de Pi. Conserva otras extensiones y ajustes.
5. Configura Intercom para iniciar turnos con mensajes entrantes y dar prioridad
   al usuario cuando el agente esté ocupado.

Al terminar, abre `pi` y ejecuta `/login` para conectar tu proveedor. En sesiones
ya abiertas, ejecuta `/reload` o reinicia Pi.

**No copia** credenciales, sesiones, identificadores de dispositivo, modelo,
servidores MCP ni preferencias personales de ORGM. No elimina paquetes ajenos.
Reejecutarlo vuelve a aplicar las versiones del catálogo y la política de Intercom;
no mantiene esa política fuera de la ejecución del instalador.

Si una instalación falla, se detiene y elimina los temporales. Los paquetes que
ya se instalaron permanecen instalados; no hay rollback automático. Las políticas
se aplican después de instalar todos los paquetes. Configuraciones inválidas o
archivos de configuración enlazados simbólicamente se rechazan antes de instalar
paquetes; para archivos gestionados con Nix, modifica el origen.

## Matriz aprobada

Única fuente de verdad: [`scripts/stack.mjs`](scripts/stack.mjs). Refleja los
paquetes personales de ORGM al preparar este instalador, sin los paquetes extra
del catálogo anterior. Fuentes y versiones directas fijadas; las dependencias
transitivas siguen las reglas de instalación de cada paquete.

| Paquete | Fuente | Versión / commit |
|---|---|---|
| pi-todo | GitHub: osmargm1202/pi-todo | `3a36a9b9ee3213db157843999b5e262f6a16267c` |
| pi-subagents | GitHub: osmargm1202/pi-subagents | `e07e82d98e8af17da34ceb826c24b8c8d7de6fce` |
| pi-title | GitHub: osmargm1202/pi-title | `a06dc038089bf360243bb501404595143d9213dc` |
| pi-themes | GitHub: osmargm1202/pi-themes | `fce797a2334609b93043337f3cd587f40de4466d` |
| pi-footer | GitHub: osmargm1202/pi-footer | `47cce5267501a3cd62e2ce6c58b66aed475339db` |
| pi-ask | GitHub: osmargm1202/pi-ask | `c6c7a70b17d025e4c9b2b6244dc56483869935a0` |
| pi-notify | GitHub: osmargm1202/pi-notify | `a294591eb4064db484e3496687bb7f7bc163cd5e` |
| pi-web-access | npm | `0.42.0` |
| gentle-engram | npm | `0.4.2` |
| pi-mcp-adapter | npm | `5.3.2` |
| pi-intercom | npm | `0.17.1` |

La matriz se ha verificado con Pi **1.3.0**. Si ya tienes otro Pi instalado, el
instalador lo reutiliza; no garantiza compatibilidad con todas las versiones.

Puedes instalar o quitar paquetes individualmente:

```bash
pi install npm:pi-intercom@0.17.1
pi remove npm:pi-intercom@0.17.1
pi list
```

## Uso por npm o desde el repositorio

```bash
npm i -g @osmargm1202/pi-harness
pi-harness --setup --dry-run
pi-harness --setup
```

El `postinstall` global y `pi-harness` sin opciones instalan **solo los paquetes**.
El modo explícito `--setup`, usado por `install.sh`, también configura Pi e
Intercom. Desde un clon:

```bash
node scripts/install-orgm-pi-packages.mjs --setup --dry-run
node scripts/install-orgm-pi-packages.mjs --setup
```

Para instalar solo paquetes, sin cambiar políticas:

```bash
pi-harness --dry-run
pi-harness
# O bien: npm run install:orgm-pi
```

## Intercom: permitir un turno al recibir una petición

`install.sh` aplica automáticamente en `~/.pi/agent/intercom/config.json`:

```json
{
  "enabled": true,
  "inboundTrigger": "always",
  "busyDelivery": "human-first",
  "replyHint": true
}
```

- `always`: mensajes nuevos `send` y `ask` pueden iniciar un turno en una sesión idle.
- `human-first`: si está ocupada, los mensajes de otros agentes esperan un punto
  de entrega seguro y dan prioridad al input humano.
- `replyHint`: incluye instrucciones para responder; conserva su valor si el
  usuario ya lo había definido, igual que el resto de opciones ajenas a la política.

Para configurar únicamente Intercom, sin instalar paquetes:

```bash
pi-harness --configure-intercom --dry-run
pi-harness --configure-intercom
# Desde un clon:
node scripts/install-orgm-pi-packages.mjs --configure-intercom
```

Los cambios son idempotentes y crean una copia exacta `*.backup-*` antes de
modificar cada configuración existente. Se respeta `PI_CODING_AGENT_DIR`, incluso
si es relativo. `--dry-run` no instala ni escribe configuración (desde la URL
necesita descargar y eliminar el snapshot temporal).

**Ejecuta `/reload` o reinicia cada sesión receptora.** Funciona con sesiones
vivas que carguen Intercom; no revive procesos cerrados ni crea agentes nuevos.
Permite que el agente atienda la petición usando su comportamiento normal: no
impone un límite de un único turno ni instala un bucle autónomo.

**Consumo de tokens:** mensajes entrantes pueden generar llamadas al modelo.
Evita intercambios de confirmación infinitos entre agentes. Ejecutar `install.sh`
o `--setup` implica elegir explícitamente esa política; el `postinstall` de npm
no la cambia.

## Verificación

```bash
bash -n install.sh
npm test
npm run pack:check
```

Las pruebas del instalador usan ejecutables simulados, directorios temporales y
configuraciones aisladas; no reinstalan tu Pi ni acceden a tus credenciales.

Prueba de integración opcional contra Pi 1.3.0 e Intercom 0.17.1 instalados. Usa un
broker aislado y un proveedor ficticio local, sin llamadas a modelos de pago:

```bash
PI_INTERCOM_PACKAGE=/ruta/al/paquete/pi-intercom \
PI_SDK_PACKAGE=/ruta/al/paquete/@earendil-works/pi-coding-agent \
npm run test:intercom
```

Las rutas deben ser absolutas y apuntar a directorios de paquetes con su
`package.json`. Sin ambas rutas, la prueba se omite.

## Nota de seguridad

Pi instala código ejecutable de paquetes de terceros. Revisa orígenes antes de
actualizar. Un comando `curl | bash` ejecuta código remoto; revisa el script y su
catálogo antes de usarlo. El enlace corto y `main` son mutables, no una garantía
de integridad criptográfica.
