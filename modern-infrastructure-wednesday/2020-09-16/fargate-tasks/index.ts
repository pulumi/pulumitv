import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const vpc = new awsx.ec2.Vpc("vpc", {});
const cluster = new awsx.ecs.Cluster("cluster", { vpc });

const task = new awsx.ecs.FargateTaskDefinition("counterTask", {
    containers: {
        counter: {
            memory: 128,
            image: awsx.ecs.Image.fromFunction(() => {
                const rand = Math.random();
                console.log(`Random: ${rand}`);
            }),
        },
    },
});

const callback = new aws.lambda.CallbackFunction("taskCallback", {
    policies: [
        aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
        aws.iam.ManagedPolicies.AmazonEC2ContainerServiceFullAccess,
    ],
    callback: (ev: aws.cloudwatch.EventRuleEvent | aws.s3.BucketEvent) => {
        console.log("Running task...");
        if ((ev as aws.cloudwatch.EventRuleEvent).detail) {
            console.log("ScheduledEvent");
        } else if ((ev as aws.s3.BucketEvent).Records) {
            console.log("BucketEvent");
        } else {
            console.log("Unknown event");
        }

        task.run({
            cluster,
            count: 3,
        });
        
        console.log("Done");
    }
});

aws.cloudwatch.onSchedule("scheduleRun", "rate(1 minute)", callback);

const bucket = new aws.s3.Bucket("taskBucket");

bucket.onObjectCreated("objectCreated", callback);

export const bucketName = bucket.id;