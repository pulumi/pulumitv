import * as k8s from "@pulumi/kubernetes";
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
        super("k8s-demo-app", name, args, opts);

        // Create a ConfigMap.
        const configMap = new k8s.core.v1.ConfigMap("k8s-cm", {
            data: { "config": "very important data" }
        }, {provider: args.provider});

        // Create a Secret.
        const secret = new k8s.core.v1.Secret("k8s-secret", {
            stringData: {
                "password": new random.RandomPassword("k8s-pw", {length: 12}).result,
            }
        }, {provider: args.provider});

        // Create a PersistentVolumeClaim.
        const persistentVolumeClaim = new k8s.core.v1.PersistentVolumeClaim("k8s-data", {
            spec: {
                accessModes: [ "ReadWriteOnce" ],
                resources: { requests: { storage: "1Gi" } }
            }
        }, {provider: args.provider});

        // Create a Deployment of the built container.
        const appLabels = { app: "k8s-nginx" };
        const appDeployment = new k8s.apps.v1.Deployment("k8s-nginx", {
            spec: {
                selector: { matchLabels: appLabels },
                replicas: 1,
                template: {
                    metadata: { labels: appLabels },
                    spec: {
                        containers: [{
                            name: "nginx",
                            image: "nginx",
                            ports: [{name: "http", containerPort: 80}],
                            env: [
                                {
                                    name: "DATA",
                                    valueFrom: {
                                        configMapKeyRef: {
                                            name: configMap.metadata.name,
                                            key: "config"
                                        }
                                    }
                                },
                                {
                                    name: "PASSWORD",
                                    valueFrom: {
                                        secretKeyRef: {
                                            name: secret.metadata.name,
                                            key: "password"
                                        }
                                    }
                                },
                            ],
                            volumeMounts: [
                                {
                                    mountPath: "/data",
                                    name: "data",
                                }
                            ],
                        }],
                        volumes: [
                            {
                                name: "data",
                                persistentVolumeClaim: {
                                    claimName: persistentVolumeClaim.metadata.name,
                                }
                            }
                        ]
                    }
                },
            }
        }, { provider: args.provider });

        // Create a Service.
        const service = new k8s.core.v1.Service("nginx", {
            spec: {
                type: "LoadBalancer",
                ports: [
                    {
                        name: "nginx",
                        port: 80,
                        targetPort: "http"
                    }
                ],
                selector: appLabels,
            }
        }, { provider: args.provider });
        const address = service.status.loadBalancer.ingress[0].ip;
        this.url = pulumi.interpolate`http://${address}`;
    }
}
