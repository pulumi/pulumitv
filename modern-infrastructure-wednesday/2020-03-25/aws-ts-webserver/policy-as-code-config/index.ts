import * as aws from "@pulumi/aws";
import { PolicyPack, validateResourceOfType } from "@pulumi/policy";

new PolicyPack("ec2-config", {
    policies: [
        {
            name: "allowed-instance-classes",
            description: "Check for allowed instance classes.",
            enforcementLevel: "mandatory",
            configSchema: {
                properties: {
                    allowedInstanceClasses: {
                        type: "array",
                        items: {
                            type: "string",
                        },
                    },
                },
            },
            validateResource: validateResourceOfType(aws.ec2.Instance, (it, args, reportViolation) => {
                const { allowedInstanceClasses } = args.getConfig<{ allowedInstanceClasses: string[] }>();
                const instanceClass = it.instanceType.substring(0, it.instanceType.indexOf("."));
                if (allowedInstanceClasses.indexOf(instanceClass) === -1) {
                    reportViolation(`Instance type [${it.instanceType}] is not of allowed instance classes [${allowedInstanceClasses}].`);
                }
            }),
        },
        {
            name: "maximum-instance-count",
            description: "Check for maximum instance count.",
            enforcementLevel: "mandatory",
            configSchema: {
                properties: {
                    maximumInstanceCount: {
                        type: "integer",
                        default: 5,
                    },
                },
            },
            validateStack: (args, reportViolation) => {
                const { maximumInstanceCount } = args.getConfig<{ maximumInstanceCount: number }>();
                const instances = args.resources.filter(it => it.isType(aws.ec2.Instance))
                if (instances.length > maximumInstanceCount) {
                    reportViolation(`Number of instances [${instances.length}] exceeds allowed number [${maximumInstanceCount}].`);
                }
            },
        },
    ],
});
