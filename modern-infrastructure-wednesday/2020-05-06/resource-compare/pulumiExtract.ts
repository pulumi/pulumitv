import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

import * as helpers from "./helpers";

//
// Get pulumi stack information from the API
//

const config = new pulumi.Config("datalake");
const organization = config.require("pulumiOrganization");

export const pulumiTags = {
    DataSource: "pulumi",
};

/**
 * Generate IAM policy for use by the pulumi extract Lambda function. This
 * allows a role to access CloudWatch resources.
 */
export const pulumiExtractLambdaRolePolicyStatements: (
    o: string,
) => aws.iam.PolicyStatement[] = bucketArn => [
    {
        Action: [
            "logs:CreateLogGroup",
            "logs:CreateLogStream",
            "logs:PutLogEvents",
        ],
        Effect: "Allow" as const,
        Resource: "*",
    },
    {
        Action: "sts:AssumeRole",
        Effect: "Allow" as const,
        Resource:
            "arn:aws:iam::123456789012:role/pulumi-extract-lambda-cross-account-role",
    },
    {
        Action: [
            "s3:ListBucket",
            "s3:GetObject",
            "s3:PutObject",
            "s3:PutObjectTagging",
        ],
        Effect: "Allow" as const,
        Resource: [bucketArn, `${bucketArn}/pulumi`, `${bucketArn}/pulumi/*`],
    },
];

/**
 * Create a topic to notify interested transform jobs of extract completion.
 */
export const pulumiExtractTopic = new aws.sns.Topic("pulumi-extract-topic", {
    name: "pulumi-extract",
    displayName: "pulumi-extract",
    tags: pulumiTags,
});

/**
 * Allow pulumi extract Lambda to use this role.
 */
export const pulumiExtractLambdaRole = new aws.iam.Role(
    "pulumi-extract-lambda-role",
    {
        name: "pulumi-extract-lambda-role",
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
            Service: "lambda.amazonaws.com",
        }),
        permissionsBoundary: config.require("iamPermissionsBoundaryArn"),
        tags: pulumiTags,
    },
);

/**
 * Attach policy to pulumi extract Lambda
 */
export const pulumiExtractLambdaRolePolicy = new aws.iam.Policy(
    "pulumi-extract-lambda-role-policy",
    {
        policy: helpers.makePolicyDocument(pulumiExtractLambdaRolePolicyStatements(config.require("pulumiExtractBucket")))
    },
);

export const pulumiExtractLambdaRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
    "pulumi-extract-lambda-role-policy-attachment",
    {
        policyArn: pulumiExtractLambdaRolePolicy.arn,
        role: pulumiExtractLambdaRole.name,
    },
);

/**
 * Query the pulumi API for a list of all stacks and their metadata
 * (specifically last update times).
 */
export const pulumiGetStackMetadataLambdaCallback = async () => {
    const response = await helpers.pulumiHttpGet(
        "https://api.pulumi.com/api/user/stacks",
    );

    return response.data.stacks.filter(
        (stack: any) => stack.orgName == organization,
    );
};

export const pulumiGetStackMetadataLambda = new aws.lambda.CallbackFunction(
    "pulumi-get-stack-metadata-lambda",
    {
        role: pulumiExtractLambdaRole,
        description: "Query pulumi API for stack metadata",
        runtime: aws.lambda.NodeJS12dXRuntime,
        callback: pulumiGetStackMetadataLambdaCallback,
        timeout: 10,
        tags: pulumiTags,
    },
);

/*
 * Compare latest pulumi stack update against S3 data to determine if
 * an update is needed.
 */
