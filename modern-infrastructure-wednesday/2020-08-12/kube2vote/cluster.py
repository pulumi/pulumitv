import pulumi
from pulumi import ResourceOptions
from pulumi_azure.core import ResourceGroup
from pulumi_azure.containerservice import KubernetesCluster
from pulumi_azuread import Application, ServicePrincipal, ServicePrincipalPassword

# read and set config values
config = pulumi.Config()

PASSWORD = config.require_secret("password")
SSHKEY = config.require("sshkey")

# create a Resource Group and Network for all resources
resource_group = ResourceGroup("miw-aks-rg")

# create Azure AD Application for AKS
app = Application("miw-aks-app")

# create service principal for the application so AKS can act on behalf of the application
sp = ServicePrincipal(
    "miw-aks-app-sp",
    application_id=app.application_id,
)

# create service principal password
sppwd = ServicePrincipalPassword(
    "miw-aks-app-sp-pwd",
    service_principal_id=sp.id,
    end_date="2099-01-01T00:00:00Z",
    value=PASSWORD,
)

aks = KubernetesCluster(
    "miw-aksCluster",
    resource_group_name=resource_group.name,
    kubernetes_version="1.16.13",
    dns_prefix="dns",
    linux_profile={"adminUsername": "aksuser", "ssh_key": {"keyData": SSHKEY}},
    service_principal={"client_id": app.application_id, "client_secret": sppwd.value},
    default_node_pool={
        "name": "type1",
        "node_count": 2,
        "vm_size": "Standard_B2ms",
    },
)
