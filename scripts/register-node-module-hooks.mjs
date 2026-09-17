import { register } from "node:module";

// Dipakai lewat `node --import ./scripts/register-node-module-hooks.mjs`
// sebelum entrypoint dijalankan, sehingga hook resolusi aktif lebih dulu.
register("./node-module-hooks.mjs", import.meta.url);