export const pulumiNeedS3UpdateLambdaCallback = async (params: any) => {
    const stackMetadata = params.Input;
    const bucket = config.require("pulumiExtractBucket");

    // Generate a path of the form:
    // pulumi/org-local/project-local/stack-local/stack.json
    const makePartitionedPath = (): string =>
        [
            "pulumi",
            stackMetadata.orgName,
            stackMetadata.projectName,
            stackMetadata.stackName,
            "stack.json",
        ].join("/");

    // Do not update if no update data exists
    if (!("lastUpdate" in stackMetadata)) {
        stackMetadata.needsUpdate = false;
        return stackMetadata;
    }

    // Store destination bucket
    stackMetadata.bucket = bucket;
    // Determine the proper partitioned path to review
    stackMetadata.path = makePartitionedPath();

    // Get the timestamp of the last updated object.
    let currentStackExport;
    try {
        const s3 = new aws.sdk.S3();
        currentStackExport = await s3
            .getObject({
                Bucket: bucket,
                Key: stackMetadata.path,
            })
            .promise();
    } catch (e) {
        // If we can't find the object, we need to update it.
        if (e.name == "NoSuchKey") {
            stackMetadata.needsUpdate = true;
            return stackMetadata;
        } else {
            throw e;
        }
    }

    const timestamp = JSON.parse(currentStackExport.Body as string).deployment
        .manifest.time;
    // Stack metadata reports in seconds since epoch. The timestamp
    // within the stack export reports in human-readable time to the
    // microsecond.
    const lastS3Update = Date.parse(timestamp) / 1000;

    // Update if timestamps don't match
    //
    // Pulumi's lastUpdate field in the stack metadata is inconsistent
    // in its use of rounding/truncating the sub-second portions of
    // the timestamp. To approximate "matching" timestamps, we look
    // for times within 1 sec of each other. Neither rounding, nor
    // flooring/ceiling-ing work in all cases.
    stackMetadata.needsUpdate =
        Math.abs(lastS3Update - parseFloat(stackMetadata.lastUpdate)) > 1;

    return stackMetadata;
};

export const pulumiNeedS3UpdateLambda = new aws.lambda.CallbackFunction(
    "pulumi-need-s3-update-lambda",
    {
        role: pulumiExtractLambdaRole,
        description: "Compare pulumi stack update against S3 data",
        runtime: aws.lambda.NodeJS12dXRuntime,
        callback: pulumiNeedS3UpdateLambdaCallback,
        codePathOptions: {
            extraExcludePackages: ["pulumi-lib-aws"],
        },
        timeout: 10,
        tags: pulumiTags,
    },
);

/**
 * Download a new stack export from pulumi into S3.
 */
export const pulumiExtractLambdaCallback = async (params: any) => {
    const extractMetadata = params.Input;

    const url = [
        "https://api.pulumi.com/api/stacks",
        extractMetadata.orgName,
        extractMetadata.projectName,
        extractMetadata.stackName,
        "export",
    ].join("/");

    const response = await helpers.pulumiHttpGet(url);

    const body = JSON.stringify(response.data);

    const s3 = new aws.sdk.S3();
    return await s3
        .putObject({
            Body: body,
            Bucket: extractMetadata.bucket,
            Key: extractMetadata.path,
        })
        .promise();
};

export const pulumiExtractLambda = new aws.lambda.CallbackFunction(
    "pulumi-extract-lambda",
    {
        role: pulumiExtractLambdaRole,
        description: "Extract pulumi stack data",
        runtime: aws.lambda.NodeJS12dXRuntime,
        callback: pulumiExtractLambdaCallback,
        codePathOptions: {
            extraExcludePackages: ["pulumi-lib-aws"],
        },
        timeout: 10,
        tags: pulumiTags,
    },
);

/*
 * Return true if at least one stack was updated.
 */
export const pulumiCheckStacksUpdatedLambdaCallback = async (params: any) => {
    return params.Input.some((stack: any) => "ETag" in stack);
};

export const pulumiCheckStacksUpdatedLambda = new aws.lambda.CallbackFunction(
    "pulumi-check-stacks-updated-lambda",
    {
        role: pulumiExtractLambdaRole,
        description: "Determine if any stacks were updated in this run",
        runtime: aws.lambda.NodeJS12dXRuntime,
        callback: pulumiCheckStacksUpdatedLambdaCallback,
        codePathOptions: {
            extraExcludePackages: ["pulumi-lib-aws"],
        },
        timeout: 10,
        tags: pulumiTags,
    },
);

