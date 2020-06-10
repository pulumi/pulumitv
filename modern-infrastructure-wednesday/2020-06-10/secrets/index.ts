import * as k8s from "@pulumi/kubernetes";
import * as random from "@pulumi/random";
import * as pulumi from "@pulumi/pulumi";

const config = new pulumi.Config();

const secret = config.requireSecret("key");

const value = new random.RandomPassword("password", {
    length: 16,
}, { additionalSecretOutputs: ["result"] });

const k8sSecret = new k8s.core.v1.Secret("k8s-secret", {
    stringData: {
        "key": secret
    }
});

export const password = value.result;
export const secretKey = secret;
export const k8sData = k8sSecret.stringData;