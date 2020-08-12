import pulumi
import pulumi_kubernetes as kubernetes

from cluster import aks

k8s_provider = kubernetes.Provider("aks-k8s-provider", kubeconfig=aks.kube_config_raw)

backend_name = "azure-vote-back"
REDIS_PORT = 6379

azure_vote_back_deployment = kubernetes.apps.v1.Deployment("azure_vote_backDeployment",
    api_version="apps/v1",
    kind="Deployment",
    metadata={
        "name": backend_name,
    },
    spec={
        "replicas": 1,
        "selector": {
            "match_labels": {
                "app": backend_name,
            },
        },
        "template": {
            "metadata": {
                "labels": {
                    "app": backend_name,
                },
            },
            "spec": {
                "node_selector": {
                    "beta.kubernetes.io/os": "linux",
                },
                "containers": [{
                    "name": backend_name,
                    "image": "redis",
                    "ports": [{
                        "container_port": REDIS_PORT,
                        "name": "redis",
                    }],
                }],
            },
        },
    }, opts=pulumi.ResourceOptions(provider=k8s_provider))
azure_vote_back_service = kubernetes.core.v1.Service("azure_vote_backService",
    api_version="v1",
    kind="Service",
    metadata={
        "name": backend_name,
    },
    spec={
        "ports": [{
            "port": REDIS_PORT,
        }],
        "selector": {
            "app": backend_name,
        },
    }, opts=pulumi.ResourceOptions(provider=k8s_provider))
azure_vote_front_deployment = kubernetes.apps.v1.Deployment("azure_vote_frontDeployment",
    api_version="apps/v1",
    kind="Deployment",
    metadata={
        "name": "azure-vote-front",
    },
    spec={
        "replicas": 1,
        "selector": {
            "match_labels": {
                "app": "azure-vote-front",
            },
        },
        "strategy": {
            "rolling_update": {
                "max_surge": 1,
                "max_unavailable": 1,
            },
        },
        "min_ready_seconds": 5,
        "template": {
            "metadata": {
                "labels": {
                    "app": "azure-vote-front",
                },
            },
            "spec": {
                "node_selector": {
                    "beta.kubernetes.io/os": "linux",
                },
                "containers": [{
                    "name": "azure-vote-front",
                    "image": "microsoft/azure-vote-front:v1",
                    "ports": [{
                        "container_port": 80,
                    }],
                    "resources": {
                        "requests": {
                            "cpu": "250m",
                        },
                        "limits": {
                            "cpu": "500m",
                        },
                    },
                    "env": [{
                        "name": "REDIS",
                        "value": "azure-vote-back",
                    }],
                }],
            },
        },
    }, opts=pulumi.ResourceOptions(provider=k8s_provider))
azure_vote_front_service = kubernetes.core.v1.Service("azure_vote_frontService",
    api_version="v1",
    kind="Service",
    metadata={
        "name": "azure-vote-front",
    },
    spec={
        "type": "LoadBalancer",
        "ports": [{
            "port": 80,
        }],
        "selector": {
            "app": "azure-vote-front",
        },
    }, opts=pulumi.ResourceOptions(provider=k8s_provider))

pulumi.export("endpoint", azure_vote_front_service.status)
