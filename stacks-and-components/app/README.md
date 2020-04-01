## Requirements

* [Get Started with Pulumi and GCP][get-started-gcp].
* [Get Started with Pulumi and Kubernetes][get-started-k8s].

## Initialize the Pulumi Project

1.  Clone the repo:

    ```bash
    git clone https://github.com/pulumi/pulumitv
	cd stacks-and-components/app
    ```

1.  Install the dependencies.

    ```bash
    npm install
    ```

1.  Create a new Pulumi [stack][stack] named `dev`.

    ```bash
    pulumi stack init dev
    ```

1. Set the Pulumi [configuration][pulumi-config] variables for the project.

    > **Note:** Select any valid Kubernetes regions for the providers.

    ```bash
    pulumi config set gcp:zone us-west1-a 
    pulumi config set gcp:project <your-gcp-project>
    pulumi config set clusterStackRef myUser/stacks-and-components/dev
    ```

## Run the Update

Create the cluster and deploy the workload by running an update:

```bash
pulumi up
```

The update takes ~15 minutes.

Once the update is complete, verify the cluster, node groups, and Pods are up
and running:

```bash
pulumi stack output kubeconfig > kubeconfig.json
export KUBECONFIG=`pwd`/kubeconfig.json
```

Query the cluster.

```bash
kubectl get nodes -o wide --show-labels
kubectl get pods --all-namespaces -o wide --show-labels
```

## Clean Up

Run the following command to tear down the resources that are part of our
stack.

1. Run `pulumi destroy` to tear down all resources.  You'll be prompted to make
   sure you really want to delete these resources.

   ```bash
   pulumi destroy
   ```

1. To delete the stack, run the following command.

   ```bash
   pulumi stack rm
   ```
   > **Note:** This command deletes all deployment history from the Pulumi
   > Console and cannot be undone.

[stack]: https://www.pulumi.com/docs/reference/stack.md
[pulumi-config]: https://www.pulumi.com/docs/reference/config
[get-started-gcp]: https://www.pulumi.com/docs/get-started/gcp/
[get-started-k8s]: https://www.pulumi.com/docs/get-started/kubernetes/
