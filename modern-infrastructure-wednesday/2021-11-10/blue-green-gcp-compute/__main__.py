import pulumi
from pulumi_gcp import compute

# A simple bash script that will run when the webserver is initialized
startup_script = """#!/bin/bash
echo "Hello, World!" > index.html
nohup python3 -m http.server 80 &"""  # SimpleHTTPServer is now part of http.server for Python 3.x

compute_image = compute.get_image(
    family="debian-11",
    project="debian-cloud"
)

compute_network = compute.Network(
    "laura-network",
    auto_create_subnetworks=False
)

compute_subnet = compute.Subnetwork(
    "laura-subnet",
    ip_cidr_range="10.0.1.0/24",
    region="us-central1",
    network=compute_network.id
)

compute_global_address = compute.GlobalAddress(
    "laura-address"
)

compute_firewall = compute.Firewall(
    "laura-firewall",
    direction="INGRESS",
    network=compute_network.id,
    source_ranges=["130.211.0.0/22", "35.191.0.0/16"],
    allows=[
        compute.FirewallAllowArgs(
            protocol="tcp",
            ports=["80"]
        )
    ],
    target_tags=["allow-health-check"]
)

compute_health_check = compute.HealthCheck(
    "laura-compute-health",
    http_health_check=compute.HealthCheckHttpHealthCheckArgs(
        port_specification="USE_SERVING_PORT"
    ))

compute_instance_template = compute.InstanceTemplate(
    "laura-instance",
    machine_type="f1-micro",
    metadata_startup_script=startup_script,
    disks=[compute.InstanceTemplateDiskArgs(
        source_image=compute_image.self_link,
        auto_delete=True,
        boot=True
    )],
    network_interfaces=[compute.InstanceTemplateNetworkInterfaceArgs(
        network=compute_network.id,
        subnetwork=compute_subnet.id,
    )],
    tags=[
        "allow-health-check"
    ]
)

compute_group_manager = compute.InstanceGroupManager(
    "laura-group-manager",
    zone="us-central1-c",
    versions=[compute.InstanceGroupManagerVersionArgs(
        instance_template=compute_instance_template.id,
        name="primary",
    )],
    named_ports=[compute.InstanceGroupManagerNamedPortArgs(
        name="http",
        port=80
    )],
    update_policy=compute.InstanceGroupManagerUpdatePolicyArgs(
        minimal_action="RESTART",
        type="PROACTIVE",
        max_unavailable_fixed=2
    ),
    base_instance_name="vm",
    target_size=3,
)

compute_backend_service = compute.BackendService(
    "laura-backend-service",
    load_balancing_scheme="EXTERNAL",
    backends=[
        compute.BackendServiceBackendArgs(
            group=compute_group_manager.instance_group,
            balancing_mode="UTILIZATION",
            capacity_scaler=1.0
        )
    ],
    port_name="http",
    protocol="HTTP",
    timeout_sec=10,
    health_checks=compute_health_check.id
)

compute_url_map = compute.URLMap(
    "laura-map",
    default_service=compute_backend_service.id,
)

compute_proxy = compute.TargetHttpProxy(
    "laura-target-proxy",
    url_map=compute_url_map.id
)

compute_forwarding_rule = compute.GlobalForwardingRule(
    "laura-forward",
    ip_protocol="TCP",
    load_balancing_scheme="EXTERNAL",
    port_range=80,
    target=compute_proxy.id,
    ip_address=compute_global_address.id
)

pulumi.export("instanceName", compute_group_manager.name)
pulumi.export("instanceIP", compute_global_address.address)
