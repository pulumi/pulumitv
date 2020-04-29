import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const ddbTable = new aws.dynamodb.Table("table", {
    attributes: [{
        name: "id",
        type: "S"
    }],
    hashKey: "id",
    readCapacity: 1,
    writeCapacity: 1
});

const api = new awsx.apigateway.API("webapp-api", {
    routes: [
        {
            localPath: "./app/build",
            path: "/"
        },
        {
            path: "/api",
            method: "GET",
            eventHandler: async () => {
                const client = new aws.sdk.DynamoDB.DocumentClient();
                const tableName = ddbTable.name.get();
                const counterId = "counter";

                const data = await client.get({
                    TableName: tableName,
                    Key: { id: counterId },
                    ConsistentRead: true,
                }).promise();

                const value = data.Item;
                const count = value?.count || 0;

                await client.put({
                    TableName: tableName,
                    Item: { id: counterId, count: count + 1 },
                }).promise();

                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        "count": count
                    }),
                }
            }
        },
    ]
});

const usEastProvider = new aws.Provider("east", {
    region: "us-east-1"
});

const certificate = new aws.acm.Certificate("cert", {
    domainName: "webapp.pulumi.tv",
    validationMethod: "DNS",
}, { provider: usEastProvider });

const hzid = pulumi.output(aws.route53.getZone({
    name: "pulumi.tv"
}, { async: true })).zoneId;

const validationRecord = new aws.route53.Record("cert-validation", {
    name: certificate.domainValidationOptions[0].resourceRecordName,
    type: certificate.domainValidationOptions[0].resourceRecordType,
    records: [
        certificate.domainValidationOptions[0].resourceRecordValue
    ],
    ttl: 60,
    zoneId: hzid,
});

const certCertificateValidation = new aws.acm.CertificateValidation("cert", {
    certificateArn: certificate.arn,
    validationRecordFqdns: [validationRecord.fqdn],
}, { provider: usEastProvider });

const apiGatewayCustomDomain = new aws.apigateway.DomainName("webapp.pulumi.tv", {
    certificateArn: certificate.arn,
    domainName: "webapp.pulumi.tv",
}, { dependsOn: [certCertificateValidation]});

const domainMapping = new aws.apigateway.BasePathMapping("mapping", {
    restApi: api.restAPI.id,
    domainName: apiGatewayCustomDomain.domainName,
    stageName: api.stage.stageName,
});

const webappRecord = new aws.route53.Record("webapp", {
    name: "webapp",
    zoneId: hzid,
    type: "A",
    aliases: [{
        name: apiGatewayCustomDomain.cloudfrontDomainName,
        zoneId: apiGatewayCustomDomain.cloudfrontZoneId,
        evaluateTargetHealth: true,
    }],
})

export const apiUrl = api.url;
export const siteUrl = pulumi.interpolate`https://${webappRecord.fqdn}`;
