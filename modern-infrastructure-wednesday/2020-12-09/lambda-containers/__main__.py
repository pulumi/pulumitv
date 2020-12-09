import pulumi
import pulumi_aws as aws
import pulumi_docker as docker

bucket = aws.s3.Bucket("bucket")

repo = aws.ecr.Repository("sampleapp")
ecr_creds = aws.ecr.get_authorization_token()

image = docker.Image("sampleapp",
    build="./build-ffmpeg",
    image_name=repo.repository_url,
    registry=docker.ImageRegistry(server=repo.repository_url, username=ecr_creds.user_name, password=ecr_creds.password))

role = aws.iam.Role("thumbnailerRole", assume_role_policy=f"""{{
  "Version": "2012-10-17",
  "Statement": [
    {{
      "Effect": "Allow",
      "Principal": {{ "Service": "lambda.amazonaws.com" }},
      "Action": "sts:AssumeRole"
    }}
  ]
}}""")

aws.iam.RolePolicyAttachment("lambdaFullAccess", role=role.name, policy_arn=aws.iam.ManagedPolicy.AWS_LAMBDA_FULL_ACCESS)

thumbnailer = aws.lambda_.Function("thumbnailer", package_type="Image", image_uri=image.image_name, role=role.arn, timeout=60);

allow_bucket = aws.lambda_.Permission("allowBucket",
    action="lambda:InvokeFunction",
    function=thumbnailer.arn,
    principal="s3.amazonaws.com",
    source_arn=bucket.arn)

bucket_notification = aws.s3.BucketNotification("bucketNotification",
    bucket=bucket.id,
    lambda_functions=[aws.s3.BucketNotificationLambdaFunctionArgs(
        lambda_function_arn=thumbnailer.arn,
        events=["s3:ObjectCreated:*"],
        filter_suffix=".mp4",
    )],
    opts=pulumi.ResourceOptions(depends_on=[allow_bucket]))

pulumi.export("bucketName", bucket.bucket)
