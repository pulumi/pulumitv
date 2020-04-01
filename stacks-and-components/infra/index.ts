import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as random from "@pulumi/random";
import * as k8s from "@pulumi/kubernetes";
import * as util from "./util";

const projectName = pulumi.getProject();

// Generate a strong password for the cluster.
const password = new random.RandomPassword(`${projectName}-password`, {
    length: 20,
},{ additionalSecretOutputs: ["result"] }).result;

// Create the GKE cluster.
const cluster = new gcp.container.Cluster(`${projectName}`, {
    initialNodeCount: 1,
    minMasterVersion: "1.15.9-gke.22",
    masterAuth: { username: "example-user", password: password },
});

// Export the kubeconfig and cluster name.
export const kubeconfig = util.createKubeconfig(cluster.name, cluster.endpoint,
    cluster.masterAuth);
export const clusterName = cluster.name;

// Create a k8s provider for the cluster.
const provider = new k8s.Provider(`${projectName}-gke`, {
    kubeconfig: kubeconfig
}, {dependsOn: cluster });

// Create Kubernetes namespaces.
const appsNamespace = new k8s.core.v1.Namespace("apps", undefined, {provider});
export const appsNamespaceName = appsNamespace.metadata.name;
