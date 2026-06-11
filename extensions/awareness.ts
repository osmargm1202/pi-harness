import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { ExtensionAPI, ExtensionContext, SessionStartEvent } from "@earendil-works/pi-coding-agent";
import { Text } from "@earendil-works/pi-tui";
import { isOrgmExtensionEnabled } from "./lib/orgm-extension-config.ts";

const execFileAsync = promisify(execFile);
const CUSTOM_TYPE = "awareness";

const AWARENESS_SCRIPT = String.raw`
section() { printf '\n===== %s =====\n' "$1"; }
cmd_path() { command -v "$1" 2>/dev/null || true; }
has_cmd() { command -v "$1" >/dev/null 2>&1; }
os_pretty() { . /etc/os-release 2>/dev/null && printf '%s' "\${PRETTY_NAME:-$NAME}" || uname -s; }
os_id() { . /etc/os-release 2>/dev/null && printf '%s' "\${ID:-N/A}" || printf 'N/A'; }
os_version_id() { . /etc/os-release 2>/dev/null && printf '%s' "\${VERSION_ID:-N/A}" || printf 'N/A'; }
virt_container() { systemd-detect-virt --container 2>/dev/null || printf 'no detectado'; }
virt_any() { systemd-detect-virt 2>/dev/null || printf 'no detectado'; }
is_toolbox() {
  [ -n "\${TOOLBOX_PATH:-}" ] && return 0
  [ -f /run/.containerenv ] && grep -qi 'toolbox\|com.github.containers.toolbox' /run/.containerenv && return 0
  [ -f /run/host/container-manager ] && grep -qi toolbox /run/host/container-manager && return 0
  return 1
}
is_distrobox() {
  [ -n "\${DISTROBOX_ENTER_PATH:-}" ] && return 0
  [ -f /run/.containerenv ] && grep -qi 'distrobox' /run/.containerenv && return 0
  return 1
}
host_exec() {
  if has_cmd distrobox-host-exec; then
    distrobox-host-exec "$@" 2>/dev/null
  elif has_cmd flatpak-spawn; then
    flatpak-spawn --host "$@" 2>/dev/null
  else
    return 127
  fi
}
host_exec_available() {
  has_cmd distrobox-host-exec || has_cmd flatpak-spawn
}
host_os_pretty() { host_exec sh -lc '. /etc/os-release 2>/dev/null && printf "%s" "\${PRETTY_NAME:-$NAME}" || uname -s'; }
host_virt_any() {
  out="$(host_exec systemd-detect-virt 2>/dev/null || true)"
  [ -n "$out" ] && printf '%s' "$out" || printf 'no detectado'
}

section 'CONTEXTO GENERAL'
echo "Fecha: $(date)"
echo "Usuario: $(whoami)"
echo "Host/container: $(hostname)"
echo "PWD: $(pwd)"
echo "Shell actual: \${SHELL:-N/A}"
echo "Terminal: \${TERM:-N/A}"
echo "Tmux: \${TMUX:+SI}\${TMUX:-NO}"
echo "Distro/container: $(os_pretty)"
echo "Kernel/container: $(uname -srmo)"

if host_exec_available && { is_distrobox || is_toolbox || [ "$(virt_container)" != "no detectado" ]; }; then
  section 'HOST EXTERNO'
  echo "Host: $(host_exec hostname || echo 'N/A')"
  echo "Usuario host: $(host_exec whoami || echo 'N/A')"
  echo "OS host: $(host_os_pretty || echo 'N/A')"
  echo "Kernel host: $(host_exec uname -srmo || echo 'N/A')"
  echo "Virtualización host: $(host_virt_any || echo 'N/A')"
  echo "Ejecutor host: $(has_cmd distrobox-host-exec && cmd_path distrobox-host-exec || printf 'flatpak-spawn --host')"
fi

section 'PROYECTO'
echo "Nombre carpeta: $(basename "$PWD")"
echo "Ruta proyecto: $(pwd)"
[ -f package.json ] && echo "Node project: $(node -p "require('./package.json').name || 'sin nombre'" 2>/dev/null)"
[ -f pyproject.toml ] && echo "Python project: pyproject.toml detectado"
[ -f go.mod ] && echo "Go module: $(head -n1 go.mod)"
[ -f Cargo.toml ] && echo "Rust project: Cargo.toml detectado"

section 'GIT'
if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "Repo root: $(git rev-parse --show-toplevel)"
  echo "Branch: $(git branch --show-current)"
  echo "Commit: $(git rev-parse --short HEAD)"
  status="$(git status --short)"
  if [ -n "$status" ]; then
    echo "Estado:"
    printf '%s\n' "$status"
  else
    echo "Estado: limpio"
  fi
  echo "Remotes:"
  git remote -v
else
  echo "No es un repositorio Git"
fi

`.replaceAll("\\${", "${");

