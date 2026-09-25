import js from "@eslint/js";
import next from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [
      ".next/**",
      "node_modules/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "free-react-tailwind-admin-dashboard-main/**",
      // Folder skill/agent AI (bukan kode aplikasi) — diabaikan agar lint fokus ke aplikasi.
      ".agents/**",
      ".augment/**",
      ".claude/**",
      ".codebuddy/**",
      ".codewhale/**",
      ".commandcode/**",
      ".continue/**",
      ".cursor/**",
      ".factory/**",
      ".gemini/**",
      ".github/prompts/**",
      ".kilocode/**",
      ".kiro/**",
      ".opencode/**",
      ".qoder/**",
      ".roo/**",
      ".trae/**",
      ".warp/**",
      ".windsurf/**",
    ],
  },
  js.configs.recommended,
  ...next,
  {
    rules: {
      "no-undef": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

export default eslintConfig;
