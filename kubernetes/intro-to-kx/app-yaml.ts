import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";

export interface DemoAppArgs {
    provider: k8s.Provider,
}

export class DemoApp extends pulumi.ComponentResource {
    public readonly url: pulumi.Output<string>;
    constructor(name: string,
        args: DemoAppArgs,
        opts: pulumi.ComponentResourceOptions = {}) {
        super("yaml-demo-app", name, args, opts);

        const app = new k8s.yaml.ConfigFile("app", {
            file: "app.yaml"
        }, {provider: args.provider});

        const status = app.getResourceProperty("v1/Service", "app-yaml", "status");
        const ip = status.apply(s => s.loadBalancer.ingress[0].ip);
        this.url = pulumi.interpolate`http://${ip}`;
    }
}
