import * as pulumi from "@pulumi/pulumi";
import * as eks from "@pulumi/eks";
import * as k8s from "@pulumi/kubernetes";
import { FluentdCloudWatch } from "./fluentd-cloudwatch";

const projectName = pulumi.getProject();

// Create the EKS cluster.
const cluster = new eks.Cluster(`${projectName}`, {
    deployDashboard: false,
    createOidcProvider: true,
});

// Export the kubeconfig.
export const kubeconfig = cluster.kubeconfig;

// Geet the cluster OIDC provider URL.
if (!cluster?.core?.oidcProvider) {
    throw new Error("Invalid cluster OIDC provider URL");
}
const clusterOidcProvider = cluster.core.oidcProvider;
const clusterOidcProviderArn = clusterOidcProvider.arn;
const clusterOidcProviderUrl = clusterOidcProvider.url;

// Deploy fluentd-cloudwatch Helm chart with pod IAM.
const fluentd = new FluentdCloudWatch("fluentd-cloudwatch", {
    provider: cluster.provider,
    namespace: "kube-system",
    clusterOidcProviderArn: clusterOidcProviderArn,
    clusterOidcProviderUrl: clusterOidcProviderUrl,
});
export const fluentdCloudWatchLogGroupName = fluentd.logGroupName;
