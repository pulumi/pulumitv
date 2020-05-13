module.exports = {
    root: true,
    parser: "@typescript-eslint/parser",
    plugins: ["@typescript-eslint"],
    extends: [
        "eslint:recommended",
        "plugin:@typescript-eslint/eslint-recommended",
        "plugin:@typescript-eslint/recommended",
    ],
    rules: {
        "@typescript-eslint/explicit-function-return-type": "warn",
        "@typescript-eslint/camelcase": "warn",
        "@typescript-eslint/no-unused-vars": "error",
    },
};
