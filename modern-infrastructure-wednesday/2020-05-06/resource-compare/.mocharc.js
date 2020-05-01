/**
 * Setup test pulumi config
 */
const config = {
    "aws:region": "us-west-2",
    "datalake:awsConfigDataS3TopicArn":
        "arn:aws:sns:us-west-2:123456789012:configDataTopicExample",
    "datalake:awsconfigCatalogDatabase": "configCatalogDatabaseExample",
    "datalake:glueJobOutputBucket": "glueJobOutputBucketExample",
    "datalake:glueJobRoleArn":
        "arn:aws:iam::123456789012:role/glueJobRoleExample",
    "datalake:ingestBucketName": "ingestBucketExample",
    "datalake:ingestTopicArn":
        "arn:aws:sns:us-west-2:123456789012:ingestTopicExample",
    "datalake:jobScriptsBucket": "jobScriptsBucketExample",
    "datalake:pulumiCatalogDatabase": "pulumiCatalogDatabaseExample",
    "datalake:pulumiSecretRole":
        "arn:aws:iam::123456789012:role/secretRoleExample",
    "datalake:pulumiSecretId": "pulumi/secret/token",
    "datalake:iamPermissionsBoundaryArn":
        "arn:aws:iam::123456789012:policy/boundary-policy",
    "datalake:pulumiExtractBucket": "pulumiExtractBucketExample",
    "datalake:pulumiOrganization": "exampleOrg",
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
