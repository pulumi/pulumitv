import * as pulumi from "@pulumi/pulumi";
import * as k8s from "@pulumi/kubernetes";

const platform = new pulumi.StackReference("rawkode/platform/platform");

const kubernetesProvider = new k8s.Provider("k8s", {
  kubeconfig: platform.requireOutput("kubeconfig"),
});

const appLabels = { app: "nginx" };
const deployment = new k8s.apps.v1.Deployment(
  "nginx",
  {
    spec: {
      selector: { matchLabels: appLabels },
      replicas: 1,
      template: {
        metadata: { labels: appLabels },
        spec: { containers: [{ name: "nginx", image: "nginx" }] },
      },
    },
  },
  {
    provider: kubernetesProvider,
  }
);

export const name = deployment.metadata.name;
