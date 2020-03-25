import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";
import * as pulumi from "@pulumi/pulumi";

import { projectName, stackName, creator, amiId, instanceCount, instanceType } from "./config";

/**
 * Resources
 */
const baseTags = {
    project: projectName,
    stack: stackName,
    creator: creator,
};

const privateNetwork = "10.0.0.0/16";
const publicNetwork = "0.0.0.0/0";

// create a vpc
const vpc = new awsx.ec2.Vpc(`${projectName}-vpc`, {
    numberOfAvailabilityZones: 1,
    subnets: [{ type: "public" }],
    tags: {
        ...baseTags,
        Name: `${projectName}-vpc`,
    },
});

// create a security group
const webSg = new aws.ec2.SecurityGroup(`${projectName}-sg`, {
    vpcId: vpc.id,
    name: "web-sg",
    ingress: [
        { protocol: "tcp", fromPort: 80, toPort: 80, cidrBlocks: [privateNetwork] },
    ],
    tags: {
        ...baseTags,
        Name: `${projectName}-sg`,
    },
});

for (let i=0; i < instanceCount; i++) {
    const webServer = new aws.ec2.Instance(`${projectName}-server-${i}`, {
        instanceType: instanceType,
        associatePublicIpAddress: false,
        ami: amiId,                     
        subnetId: vpc.publicSubnetIds[0],
        vpcSecurityGroupIds: [webSg.id], 
        tags: {
            ...baseTags,
            Name: `${projectName}-server`,
        },
    });
}
