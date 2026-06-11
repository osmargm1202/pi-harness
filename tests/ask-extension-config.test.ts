import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { loadOrgmConfig } from "../extensions/lib/orgm-config.ts";
import { isOrgmExtensionEnabled, setOrgmExtensionFeature } from "../extensions/lib/orgm-extension-config.ts";

const legacyConfig = {
  extensions: {
    ask: {
      enabled: false,
      features: {
        questions: { enabled: true },
        permissions: { enabled: false },
      },
    },
  },
};

assert.equal(isOrgmExtensionEnabled("ask", legacyConfig as any), true, "ask should stay active when any ask feature is enabled");
assert.equal(isOrgmExtensionEnabled("ask", legacyConfig as any, "questions"), true, "ask questions should ignore legacy parent enabled=false");
assert.equal(isOrgmExtensionEnabled("ask", legacyConfig as any, "permissions"), false, "ask permissions should remain independently disabled");

const configPath = join(mkdtempSync(join(tmpdir(), "pi-harness-ask-config-")), "orgm.json");
setOrgmExtensionFeature("ask", undefined, false, configPath);
const askOff = loadOrgmConfig(configPath).extensions.ask;
assert.equal(askOff.enabled, true, "ask parent enabled should remain true so feature toggles keep working");
assert.equal(askOff.features.questions.enabled, false, "ask off should disable questions feature");
assert.equal(askOff.features.permissions.enabled, false, "ask off should disable permissions feature");

setOrgmExtensionFeature("ask", "questions", true, configPath);
const questionsOn = loadOrgmConfig(configPath).extensions.ask;
assert.equal(questionsOn.enabled, true, "enabling one ask feature should keep parent enabled");
assert.equal(questionsOn.features.questions.enabled, true, "questions can be enabled independently");
assert.equal(questionsOn.features.permissions.enabled, false, "permissions stay off when only questions are enabled");