/**
 * Generate IAM policy for use by the pulumi extract step function. This
 * allows a role to execute specific lambda resources.
 */
export const pulumiExtractStepRolePolicyStatements = (
    topicArn: string,
    lambdaArns: string[],
): aws.iam.PolicyStatement[] => [
    {
        Action: ["lambda:InvokeFunction"],
        Effect: "Allow",
        Resource: lambdaArns,
    },
    {
        Action: ["sns:Publish"],
        Effect: "Allow" as const,
        Resource: topicArn,
    },
];

/**
 * Allow pulumi extract step function to use this role.
 */
export const pulumiExtractStepRole = new aws.iam.Role(
    "pulumi-extract-step-role",
    {
        name: "pulumi-extract-step-role",
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
            Service: `states.${aws.config.region}.amazonaws.com`,
        }),
        permissionsBoundary: config.require("iamPermissionsBoundaryArn"),
        tags: pulumiTags,
    },
);

/**
 * Attach policy to pulumi extract step function
 */
export const pulumiExtractStepRolePolicy = new aws.iam.Policy(
    "pulumi-extract-step-role-policy",
    {
        policy: helpers.makePolicyDocument(
            pulumi
                .all([
                    pulumiExtractTopic.arn,
                    pulumiGetStackMetadataLambda.arn,
                    pulumiNeedS3UpdateLambda.arn,
                    pulumiExtractLambda.arn,
                    pulumiCheckStacksUpdatedLambda.arn,
                ])
                .apply(([topic, ...arns]) =>
                    pulumiExtractStepRolePolicyStatements(topic, arns),
                ),
        ),
    },
);

export const pulumiExtractStepRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
    "pulumi-extract-step-role-policy-attachment",
    {
        policyArn: pulumiExtractStepRolePolicy.arn,
        role: pulumiExtractStepRole.name,
    },
);

/**
 * Define a single-stack state function
 */
export const pulumiExtractStepStackDefinition = (
    pulumiExtractTopicArn: string,
    pulumiGetStackMetadataLambdaArn: string,
    pulumiNeedS3UpdateLambdaArn: string,
    pulumiExtractLambdaArn: string,
    pulumiCheckStacksUpdatedLambdaArn: string,
) => ({
    StartAt: "GetStackUpdate",
    States: {
        GetStackUpdate: {
            Type: "Task",
            Resource: "arn:aws:states:::lambda:invoke",
            OutputPath: "$.Payload",
            Parameters: {
                FunctionName: pulumiGetStackMetadataLambdaArn,
                Payload: {
                    "Input.$": "$",
                },
            },
            Next: "GetStacks",
        },
        GetStacks: {
            Type: "Map",
            Iterator: {
                StartAt: "CheckS3Update",
                States: {
                    CheckS3Update: {
                        Type: "Task",
                        Resource: "arn:aws:states:::lambda:invoke",
                        ResultPath: "$",
                        OutputPath: "$.Payload",
                        Parameters: {
                            FunctionName: pulumiNeedS3UpdateLambdaArn,
                            Payload: {
                                "Input.$": "$",
                            },
                        },
                        Next: "NeedS3Update",
                    },
                    NeedS3Update: {
                        Type: "Choice",
                        Choices: [
                            {
                                Variable: "$.needsUpdate",
                                BooleanEquals: false,
                                Next: "StackUpdated",
                            },
                        ],
                        Default: "GetStack",
                    },
                    GetStack: {
                        Type: "Task",
                        Resource: "arn:aws:states:::lambda:invoke",
                        ResultPath: "$",
                        OutputPath: "$.Payload",
                        Parameters: {
                            FunctionName: pulumiExtractLambdaArn,
                            Payload: {
                                "Input.$": "$",
                            },
                        },
                        Next: "StackUpdated",
                    },
                    StackUpdated: {
                        Type: "Succeed",
                    },
                },
            },
            Next: "CheckStacksUpdated",
        },
        CheckStacksUpdated: {
            Type: "Task",
            Resource: "arn:aws:states:::lambda:invoke",
            ResultPath: "$",
            OutputPath: "$.Payload",
            Parameters: {
                FunctionName: pulumiCheckStacksUpdatedLambdaArn,
                Payload: {
                    "Input.$": "$",
                },
            },
            Next: "NeedNotification",
        },
        NeedNotification: {
            Type: "Choice",
            Choices: [
                {
                    Variable: "$",
                    BooleanEquals: true,
                    Next: "Notify",
                },
            ],
            Default: "DoNotNotify",
        },
        Notify: {
            Type: "Task",
            Resource: "arn:aws:states:::sns:publish",
            Parameters: {
                TopicArn: pulumiExtractTopicArn,
                Message: "At least one pulumi stack export was updated.",
            },
            End: true,
        },
        DoNotNotify: {
            Type: "Succeed",
        },
    },
});

