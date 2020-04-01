import * as k8s from "@pulumi/kubernetes";
import * as gcp from "@pulumi/gcp";
import * as kx from "@pulumi/kubernetesx";
import * as docker from "@pulumi/docker";
import * as pulumi from "@pulumi/pulumi";
import * as random from "@pulumi/random";

export interface DemoAppArgs {
    provider: k8s.Provider,
}

export class DemoApp extends pulumi.ComponentResource {
    public readonly imageName: pulumi.Output<string>;
    public readonly persistentVolumeClaim: kx.PersistentVolumeClaim;
    public readonly configMap: kx.ConfigMap;
    public readonly secret: kx.Secret;
    public readonly deployment: kx.Deployment;
    public readonly service: kx.Service;
    public readonly endpoint: pulumi.Output<string>;
    public readonly url: pulumi.Output<string>;
    constructor(name: string,
        args: DemoAppArgs,
        opts: pulumi.ComponentResourceOptions = {}) {
        super("demo-app", name, args, opts);
        // Get the GCP project registry repository.
        const registry = gcp.container.getRegistryRepository();

        // Build a Docker image from a local Dockerfile context in the
        // './node-app' directory, and push it to the registry.
        const appName = "node-app";
        const appDockerContextPath = `./${appName}`;
        const appImage = new docker.Image(appName, {
            imageName: pulumi.interpolate`${registry.repositoryUrl}/${appName}:v0.0.1`,
            build: {context: appDockerContextPath},
        });
        this.imageName = appImage.imageName;

        // Create a PersistentVolumeClaim.
        this.persistentVolumeClaim = new kx.PersistentVolumeClaim("data", {
            spec: {
                accessModes: [ "ReadWriteOnce" ],
                resources: { requests: { storage: "1Gi" } }
            }
        }, {provider: args.provider});

        // Create a ConfigMap.
        this.configMap = new kx.ConfigMap("cm", {
            data: { "config": "very important data" }
        }, {provider: args.provider});

        // Create a Secret.
        this.secret = new kx.Secret("secret", {
            stringData: {
                "password": new random.RandomPassword("pw", {length: 12}).result,
            }
        }, {provider: args.provider});

        // Define the PodBuilder for the Deployment.
        const pb = new kx.PodBuilder({
            containers: [{
                env: {
                    DATA: this.configMap.asEnvValue("config"),
                    PASSWORD: this.secret.asEnvValue("password"),
                },
                image: this.imageName,
                imagePullPolicy: "Always",
                resources: {requests: {cpu: "50m", memory: "20Mi"}},
                ports: { "http": 80 },
                volumeMounts: [ this.persistentVolumeClaim.mount("/data") ],
            }],
        });

        // Create a Deployment.
        this.deployment = new kx.Deployment("app-kx", {
            spec: pb.asDeploymentSpec(
                {replicas: 2},
            ),
        }, { provider: args.provider });

        // Create a Service.
        this.service = this.deployment.createService({
            type: kx.types.ServiceType.LoadBalancer
        });
        this.url = pulumi.interpolate`http://${this.service.endpoint}`;
    }
}
