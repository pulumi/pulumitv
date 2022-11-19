from pulumi import export as pulumi_export
from pulumi import Output
import app.__main__ as app_code
import infra.__main__ as infra_code

infra = infra_code

kubeconfig = infra_code.cluster_kubeconfig
app_infra = kubeconfig.apply(
    lambda val: app_code.create_app(kubeconfig_val=val)
)

pulumi_export("endpoint_url", Output.unsecret(app_infra))