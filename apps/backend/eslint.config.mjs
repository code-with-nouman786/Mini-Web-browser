import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist/**", ".test-dist/**"] },
  ...tseslint.configs.recommended,
  {
    files: ["test/**/*.ts"],
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_" },
      ],
    },
  },
);
