import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // Server modules must never be pulled into client bundles.
      "no-restricted-imports": ["error", { patterns: [{ group: ["@/server/*"], message: "Client code must not import server modules." }] }],
    },
  },
  { files: ["src/server/**", "src/app/api/**", "src/app/**/page.tsx", "src/app/**/layout.tsx", "scripts/**", "tests/**"], rules: { "no-restricted-imports": "off" } },
  { ignores: [".next/**", "node_modules/**", "drizzle/**", "var/**", "public/**", "assets-src/**", "src/server/db/auth-schema.ts", "next-env.d.ts", "tests/live/**"] },
];

export default config;
