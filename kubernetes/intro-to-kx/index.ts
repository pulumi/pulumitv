import * as k8s from "@pulumi/kubernetes";
import * as pulumi from "@pulumi/pulumi";
import * as yamlApp from "./app-yaml";
import * as k8sApp from "./app-k8s";
import * as kxApp from "./app-kx";
import {config} from "./config";

// Create a k8s provider for the k8s cluster.
const provider = new k8s.Provider("provider", {
    kubeconfig: config.kubeconfig,
    namespace: config.appsNamespaceName,
});

// Create the application on the cluster using a YAML manifest.
export const yamlAppUrl = new yamlApp.DemoApp("yamlApp", {provider});

// Create the application on the cluster using k8s.
export const k8sAppUrl = new k8sApp.DemoApp("k8sApp", {provider});

// Create the application on the cluster using kx.
export const kxAppUrl = new kxApp.DemoApp("kxApp", {provider});