async function runAwarenessShell(cwd: string): Promise<string> {
	try {
		const { stdout, stderr } = await execFileAsync("bash", ["-lc", AWARENESS_SCRIPT], {
			cwd,
			timeout: 30000,
			maxBuffer: 4 * 1024 * 1024,
		});
		const output = stdout.trim();
		const errorOutput = stderr.trim();
		return [output, errorOutput ? `[stderr]\n${errorOutput}` : ""].filter(Boolean).join("\n");
	} catch (error) {
		const err = error as { stdout?: string | Buffer; stderr?: string | Buffer; message?: string };
		return [
			"[awareness command failed]",
			err.message ?? "unknown error",
			err.stdout ? String(err.stdout).trim() : "",
			err.stderr ? `[stderr]\n${String(err.stderr).trim()}` : "",
		]
			.filter(Boolean)
			.join("\n");
	}
}

async function runGit(args: string[], cwd: string): Promise<string> {
	try {
		const { stdout } = await execFileAsync("git", args, { cwd, timeout: 2000 });
		return stdout.trim();
	} catch {
		return "";
	}
}

export async function buildAwarenessText(ctx: Pick<ExtensionContext, "cwd">): Promise<string> {
	const output = await runAwarenessShell(ctx.cwd);
	if (output) return output;

	const [gitRoot, branch] = await Promise.all([
		runGit(["rev-parse", "--show-toplevel"], ctx.cwd),
		runGit(["branch", "--show-current"], ctx.cwd),
	]);
	return [
		`pwd: ${ctx.cwd}`,
		`git: ${gitRoot || "no git"}`,
		`branch: ${branch || ""}`,
		`tmux: ${process.env.TMUX ? "yes" : "no"}`,
		`nix-shell: ${process.env.IN_NIX_SHELL ? "yes" : "no"}`,
		`container markers: ${process.env.container || "none"}`,
		`os: ${process.platform}`,
	].join("\n");
}

export function renderAwarenessContent(content: string, expanded: boolean): string {
	if (!expanded) return "awareness";
	return `awareness\n${content}`;
}

function alreadyInjected(ctx: ExtensionContext): boolean {
	return ctx.sessionManager.getEntries().some((entry) => "customType" in entry && entry.customType === CUSTOM_TYPE);
}

function hasConversationEntries(ctx: ExtensionContext): boolean {
	return ctx.sessionManager.getEntries().some((entry) => {
		if (entry.type !== "message") return false;
		return ["user", "assistant", "toolResult"].includes(entry.message.role);
	});
}

function shouldInjectAwareness(reason: SessionStartEvent["reason"], ctx: ExtensionContext): boolean {
	if (alreadyInjected(ctx)) return false;
	if (reason === "new") return true;
	if (reason === "startup") return !hasConversationEntries(ctx);
	return false;
}

export default function (pi: ExtensionAPI) {
	if (!isOrgmExtensionEnabled("awareness")) return;

	pi.registerMessageRenderer(CUSTOM_TYPE, (message, options, theme) => {
		return new Text(theme.fg("muted", renderAwarenessContent(String(message.content ?? ""), options.expanded)), 0, 0);
	});

	pi.on("session_start", async (event, ctx) => {
		if (!shouldInjectAwareness(event.reason, ctx)) return;

		const content = await buildAwarenessText(ctx);
		pi.sendMessage(
			{
				customType: CUSTOM_TYPE,
				content,
				display: true,
				details: { source: "startup-awareness" },
			},
			{ deliverAs: "nextTurn" },
		);
	});
}
