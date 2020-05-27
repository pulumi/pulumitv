import * as aws from "@pulumi/aws";

// Create an AWS resource (S3 Bucket)
const bucket = new aws.s3.Bucket("my-bucket");

// Create a bucket object
const bucketObject = new aws.s3.BucketObject("my-bucket-object", {
    bucket: bucket.bucket,
    content: "hello world"
});

// Export the name of the bucket
export const bucketName = bucket.id;
