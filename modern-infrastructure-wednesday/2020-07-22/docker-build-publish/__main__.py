import base64
from pulumi_aws import ecr
import pulumi_docker as docker
import pulumi

app = 'my-app'

# Create repository
repo = ecr.Repository(app)

def create_image_registry(rid):
    creds = ecr.get_credentials(rid)
    decoded = base64.b64decode(creds.authorization_token).decode('utf-8')
    username, password = decoded.split(':')
    return docker.ImageRegistry(creds.proxy_endpoint, username, password)

# Get credentials and create an ImageRegistry from that
registry = repo.registry_id.apply(lambda rid: create_image_registry(rid))

# Create image
image = docker.Image(app,
    image_name=pulumi.Output.concat(repo.repository_url, ':', '1.0.0'),
    build=docker.DockerBuild(context=f'./{app}'),
    registry=registry)
