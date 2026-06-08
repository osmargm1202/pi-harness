import type { RpcExtensionUIRequest, RpcExtensionUIResponse } from "@earendil-works/pi-coding-agent";

export const RPC_DIALOG_METHODS = ["select", "confirm", "input", "editor"] as const;
export const RPC_FIRE_AND_FORGET_METHODS = ["notify", "setStatus", "setWidget", "setTitle", "set_editor_text"] as const;

type RpcDialogMethod = typeof RPC_DIALOG_METHODS[number];
type RpcFireAndForgetMethod = typeof RPC_FIRE_AND_FORGET_METHODS[number];
type RpcExtensionUIMethod = RpcDialogMethod | RpcFireAndForgetMethod;

interface RpcBridgePayload {
	question?: string;
	context?: string;
	options?: Array<string | { title: string; description?: string }>;
	allowFreeform?: boolean;
	timeout?: number;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

function isRpcExtensionUIMethod(value: unknown): value is RpcExtensionUIMethod {
	return typeof value === "string" && ([...RPC_DIALOG_METHODS, ...RPC_FIRE_AND_FORGET_METHODS] as string[]).includes(value);
}

export function isRpcExtensionUIRequest(value: unknown): value is RpcExtensionUIRequest {
	return isObject(value) && value.type === "extension_ui_request" && isNonEmptyString(value.id) && isRpcExtensionUIMethod(value.method);
}

export function isRpcDialogRequest(value: unknown): value is RpcExtensionUIRequest {
	return isRpcExtensionUIRequest(value) && (RPC_DIALOG_METHODS as readonly string[]).includes(value.method);
}

export function isRpcFireAndForgetRequest(value: unknown): value is RpcExtensionUIRequest {
	return isRpcExtensionUIRequest(value) && (RPC_FIRE_AND_FORGET_METHODS as readonly string[]).includes(value.method);
}

export function isRpcExtensionUIResponse(value: unknown): value is RpcExtensionUIResponse {
	if (!isObject(value) || value.type !== "extension_ui_response" || !isNonEmptyString(value.id)) return false;
	return "value" in value || typeof value.confirmed === "boolean" || value.cancelled === true;
}

function stringifyOption(option: string | { title: string; description?: string }): string {
	if (typeof option === "string") return option;
	return option.description ? `${option.title} — ${option.description}` : option.title;
}

function titleWithContext(payload: RpcBridgePayload, fallback: string): string {
	const question = payload.question?.trim() || fallback;
	const context = payload.context?.trim();
	return context ? `${question}\n${context}` : question;
}

function normalizeOptions(payload: RpcBridgePayload, fallback: string[]): string[] {
	const options = payload.options?.map(stringifyOption).filter(isNonEmptyString) ?? [];
	return options.length > 0 ? options : fallback;
}

export function mapPermissionPayloadToRpcSelectRequest(id: string, payload: RpcBridgePayload): RpcExtensionUIRequest {
	return {
		type: "extension_ui_request",
		id,
		method: "select",
		title: titleWithContext(payload, "Permission request"),
		options: normalizeOptions(payload, ["Allow", "Block"]),
		...(typeof payload.timeout === "number" ? { timeout: payload.timeout } : {}),
	} as RpcExtensionUIRequest;
}

export function mapQuestionPayloadToRpcRequest(id: string, payload: RpcBridgePayload): RpcExtensionUIRequest {
	const timeout = typeof payload.timeout === "number" ? { timeout: payload.timeout } : {};
	if (payload.options?.length) {
		return {
			type: "extension_ui_request",
			id,
			method: "select",
			title: titleWithContext(payload, "Question"),
			options: normalizeOptions(payload, []),
			...timeout,
		} as RpcExtensionUIRequest;
	}
	return {
		type: "extension_ui_request",
		id,
		method: payload.allowFreeform ? "input" : "editor",
		title: titleWithContext(payload, "Question"),
		placeholder: "Type response...",
		...timeout,
	} as RpcExtensionUIRequest;
}
