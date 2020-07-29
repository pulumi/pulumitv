"""An Azure Python Pulumi program"""

import pulumi
from pulumi_azure import core, containerservice
import pulumi_docker

# Create an Azure Resource Group
resource_group = core.ResourceGroup('miw_20200729')

# Create registry
registry = containerservice.Registry('registry',
    admin_enabled=True,
    sku='Basic',
    resource_group_name=resource_group.name)

# ImageRegistry
r = pulumi.Output.all(registry.login_server,
    registry.admin_username,
    registry.admin_password).apply(
        lambda a: pulumi_docker.ImageRegistry(a[0], a[1], a[2])
    )

# Build and publish image
image = pulumi_docker.Image("my-app",
    image_name=registry.login_server.apply(lambda s: f'{s}/my-app:v1.0.0'),
    build=pulumi_docker.DockerBuild(context='./my-app'),
    registry=r)
    