import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const config = new pulumi.Config();

const image = awsx.ecr.buildAndPushImage("builder-app", {
    context: "./app",
});

const role = new aws.iam.Role("builder-role", {
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal(aws.iam.Principals.LambdaPrincipal),
});

const executeAttachment = new aws.iam.RolePolicyAttachment("lambda-execute", {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AWSLambdaBasicExecutionRole,
});

const s3Attachment = new aws.iam.RolePolicyAttachment("s3-full-access", {
    role: role.name,
    policyArn: aws.iam.ManagedPolicy.AmazonS3FullAccess,
});

const builder = new aws.lambda.Function("builder-func", {
    imageUri: image.imageValue,
    role: role.arn,
    memorySize: 1024,
    timeout: 300,
    packageType: "Image",
    environment: {
        variables: {
            PULUMI_ACCESS_TOKEN: config.requireSecret("pulumiAccessToken"),
        },
    },
});

const api = new awsx.apigateway.API("website-builder", {
    routes: [{
        path: "/builder",
        method: "POST",
        eventHandler: builder,
    }],
});

export const imageUri = image.imageValue;
export const apiEndpoint = api.url;
