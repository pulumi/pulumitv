import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as gcp from "@pulumi/gcp";
import * as app from "./app";
import {config} from "./config";

export const kubeconfig = config.gkeKubeconfig;
export const appsNamespaceName = config.appsNamespaceName;

// Create a k8s provider for the remote GKE cluster.
const gkeProvider = new k8s.Provider("gkeProvider", {
    kubeconfig: config.gkeKubeconfig,
    namespace: config.appsNamespaceName,
});

// Create the application on the cluster.
const instance = new app.DemoApp("demo", {
    provider: gkeProvider,
});

export const instanceUrl = instance.url;
