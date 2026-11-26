// Writes the synthetic character files in dev/fixtures/. Every name, AI ID and sentence in them is made up.
"use strict";
const fs = require("fs"), path = require("path");
const IO = require("../public/chario.js");
const out = path.join(__dirname, "fixtures");
fs.mkdirSync(out, { recursive: true });
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==";
const L = (o) => JSON.stringify(o);
const ai = (id, name, extra, n) => L({ type: "entity", entity_type: "ai", entity_id: id, data: Object.assign({ ai_id: id, ai_name: name, ai_gender: "female", ai_backstory: `${name} is a made-up test character who likes lighthouses.`, ai_memory: `${name} remembers the fake harbour.`, ai_example_message: "Hello from the test fixtures.", ai_directive: "Be kind.", ai_additional_context: "Synthetic data.", default_room_bio: `${name}'s room`, custom_avatar_description: "A drawing of a test lighthouse.", custom_avatar_face_prompt: "round face", developed_context_v1: "Learned nothing real.", template_share_code: "ABC" + n + "x", template_id: "tpl-" + id, created_at: 1700000000 + n }, extra || {}) });
const lines = [
  L({ type: "meta", schema_version: 2, attachment_mode: "none", generated_at: "2026-01-01T00:00:00Z" }),
  L({ type: "user", data: { user_name: "Test Person", ai_list: ["fixtureAiOne000000001", "fixtureAiTwo000000002", "fixtureAiThree0000003"] } }),
  L({ type: "persona", data: { name: "Test persona" } }),
  ai("fixtureAiOne000000001", "Testa", { custom_avatar_url: "https://storage.kindroid.ai/fixture/testa.png" }, 1),
  ai("fixtureAiTwo000000002", "Bruno", { ai_gender: "male", template_share_code: "" }, 2),
  ai("fixtureAiThree0000003", "Cleo", { display_avatar_url: "https://evil.example/not-allowed.png" }, 3),
  ai("kn_fakekey", "Keyholder", {}, 4),
  L({ type: "entity", entity_type: "ai", entity_id: "", data: { ai_name: "No Id" } }),
  L({ type: "entity", entity_type: "shared_template", entity_id: "tpl-fixtureAiOne000000001", data: { template_id: "tpl-fixtureAiOne000000001", ai_tagline: "Fixture tagline", ai_greeting: "Fixture greeting" } }),
];
for (let i = 0; i < 40; i++) lines.push(L({ type: "text_message", entity_type: "ai", entity_id: "fixtureAiOne000000001", data: { text: "synthetic chat line " + i } }));
for (let i = 0; i < 5; i++) lines.push(L({ type: "voice_message", data: {} }), L({ type: "journal_entry", data: {} }));
lines.push("this line is not json");
fs.writeFileSync(path.join(out, "kindroid-export.jsonl"), lines.join("\n") + "\n");

const kins = [
  { name: "Testa", ai_id: "fixtureAiOne000000001", share_code: "ABC1x", notes: "first", details: { backstory: "Made-up backstory.", tagline: "Fixture tagline" }, avatar: PNG },
  { name: "Dara", ai_id: "fixtureAiFour00000004", share_code: "", notes: "", details: { memory: "Made-up memory." }, avatar: "" },
];
fs.writeFileSync(path.join(out, "kin-relay-characters.json"), JSON.stringify(IO.toRelayFile(kins, "fixture"), null, 1));
fs.writeFileSync(path.join(out, "kin-studio-characters.json"), JSON.stringify(IO.toStudioFile(kins), null, 1));
console.log("fixtures written");
