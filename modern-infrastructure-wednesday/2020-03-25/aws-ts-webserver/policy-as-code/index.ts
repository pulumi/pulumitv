import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import { PolicyPack, ReportViolation, validateTypedResource } from "@pulumi/policy";

const policies = new PolicyPack("ec2", {
    policies: [
        {
            name: "discouraged-ec2-public-ip-address",
            description: "Associating public IP addresses is discouraged.",
            enforcementLevel: "advisory",
            validateResource: validateTypedResource(aws.ec2.Instance, (it, _, reportViolation) => {
                if (it.associatePublicIpAddress !== false) {
                    reportViolation("`associatePublicIpAddresss` should be false");
                }
            }),
        },
        {
            name: "required-tags",
            description: "The folowing tags are required: Name, project, stack.",
            enforcementLevel: "mandatory",
            validateResource: validateTypedResource(aws.ec2.Instance, (it, _, reportViolation) => {
                const tags = it.tags || {};

                const projectName = pulumi.getProject();
                if (tags["project"] !== projectName) {
                    reportViolation(`[project] tag doesn't match [${projectName}]`);
                }

                const stackName = pulumi.getStack();
                if (tags["stack"] !== stackName) {
                    reportViolation(`[stack] tag doesn't match [${stackName}]`);
                }

                if (tags["Name"] === undefined) {
                    reportViolation(`[Name] tag is undefined`);
                }
            }),
        },
        {
            name: "discouraged-public-internet",
            description: "Ingress rules with public internet access are discouraged.",
            enforcementLevel: "advisory",
            validateResource: validateTypedResource(aws.ec2.SecurityGroup, (it, _, reportViolation) => {
                (it.ingress || []).forEach(ingressRule =>
                    (ingressRule.cidrBlocks || []).forEach(cidr => {
                        if ("0.0.0.0/0" === cidr) {
                            reportViolation("`cidr` must not be 0.0.0.0/0")
                        }
                    })
                )
            }),
        },
        {
            name: "prohibited-services-iot",
            description: "Use of IOT services is prohibited.",
            enforcementLevel: "mandatory",
            validateResource: (args, reportViolation) => {
                if (args.type.startsWith("aws:iot")) {
                    reportViolation(`[${args.type}] was found`);
                }
            },
        },
    ],
});
