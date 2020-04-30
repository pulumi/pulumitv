import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config("datalake");
const bucketName = config.require("ingestBucketName");

export const ingestLambdaRole = new aws.iam.Role("ingestRole", {
    assumeRolePolicy: {
        Version: "2012-10-17",
        Statement: [{
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: aws.iam.Principals.LambdaPrincipal,
        }]
    }
});

export const ingestLambdaRolePolicy = new aws.iam.RolePolicy("ingestPolicy", {
    role: ingestLambdaRole,
    policy: {
        Version: "2012-10-17",
        Statement: [
            {
                Action: "s3:*",
                Effect: "Allow",
            },
            {
                Action: "SNS:Publish",
                Effect: "Allow",
                Resource: config.require("ingestTopicArn")
            }
        ]
    }
})

//
// Get AWS config dropped off by the broker in a different account.  We
// subscribe to an SNS topic that is alerted whenever new data is ready.
//
export const ingestHandler = async (event: aws.sns.TopicEvent) => {
    const s3 = new aws.sdk.S3();
    const sns = new aws.sdk.SNS();
    // we can safely assume that length of `event.Records` is 1 https://aws.amazon.com/sns/faqs/
    const { Sns } = event.Records[0];
    const bucketRecords = JSON.parse(Sns.Message).Records;

    const regexp = new RegExp(
        "^awsconfig/(?<account>\\d*?)/Config/.*/ConfigSnapshot/.*?\\.json.gz$",
    );

    console.log(`messageRecords.length: ${bucketRecords.length}`);

    // Get a list of promises of all the S3 API requests
    const promises = bucketRecords.map((record: aws.s3.BucketRecord) => {
        const bucket = record.s3.bucket.name;
        const key = record.s3.object.key;

        const match = key.match(regexp);
        if (!match) {
            // If the keyname doesn't match the pattern for the AWS Config keys
            // then skip it
            console.log(`skipping ${key}`);
            return;
        }

        const account = (match as any).groups.account;
        const destinationKey = `awsconfig/${account}/data.json.gz`;

        console.log(
            `Copying ${bucket}/${key} to ${bucketName}/${destinationKey}`,
        );

        return s3
            .copyObject({
                CopySource: `/${bucket}/${key}`,
                Bucket: bucketName,
                Key: destinationKey,
            })
            .promise();
    });

    // Wait for all of the S3 API promises to fulfill
    const results = await Promise.all(promises);

    // Send sns notification if any record resulted in an update.
    const configUpdated = results.some(
        (result: any) =>
            result &&
            result.CopyObjectResult &&
            "ETag" in result.CopyObjectResult,
    );
    if (configUpdated) {
        await sns
            .publish({
                TopicArn: config.require("ingestTopicArn"),
                Message: "AWS config data was updated.",
            })
            .promise();
    }

    return results;
};

export const ingestLambda = new aws.lambda.CallbackFunction(
    "awsconfig-ingest-lambda",
    {
        role: ingestLambdaRole,
        description: "Ingest AWSConfig data",
        runtime: aws.lambda.NodeJS12dXRuntime,
        callback: ingestHandler,
        timeout: 10
    },
);

export const cloudBrokerDataBucketSubscription = new aws.sns.TopicSubscription(
    "cloud-broker-data-s3-event-subscription",
    {
        endpoint: ingestLambda.arn,
        protocol: "lambda",
        topic: config.require("awsConfigDataS3TopicArn"),
    },
);