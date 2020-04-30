import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

export * as configIngest from "./configIngest";
export * as extract from "./pulumiExtract";

const config = new pulumi.Config("datalake");

//
//  Job to compare awsconfig data to pulumi data
//
const scriptLocation: (o: aws.s3.BucketObject) => pulumi.Output<string> = (
    bucketObject: aws.s3.BucketObject,
) => {
    return pulumi.interpolate`s3://${bucketObject.bucket}/${bucketObject.key}`;
};

/**
 * Upload the System Component Inventory script to the job scripts bucket.
 */
export const systemComponentInventoryScriptBucketObject = new aws.s3.BucketObject(
    "system-component-inventory-script-bucket-object",
    {
        bucket: config.require("jobScriptsBucket"),
        key: "component_inventory.py",
        source: new pulumi.asset.FileAsset(
            "jobs/component_inventory.py",
        )
    },
);

/**
 * System Component Inventory
 *
 * - Pull data in from awsconfig and pulumi extracts.
 * - Join AWS resource data and mark resources not managed by Pulumi
 * - Write results to ready/system-component-inventory/resources
 */
export const systemComponentInventoryJob = new aws.glue.Job(
    "system-component-inventory-job",
    {
        command: {
            pythonVersion: "3",
            scriptLocation: scriptLocation(
                systemComponentInventoryScriptBucketObject,
            ),
        },
        defaultArguments: {
            "--awsconfig-database-name": config.require("awsconfigCatalogDatabase"),
            "--pulumi-database-name": config.require("pulumiCatalogDatabase"),
            "--aws-region": aws.config.region,
            "--output-bucket": config.require("glueJobOutputBucket"),
            "--output-directory": "system-component-inventory/resources",
        },
        glueVersion: "1.0",
        roleArn: config.require("glueJobRoleArn"),
        maxCapacity: 2, // 2 is the lowest number of DPUs we can assign to a glueetl job
    },
);

