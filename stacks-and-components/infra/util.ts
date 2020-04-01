import * as gcp from "@pulumi/gcp";
import * as pulumi from "@pulumi/pulumi";

// Manufacture a GKE-style Kubeconfig. Note that this is slightly
// "different" because of the way GKE requires gcloud to be in the
// picture for cluster authentication (rather than using the client
// cert/key directly).
export function createKubeconfig(
    name: pulumi.Output<string>,
    endpoint: pulumi.Output<string>,
    masterAuth: pulumi.Output<gcp.types.output.container.ClusterMasterAuth>,
): pulumi.Output<any> {
    return pulumi.all([
        name, endpoint, masterAuth,
    ]).apply(([projectName, endpoint, auth]) => {
        const context = `${gcp.config.project}_${gcp.config.zone}_${projectName}`;
        return `apiVersion: v1
clusters:
- cluster:
    certificate-authority-data: ${auth.clusterCaCertificate}
    server: https://${endpoint}
  name: ${context}
contexts:
- context:
    cluster: ${context}
    user: ${context}
  name: ${context}
current-context: ${context}
kind: Config
preferences: {}
users:
- name: ${context}
  user:
    auth-provider:
      config:
        cmd-args: config config-helper --format=json
        cmd-path: gcloud
        expiry-key: '{.credential.token_expiry}'
        token-key: '{.credential.access_token}'
      name: gcp
`;
    });
}
