import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

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
                return {
                    statusCode: 200,
                    body: JSON.stringify({
                        "status": "Hello World"
                    }),
                }
            }
        }
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
