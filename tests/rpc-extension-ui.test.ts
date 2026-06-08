import assert from "node:assert/strict";
import {
	isRpcDialogRequest,
	isRpcExtensionUIRequest,
	isRpcExtensionUIResponse,
	isRpcFireAndForgetRequest,
	mapPermissionPayloadToRpcSelectRequest,
	mapQuestionPayloadToRpcRequest,
	RPC_DIALOG_METHODS,
	RPC_FIRE_AND_FORGET_METHODS,
} from "../extensions/lib/rpc-extension-ui.ts";

assert.deepEqual(
	RPC_DIALOG_METHODS,
	["select", "confirm", "input", "editor"],
	"dialog method list should match Pi RPC extension UI protocol",
);
assert.deepEqual(
	RPC_FIRE_AND_FORGET_METHODS,
	["notify", "setStatus", "setWidget", "setTitle", "set_editor_text"],
	"fire-and-forget method list should match Pi RPC extension UI protocol",
);

const selectRequest = {
	type: "extension_ui_request",
	id: "request-1",
	method: "select",
	title: "Pick one",
	options: ["Allow", "Block"],
	timeout: 1000,
};
assert.equal(isRpcExtensionUIRequest(selectRequest), true, "valid select request should be accepted");
assert.equal(isRpcDialogRequest(selectRequest), true, "select request should be classified as dialog");
assert.equal(isRpcFireAndForgetRequest(selectRequest), false, "select request should not be fire-and-forget");

const notifyRequest = {
	type: "extension_ui_request",
	id: "request-2",
	method: "notify",
	message: "Done",
	notifyType: "info",
};
assert.equal(isRpcExtensionUIRequest(notifyRequest), true, "valid notify request should be accepted");
assert.equal(isRpcDialogRequest(notifyRequest), false, "notify request should not be dialog");
assert.equal(isRpcFireAndForgetRequest(notifyRequest), true, "notify request should be fire-and-forget");

assert.equal(isRpcExtensionUIRequest({ type: "extension_ui_request", id: "x", method: "unknown" }), false, "unknown request method should be rejected");
assert.equal(isRpcExtensionUIRequest({ type: "wrong", id: "x", method: "select" }), false, "wrong request type should be rejected");
assert.equal(isRpcExtensionUIRequest({ type: "extension_ui_request", id: "", method: "select" }), false, "empty id should be rejected");

assert.equal(isRpcExtensionUIResponse({ type: "extension_ui_response", id: "request-1", value: "Allow" }), true, "value response should be accepted");
assert.equal(isRpcExtensionUIResponse({ type: "extension_ui_response", id: "request-1", confirmed: false }), true, "confirm response should be accepted");
assert.equal(isRpcExtensionUIResponse({ type: "extension_ui_response", id: "request-1", cancelled: true }), true, "cancel response should be accepted");
assert.equal(isRpcExtensionUIResponse({ type: "extension_ui_response", id: "" }), false, "empty response id should be rejected");
assert.equal(isRpcExtensionUIResponse({ type: "extension_ui_response", id: "request-1" }), false, "response with no result field should be rejected");

const permissionRequest = mapPermissionPayloadToRpcSelectRequest("permission-1", {
	question: "Allow bash?",
	context: "Command: rm -rf /tmp/example",
	options: ["Allow", "Block"],
	timeout: 5000,
});
assert.deepEqual(
	permissionRequest,
	{
		type: "extension_ui_request",
		id: "permission-1",
		method: "select",
		title: "Allow bash?\nCommand: rm -rf /tmp/example",
		options: ["Allow", "Block"],
		timeout: 5000,
	},
	"permission payload should map to typed select request with context in title",
);

const selectQuestion = mapQuestionPayloadToRpcRequest("question-1", {
	question: "Choose path",
	options: [{ title: "A", description: "fast" }, "B"],
	timeout: 3000,
});
assert.deepEqual(
	selectQuestion,
	{
		type: "extension_ui_request",
		id: "question-1",
		method: "select",
		title: "Choose path",
		options: ["A — fast", "B"],
		timeout: 3000,
	},
	"question with options should map to select request",
);

const inputQuestion = mapQuestionPayloadToRpcRequest("question-2", {
	question: "Add comment",
	allowFreeform: true,
	context: "Explain why",
});
assert.deepEqual(
	inputQuestion,
	{
		type: "extension_ui_request",
		id: "question-2",
		method: "input",
		title: "Add comment\nExplain why",
		placeholder: "Type response...",
	},
	"freeform question should map to input request",
);
