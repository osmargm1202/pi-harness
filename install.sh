#!/usr/bin/env bash
# ORGM Pi stack: curl -fsSL https://pi.or-gm.com/install.sh | bash
set -euo pipefail

main() {
  local dry_run=0 arg source_dir='' work_dir='' pi_version prefix
  for arg in "$@"; do
    case "$arg" in
      --dry-run|-d) dry_run=1 ;;
      --help|-h)
        printf '%s\n' \
          'Uso: bash install.sh [--dry-run]' \
          'Instala Pi si falta, los paquetes fijados del stack y configura Intercom.' \
          'Requiere Node.js >= 22.19, npm, git y (desde URL) curl y tar.' \
          'Intercom podrá iniciar llamadas al modelo al recibir mensajes.' \
          'No copia credenciales ni elimina paquetes ajenos. No utiliza sudo.'
        return 0 ;;
      *) printf 'Opción desconocida: %s\n' "$arg" >&2; return 1 ;;
    esac
  done

  command -v node >/dev/null 2>&1 || {
    printf 'Instala Node.js >= 22.19 con npm (https://nodejs.org/) y vuelve a ejecutar.\n' >&2
    return 1
  }
  node -e 'const [a,b] = process.versions.node.split(".").map(Number); process.exit(a > 22 || (a === 22 && b >= 19) ? 0 : 1)' || {
    printf 'Se requiere Node.js >= 22.19. Actualiza Node y vuelve a ejecutar.\n' >&2
    return 1
  }
  local tool
  for tool in npm git; do
    command -v "$tool" >/dev/null 2>&1 || { printf 'Falta el requisito: %s\n' "$tool" >&2; return 1; }
  done

  # Resolve a relative override before running any installer subprocesses elsewhere.
  export PI_CODING_AGENT_DIR
  PI_CODING_AGENT_DIR=$(node -e 'const p=require("node:path"); const d=process.env.PI_CODING_AGENT_DIR?.trim(); console.log(d ? p.resolve(d) : p.join(require("node:os").homedir(), ".pi", "agent"))')

  # A checkout/npm tarball works offline for the entrypoint; curl | bash fetches one snapshot.
  if [[ -n "${BASH_SOURCE[0]:-}" && -f "${BASH_SOURCE[0]}" ]]; then
    source_dir=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
    if [[ ! -f "$source_dir/scripts/stack.mjs" ]]; then source_dir=''; fi
  fi
  if [[ -z "$source_dir" ]]; then
    for tool in curl tar; do
      command -v "$tool" >/dev/null 2>&1 || { printf 'Falta el requisito: %s\n' "$tool" >&2; return 1; }
    done
    work_dir=$(mktemp -d "${TMPDIR:-/tmp}/pi-harness.XXXXXXXX")
    # Capture the private temp path so cleanup also works after main returns on error.
    trap "rm -rf -- $(printf '%q' "$work_dir")" EXIT
    trap 'exit 130' INT
    trap 'exit 143' TERM
    printf 'Descargando matriz de osmargm1202/pi-harness (main)...\n'
    curl --proto '=https' --tlsv1.2 -fsSL --retry 3 --connect-timeout 15 --max-time 120 \
      https://codeload.github.com/osmargm1202/pi-harness/tar.gz/main -o "$work_dir/stack.tgz"
    mkdir "$work_dir/source"
    tar -xzf "$work_dir/stack.tgz" --strip-components=1 -C "$work_dir/source"
    source_dir="$work_dir/source"
  fi

  pi_version=$(node --input-type=module -e 'import {pathToFileURL} from "node:url"; console.log((await import(pathToFileURL(process.argv[1]))).PI_VERSION)' "$source_dir/scripts/stack.mjs")
  if ! command -v pi >/dev/null 2>&1; then
    prefix="$HOME/.local"
    if [[ "$dry_run" == 1 ]]; then
      printf '> npm install --global --ignore-scripts --prefix "%s" @earendil-works/pi-coding-agent@%s\n' "$prefix" "$pi_version"
      printf 'Al instalar, agrega %s/bin a tu PATH si aún no está.\n' "$prefix"
    else
      printf 'Instalando Pi %s en %s (sin sudo)...\n' "$pi_version" "$prefix"
      npm install --global --ignore-scripts --prefix "$prefix" "@earendil-works/pi-coding-agent@$pi_version" </dev/null
      export PATH="$prefix/bin:$PATH"
      command -v pi >/dev/null 2>&1 || { printf 'No se encontró Pi tras instalarlo.\n' >&2; return 1; }
      printf 'Para futuras terminales, agrega a tu configuración del shell:\n  export PATH="$HOME/.local/bin:$PATH"\n'
    fi
  else
    printf 'Usando Pi existente (no se actualiza ni reemplaza). Matriz verificada con Pi %s.\n' "$pi_version"
  fi

  printf 'Intercom permitirá turnos automáticos con mensajes entrantes (pueden consumir tokens).\n'
  if [[ "$dry_run" == 1 ]]; then
    node "$source_dir/scripts/install-orgm-pi-packages.mjs" --setup --dry-run </dev/null
  else
    node "$source_dir/scripts/install-orgm-pi-packages.mjs" --setup </dev/null
    printf '\nListo. Abre pi y ejecuta /login para conectar tu proveedor.\n'
    printf 'En sesiones ya abiertas, ejecuta /reload o reinicia Pi.\n'
  fi
  if [[ -n "$work_dir" ]]; then
    rm -rf -- "$work_dir"
    trap - EXIT INT TERM
  fi
}

main "$@"
