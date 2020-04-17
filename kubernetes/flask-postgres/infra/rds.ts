import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as random from "@pulumi/random";

export type RdsDatabaseOptions = {
    privateSubnetIds: pulumi.Input<pulumi.Input<string>[]>;
    securityGroupId: pulumi.Input<string>;
    replicas: pulumi.Input<number>;
    instanceClass: pulumi.Input<string>;
    tags: pulumi.Input<{[key: string]: pulumi.Input<string>}>;
};

const pulumiComponentNamespace: string = "pulumi:RdsDatabase";

export class RdsDatabase extends pulumi.ComponentResource {
    public readonly dbSubnets: aws.rds.SubnetGroup;
    public readonly db: aws.rds.Cluster;
    public readonly password: pulumi.Output<string>;

    constructor(
        name: string,
        args: RdsDatabaseOptions,
        opts?: pulumi.ComponentResourceOptions,
    ) {
        super(pulumiComponentNamespace, name, args, opts);

        // Generate a strong password.
        this.password = new random.RandomPassword(`${name}-password`, {
            length: 16,
            overrideSpecial: "_",
            special: true,
        }, {additionalSecretOutputs: ["result"]}).result;

        this.dbSubnets = new aws.rds.SubnetGroup(`${name}-subnets`, {
            subnetIds: args.privateSubnetIds,    // Same subnets as EKS nodes.
        });

        // Create the RDS PostgreSQL cluster.
        this.db = new aws.rds.Cluster(`${name}-cluster`, {
            databaseName: "pulumi",
            dbSubnetGroupName: this.dbSubnets.id,
            engine: "aurora-postgresql",
            engineVersion: "11.6",
            masterUsername: "pulumi",
            masterPassword: this.password,
            storageEncrypted: true,
            skipFinalSnapshot: true,
            vpcSecurityGroupIds: [args.securityGroupId],         // Must be able to communicate with EKS nodes.
            tags: args.tags,
        });

        // Create the RDS Cluster Instances.
        const instancesToCreate = [];
        for (let i = 0; i < args.replicas; i++) {
            instancesToCreate.push(`databaseInstance-${i}`);
        }
        for (const name of instancesToCreate) {
            let databaseInstance = new aws.rds.ClusterInstance(
                name,
                {
                    clusterIdentifier: this.db.id,
                    engine: "aurora-postgresql",
                    engineVersion: "11.6",
                    instanceClass: args.instanceClass,
                    tags: args.tags,
                },
            );
        }
    }
}
