import * as pulumi from "@pulumi/pulumi";
import * as awsx from "@pulumi/awsx";

export type VpcOptions = {
    name: string;
    tags: {[key: string]: pulumi.Input<string>};
};

export function createVpc(opts: VpcOptions): awsx.ec2.Vpc {
    return new awsx.ec2.Vpc(opts.name,
        {
            cidrBlock: "172.16.0.0/16",
            numberOfAvailabilityZones: "all",
            tags: { "Name": opts.name, ...opts.tags },
        },
        // See https://github.com/pulumi/pulumi-eks/issues/271
        {
            transformations: [(args) => {
                if (args.type === "aws:ec2/vpc:Vpc" || args.type === "aws:ec2/subnet:Subnet") {
                    return {
                        props: args.props,
                        opts: pulumi.mergeOptions(args.opts, { ignoreChanges: ["tags"] })
                    }
                }
                return undefined;
            }],
        },
    );
}
