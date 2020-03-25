import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";

const config = new pulumi.Config();

export const projectName = pulumi.getProject();
export const stackName = pulumi.getStack();

export const creator = config.get("creator") || process.env.USER || "unknown";
export const instanceCount = config.getNumber("instanceCount") ?? 1;
export const instanceType = <aws.ec2.InstanceType>config.require("instanceType");

export const amiId = aws.getAmi({
    owners: ["099720109477"], // Ubuntu
    mostRecent: true,
    filters: [
        { name: "name", values: ["ubuntu/images/hvm-ssd/ubuntu-bionic-18.04-amd64-server-*"] },
    ],
}).id;
