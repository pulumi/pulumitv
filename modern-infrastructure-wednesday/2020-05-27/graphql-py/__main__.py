import pulumi
from pulumi import asset
from pulumi_gcp import storage, cloudfunctions

# Create a GCP resource (Storage Bucket)
bucket = storage.Bucket('my-bucket')

# Create the function source asset
api_bucket_object = storage.BucketObject('api-zip',
    bucket=bucket.name,
    source=pulumi.AssetArchive({
        '.': asset.FileArchive('./api')
    }))

api_function = cloudfunctions.Function('api-func',
    source_archive_bucket=bucket.name,
    source_archive_object=api_bucket_object.name,
    runtime='nodejs10',
    entry_point='handler',
    trigger_http='true',
    available_memory_mb=128)

api_invoker = cloudfunctions.FunctionIamMember('api-invoker',
    project=api_function.project,
    region=api_function.region,
    cloud_function=api_function.name,
    role='roles/cloudfunctions.invoker',
    member='allUsers')

pulumi.export('endpoint', api_function.https_trigger_url)
