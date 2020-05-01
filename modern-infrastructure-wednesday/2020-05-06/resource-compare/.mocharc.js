/**
 * Setup test pulumi config
 */
const config = {
    "aws:region": "us-west-2",
};

/**
 * Set environment variables to put pulumi in test mode.
 */
process.env.PULUMI_NODEJS_PROJECT = "test-project";
process.env.PULUMI_NODEJS_STACK = "local";
process.env.PULUMI_CONFIG = JSON.stringify(config);
process.env.PULUMI_TEST_MODE = "true";

/**
 * Mocha config
 */
module.exports = {
    require: "ts-node/register",
    extension: ["ts"],
    "watch-extensions": ["ts"],
    recursive: true,
    timeout: 18000,
    file: ["test-setup.ts"],
};
