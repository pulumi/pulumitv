import * as k8s from "@pulumi/kubernetes";
import * as kx from "@pulumi/kubernetesx";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

export interface DemoAppArgs {
    provider: k8s.Provider,
}

export class DemoApp extends pulumi.ComponentResource {
    public readonly url: pulumi.Output<string>;
    constructor(name: string,
        args: DemoAppArgs,
        opts: pulumi.ComponentResourceOptions = {}) {
        super("kx-demo-app", name, args, opts);

        // Create a ConfigMap.
        const configMap = new kx.ConfigMap("kx-cm", {
            data: { "config": "very important data" }
        }, {provider: args.provider});

        // Create a Secret.
        const secret = new kx.Secret("secret", {
            stringData: {
                "password": new random.RandomPassword("kx-pw", {length: 12}).result,
            }
        }, {provider: args.provider});

        // Create a PersistentVolumeClaim.
        const persistentVolumeClaim = new kx.PersistentVolumeClaim("kx-data", {
            spec: {
                accessModes: [ "ReadWriteOnce" ],
                resources: { requests: { storage: "1Gi" } }
            }
        }, {provider: args.provider});

        // Define the PodBuilder for the Deployment.
        const pb = new kx.PodBuilder({
            containers: [{
                env: {
                    DATA: configMap.asEnvValue("config"),
                    PASSWORD: secret.asEnvValue("password"),
                },
                image: "nginx",
                ports: { "http": 80 },
                volumeMounts: [ persistentVolumeClaim.mount("/data") ],
            }],
        });

        // Create a Deployment.
        const deployment = new kx.Deployment("kx-nginx", {
            spec: pb.asDeploymentSpec({replicas: 1}),
        }, { provider: args.provider });

        // Create a Service.
        const service = deployment.createService({
            type: kx.types.ServiceType.LoadBalancer
        });
        this.url = pulumi.interpolate`http://${service.endpoint}`;
    }
}
