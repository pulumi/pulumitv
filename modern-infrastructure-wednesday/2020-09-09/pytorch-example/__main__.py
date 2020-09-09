import json
from time import time
import pulumi
import pulumi_aws
from pulumi_aws import apigateway, lambda_, s3

model_bucket = s3.Bucket("modelBucket")
model_object = s3.BucketObject("model",
    bucket=model_bucket,
    # The model comes from the pretrained model referenced in https://github.com/pytorch/vision/blob/master/torchvision/models/resnet.py
    # Then, converted per https://github.com/pytorch/vision/issues/2068 (see convert.py)
    # It's combined with labels.txt in a tgz.
    source=pulumi.FileAsset("./model.tar.gz"))

instance_assume_role_policy = pulumi_aws.iam.get_policy_document(statements=[{
    "actions": ["sts:AssumeRole"],
    "principals": [{
        "identifiers": ["lambda.amazonaws.com"],
        "type": "Service",
    }],
}])

role = pulumi_aws.iam.Role("classifier-fn-role",
    assume_role_policy=instance_assume_role_policy.json,
    )

policy = pulumi_aws.iam.RolePolicy("classifier-fn-policy",
    role=role,
    policy=pulumi.Output.from_input({
        "Version": "2012-10-17",
        "Statement": [{
            "Action": ["logs:*", "cloudwatch:*"],
            "Resource": "*",
            "Effect": "Allow",
        }, {
            "Action": ["s3:*"],
            "Resource": model_bucket.arn.apply(lambda b: f"{b}/*"),
            "Effect": "Allow",
        }],
    }),
)

lambda_func = lambda_.Function("classifier-fn",
    code=pulumi.AssetArchive({
        ".": pulumi.FileArchive("./app"),
    }),
    role=role.arn,
    timeout=300,
    memory_size=512,
    runtime="python3.6",
    handler="app.lambda_handler",
    layers=["arn:aws:lambda:us-west-2:934676248949:layer:pytorchv1-py36:2"],
    environment={
        "variables": {
            "MODEL_BUCKET": model_bucket.bucket,
            "MODEL_KEY": model_object.key,
        }
    }
)

# The stage name to use for the API Gateway URL
custom_stage_name = "api"

# Create the Swagger spec for a proxy which forwards all HTTP requests through to the Lambda function.
def swagger_spec(lambda_arn):
    swagger_spec_returns = {
        "swagger": "2.0",
        "info": {"title": "api", "version": "1.0"},
        "paths": {
            "/{proxy+}": swagger_route_handler(lambda_arn),
        },
    }
    return json.dumps(swagger_spec_returns)

# Create a single Swagger spec route handler for a Lambda function.
def swagger_route_handler(lambda_arn):
    region = pulumi_aws.config.region
    uri_string = "arn:aws:apigateway:{region}:lambda:path/2015-03-31/functions/{lambdaArn}/invocations".format(
        region=region, lambdaArn=lambda_arn)
    return ({
        "x-amazon-apigateway-any-method": {
            "x-amazon-apigateway-integration": {
                "uri": uri_string,
                "passthroughBehavior": "when_no_match",
                "httpMethod": "POST",
                "type": "aws_proxy",
            },
        },
    })

# Create the API Gateway Rest API, using a swagger spec.
rest_api = apigateway.RestApi("api",
    body=lambda_func.arn.apply(lambda lambda_arn: swagger_spec(lambda_arn)),
    )

# Create a deployment of the Rest API.
deployment = apigateway.Deployment("api-deployment",
    rest_api=rest_api,
    # Note: Set to empty to avoid creating an implicit stage, we'll create it
    # explicitly below instead.
    stage_name="")

# Create a stage, which is an addressable instance of the Rest API. Set it to point at the latest deployment.
stage = apigateway.Stage("api-stage",
    rest_api=rest_api,
    deployment=deployment,
    stage_name=custom_stage_name,
    )

# Give permissions from API Gateway to invoke the Lambda
invoke_permission = lambda_.Permission("api-lambda-permission",
    action="lambda:invokeFunction",
    function=lambda_func,
    principal="apigateway.amazonaws.com",
    source_arn=deployment.execution_arn.apply(
        lambda execution_arn: execution_arn + "*/*"),
    )

# Export the https endpoint of the running Rest API
pulumi.export("endpoint", deployment.invoke_url.apply(lambda url: url + custom_stage_name))
