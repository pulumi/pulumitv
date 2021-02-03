import sys
import json
import pulumi
import base64
from pulumi.x import automation as auto
from pulumi.x.automation.local_workspace import LocalWorkspaceOptions
from pulumi_aws import s3

# This is the pulumi program in "inline function" form
def create_static_website(bucket_name, title, body):
    # Create a bucket and expose a website index document
    site_bucket = s3.Bucket(bucket_name,
        bucket=bucket_name,
        website=s3.BucketWebsiteArgs(index_document="index.html"))
    index_content = f"""
    <html>
        <head>
            <title>{title}</title>
        <meta charset="UTF-8"></head>
        <body>{body}</body>
    </html>
    """
    # Write our index.html into the site bucket
    s3.BucketObject("index",
                    bucket=site_bucket.id,  # reference to the s3.Bucket object
                    content=index_content,
                    key="index.html",  # set the key of the object
                    content_type="text/html; charset=utf-8")  # set the MIME type of the file

    # Set the access policy for the bucket so all objects are readable
    s3.BucketPolicy("bucket-policy", bucket=site_bucket.id, policy={
        "Version": "2012-10-17",
        "Statement": {
            "Effect": "Allow",
            "Principal": "*",
            "Action": ["s3:GetObject"],
            # Policy refers to bucket explicitly
            "Resource": [pulumi.Output.concat("arn:aws:s3:::", site_bucket.id, "/*")]
        },
    })

    # Export the website URL
    pulumi.export("website_url", site_bucket.website_endpoint)

def handler(event, context):
    base64_bytes = event['body'].encode('ascii')
    message_bytes = base64.b64decode(base64_bytes)
    message = message_bytes.decode('ascii')
    json_event = json.loads(message)

    bucket_name = json_event["bucket"]
    site_title = json_event["title"]
    site_body = json_event["body"]
    
    project_name = "website-builder"
    # We use a simple stack name here, but recommend using auto.fully_qualified_stack_name for maximum specificity.
    stack_name = auto.fully_qualified_stack_name("leezen", project_name, bucket_name)

    def pulumi_program():
        create_static_website(bucket_name, site_title, site_body)

    # create or select a stack matching the specified name and project.
    # this will set up a workspace with everything necessary to run our inline program (pulumi_program)
    stack = auto.create_or_select_stack(stack_name=stack_name,
                                        project_name=project_name,
                                        program=pulumi_program,
                                        opts=LocalWorkspaceOptions(
                                            pulumi_home="/tmp/pulumi_home"
                                        ))

    print("successfully initialized stack")

    # for inline programs, we must manage plugins ourselves
    print("installing plugins...")
    stack.workspace.install_plugin("aws", "v3.26.1")
    print("plugins installed")

    # set stack configuration specifying the AWS region to deploy
    print("setting up config")
    stack.set_config("aws:region", auto.ConfigValue(value="us-west-2"))
    print("config set")

    print("updating stack...")
    up_res = stack.up(on_output=print)
    print(f"update summary: \n{json.dumps(up_res.summary.resource_changes, indent=4)}")
    print(f"website url: {up_res.outputs['website_url'].value}")

    return {
        'statusCode': 200,
        'body': json.dumps({
            'url': up_res.outputs['website_url'].value
        }),
    }
