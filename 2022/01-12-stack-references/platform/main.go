package main

import (
	"github.com/pulumi/pulumi-civo/sdk/v2/go/civo"
	"github.com/pulumi/pulumi/sdk/v3/go/pulumi"
)

const REGION = "lon1"

func main() {
	pulumi.Run(func(ctx *pulumi.Context) error {
		network, err := civo.NewNetwork(ctx, "my-network", &civo.NetworkArgs{
			Label:  pulumi.String("my-network"),
			Region: pulumi.String(REGION),
		})
		if err != nil {
			return err
		}

		firewall, err := civo.NewFirewall(ctx, "firewall", &civo.FirewallArgs{
			Name:      pulumi.String("my-firewall"),
			NetworkId: network.ID(),
			Region:    pulumi.String(REGION),
		})
		if err != nil {
			return err
		}

		cluster, err := civo.NewKubernetesCluster(ctx, "civo-k3s-cluster", &civo.KubernetesClusterArgs{
			Name:            pulumi.StringPtr("myFirstCivoCluster"),
			NumTargetNodes:  pulumi.IntPtr(3),
			TargetNodesSize: pulumi.StringPtr("g3.k3s.medium"),
			Region:          pulumi.StringPtr(REGION),
			NetworkId:       network.ID(),
			FirewallId:      firewall.ID(),
		})
		if err != nil {
			return err
		}

		ctx.Export("kubeconfig", cluster.Kubeconfig)

		return nil
	})
}