export const pulumiExtractStepStack = new aws.sfn.StateMachine(
    "pulumi-extract-step-stack",
    {
        definition: pulumi
            .all([
                pulumiExtractTopic.arn,
                pulumiGetStackMetadataLambda.arn,
                pulumiNeedS3UpdateLambda.arn,
                pulumiExtractLambda.arn,
                pulumiCheckStacksUpdatedLambda.arn,
            ])
            .apply(arns =>
                JSON.stringify(pulumiExtractStepStackDefinition(...arns)),
            ),
        roleArn: pulumiExtractStepRole.arn,
        tags: pulumiTags,
    },
);

/**
 * Generate IAM policy for use by the pulumi extract cloudwatch event
 * scheduler. This allows a role to execute specific step function
 * resources.
 */
export const pulumiExtractCloudwatchRolePolicyStatements = (
    stepFunction: string,
): aws.iam.PolicyStatement[] => [
    {
        Action: ["states:StartExecution"],
        Effect: "Allow",
        Resource: stepFunction,
    },
];

/**
 * Allow pulumi extract cloudwatch event to use this role.
 */
export const pulumiExtractCloudwatchRole = new aws.iam.Role(
    "pulumi-extract-cloudwatch-role",
    {
        name: "pulumi-extract-cloudwatch-role",
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
            Service: "events.amazonaws.com",
        }),
        permissionsBoundary: config.require("iamPermissionsBoundaryArn"),
        tags: pulumiTags,
    },
);

/**
 * Attach policy to pulumi extract cloudwatch event
 */
export const pulumiExtractCloudwatchRolePolicy = new aws.iam.Policy(
    "pulumi-extract-cloudwatch-role-policy",
    {
        policy: helpers.makePolicyDocument(
            pulumiExtractStepStack.id.apply(
                pulumiExtractCloudwatchRolePolicyStatements,
            ),
        ),
    },
);

export const pulumiExtractCloudwatchRolePolicyAttachment = new aws.iam.RolePolicyAttachment(
    "pulumi-extract-cloudwatch-role-policy-attachment",
    {
        policyArn: pulumiExtractCloudwatchRolePolicy.arn,
        role: pulumiExtractCloudwatchRole.name,
    },
);

/**
 * Create an event rule that fires on a schedule for triggering the step function
 */
export const pulumiExtractCloudwatchEventRule = new aws.cloudwatch.EventRule(
    "pulumi-extract-cloudwatch-event-rule",
    {
        name: "pulumi-extract-cloudwatch-event-rule",
        description: "Run Pulumi stack updates daily",
        scheduleExpression: "rate(1 day)",
        tags: pulumiTags,
    },
);

export const pulumiExtractCloudwatchEventTarget = new aws.cloudwatch.EventTarget(
    "pulumi-extract-cloudwatch-event-target",
    {
        arn: pulumiExtractStepStack.id,
        roleArn: pulumiExtractCloudwatchRole.arn,
        rule: pulumiExtractCloudwatchEventRule.name,
    },
);