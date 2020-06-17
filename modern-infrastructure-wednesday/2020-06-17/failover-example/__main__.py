# Copyright 2016-2018, Pulumi Corporation.  All rights reserved.

import pulumi
import pulumi_aws as aws
import pulumi_aws.route53

size = 't2.micro'

ami = aws.get_ami(most_recent="true",
                  owners=["137112412989"],
                  filters=[{"name":"name","values":["amzn-ami-hvm-*"]}])


group = aws.ec2.SecurityGroup('web-secgrp',
    description='Enable HTTP access',
    ingress=[
        { 'protocol': 'tcp', 'from_port': 80, 'to_port': 80, 'cidr_blocks': ['0.0.0.0/0'] }
    ])

user_data = """
#!/bin/bash
echo "Hello, World!" > index.html
nohup python -m SimpleHTTPServer 80 &
"""

server = aws.ec2.Instance('web-server-www',
    instance_type=size,
    vpc_security_group_ids=[group.id],
    user_data=user_data,
    ami=ami.id)

hc = aws.route53.HealthCheck('ec2-hc',
    failure_threshold='1',
    ip_address=server.public_ip,
    port=80,
    request_interval='10',
    resource_path="/",
    type='HTTP')

failover_s3_bucket = aws.s3.Bucket('failover_bucket',
    bucket='failover.pulumi.tv',
    acl='public-read',
    website={
        'indexDocument': 'index.html'
    })

index_object = aws.s3.BucketObject('index_object',
    bucket=failover_s3_bucket.bucket,
    key='index.html',
    source=pulumi.FileAsset('index.html'),
    acl='public-read')

zone = aws.route53.get_zone(name='pulumi.tv')
primary_record = aws.route53.Record('server_record', 
    name='failover.pulumi.tv',
    failover_routing_policies=[{
        'type': 'PRIMARY'
    }],
    records=[server.public_ip],
    set_identifier='primary',
    health_check_id=hc.id,
    ttl='5',
    type='A',
    zone_id=zone.zone_id)

secondary_record = aws.route53.Record('s3_record',
    name='failover.pulumi.tv',
    failover_routing_policies=[{
        'type': 'SECONDARY'
    }],
    type='A',
    set_identifier='secondary',
    aliases=[{
        'evaluate_target_health': 'true',
        'name': failover_s3_bucket.website_domain,
        'zone_id': failover_s3_bucket.hosted_zone_id
    }],
    zone_id=zone.zone_id)

pulumi.export('public_ip', server.public_ip)
pulumi.export('public_dns', server.public_dns)
