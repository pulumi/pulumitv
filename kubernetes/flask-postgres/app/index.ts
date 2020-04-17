import * as k8s from "@pulumi/kubernetes";
import * as app from "./app";
import {config} from "./config";

// Create a k8s provider for the cluster.
const provider = new k8s.Provider("k8sProvider", {
    kubeconfig: config.kubeconfig,
});

// Create the application on the cluster.
const instance = new app.DemoApp("demo", {
    provider,
    imageName: "metral/flask-postgres:v0.0.1",
});
export const instanceUrl = instance.url;
