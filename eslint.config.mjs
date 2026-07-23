import js from "@eslint/js";
import next from "eslint-config-next";

const eslintConfig = [
  {
    ignores: [".next/**", "node_modules/**", "coverage/**", "playwright-report/**", "free-react-tailwind-admin-dashboard-main/**"],
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
