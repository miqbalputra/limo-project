import assert from "node:assert/strict";
import { requestJson } from "../src/lib/api-json-client.ts";

const originalFetch = globalThis.fetch;

try {
  let capturedInit;
  globalThis.fetch = async (_input, init) => {
    capturedInit = init;
    return new Response(JSON.stringify({ data: { uploaded: true } }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };

  const formData = new FormData();
  formData.set("file", "contoh");
  const response = await requestJson("/api/upload", { method: "POST", body: formData });

  assert.deepEqual(response.data, { uploaded: true });
  assert.equal(capturedInit?.body, formData);
  assert.equal(new Headers(capturedInit?.headers).has("Content-Type"), false);
} finally {
  globalThis.fetch = originalFetch;
}

console.log("ok - typed API client preserves FormData bodies without forcing a JSON content type");
