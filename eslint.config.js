import antfu from "@antfu/eslint-config";

export default antfu(
  {
    typescript: true,
    // Style preferences applied globally
    stylistic: {
      semi: true,
      quotes: "double",
      indent: 2,
    },
  },
  // Overrides scoped to TypeScript source files only
  {
    files: ["src/**/*.ts"],
    rules: {
      // `import type` for type-only imports (antfu already enables this;
      // override options to add inline-type-imports fixStyle)
      "ts/consistent-type-imports": ["error", {
        prefer: "type-imports",
        fixStyle: "inline-type-imports",
        disallowTypeAnnotations: false,
      }],

      // Disallow `any` — use `unknown` at system boundaries
      "ts/no-explicit-any": "error",

      // No unused variables
      "ts/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      }],

      // Pure functional style — no class declarations
      "no-restricted-syntax": [
        "error",
        { selector: "ClassDeclaration", message: "Use plain functions instead of classes." },
      ],
    },
  },
);
