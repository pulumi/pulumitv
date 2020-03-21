// Copyright 2016-2019, Pulumi Corporation.  All rights reserved.
import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import * as awsx from "@pulumi/awsx";

const name = pulumi.runtime.getProject();

const config = new pulumi.Config();
const assumeRoleArn = config.get("assumeRoleArn");
const domainName = config.require("domainName");
const hostedZone = config.require("hostedZone");

// Create a 1st class provider so we can expicitly connect to an assumeRole account.
let providerConfig: aws.ProviderArgs = {
    region: aws.config.region,
};

if (assumeRoleArn) {
    providerConfig = {
        region: aws.config.region,
        assumeRole: {
            roleArn: assumeRoleArn,
        }
    };
}

const awsProvider = new aws.Provider("prod", providerConfig);

// Create a provider to use in us-east-1 so that we can create an ACM certificate there,
// which is required for Cloudfront to use (also in us-east-1).
const awsEastProvider = new aws.Provider("prod-us-east-1", {
    region: "us-east-1",
    assumeRole: {
        roleArn: assumeRoleArn,
    },
});

const echoRoute: awsx.apigateway.EventHandlerRoute = {
    path: "/echo",
    method: "POST",
    apiKeyRequired: true,
    eventHandler: async (event) => {
        let val = event.body ? event.body : "";
        if (event.isBase64Encoded) {
            val = Buffer.from(val, "base64").toString("binary");
        }

        return {
            statusCode: 200,
            body: val,
        };
    }
};

// Create an API endpoint
const site = new awsx.apigateway.API(name, {
    apiKeySource: "HEADER", // expect x-api-key
    routes: [echoRoute],
}, { provider: awsProvider });

const apiKey = new aws.apigateway.ApiKey(name, {});

const usagePlan = new aws.apigateway.UsagePlan(name, {
    apiStages: [
        {
            apiId: site.restAPI.id,
            stage: site.stage.stageName
        }
    ]
});

const usagePlanKey = new aws.apigateway.UsagePlanKey(name, {
    keyId: apiKey.id,
    keyType: "API_KEY",
    usagePlanId: usagePlan.id
});

// Get certificate for desired endpoint
const certificate = new aws.acm.Certificate(name, {
    domainName: domainName,
    validationMethod: "DNS",
}, { provider: awsEastProvider });

// Get the zone we're going to use
const hostedZoneId = aws.route53.getZone({
    name: hostedZone,
}, { provider: awsEastProvider, async: true }).then(zone => zone.id);

// Validate we have the certificate
const certificateValidationRecord = new aws.route53.Record(`${name}-validation`, {
    name: certificate.domainValidationOptions.apply(opt => opt[0].resourceRecordName),
    type: certificate.domainValidationOptions.apply(opt => opt[0].resourceRecordType),
    zoneId: hostedZoneId,
    records: [certificate.domainValidationOptions.apply(opt => opt[0].resourceRecordValue)],
    ttl: 60,
}, { provider: awsEastProvider });
const certificateValidation = new aws.acm.CertificateValidation(name, {
    certificateArn: certificate.arn,
    validationRecordFqdns: [certificateValidationRecord.fqdn],
}, { provider: awsEastProvider });

// API Gateway requires we register the domain with it first
const domain = new aws.apigateway.DomainName(name, {
    certificateArn: certificate.arn,
    domainName: domainName,
}, { provider: awsProvider, dependsOn: [certificateValidation] });

// Then we can map a REST API to a domain with a BasePathMapping
const mapping = new aws.apigateway.BasePathMapping(name, {
    restApi: site.restAPI,
    stageName: site.stage.stageName, // We map the stage we got for free with `.x.API` above
    domainName: domain.domainName, // We map it into the domain we registered above
}, { provider: awsProvider });

// Finally, we need a DNS record to point at our API Gateway
const record = new aws.route53.Record(name, {
    type: "A",
    zoneId: hostedZoneId,
    name: domainName,
    aliases: [{
        // APIGateway provides it's own CloudFront distribution we can point at...
        name: domain.cloudfrontDomainName,
        zoneId: domain.cloudfrontZoneId,
        evaluateTargetHealth: true,
    }],
}, { provider: awsProvider });

const secret = new aws.secretsmanager.Secret(name, {});
const secretValue = new aws.secretsmanager.SecretVersion(name, {
    secretId: secret.id,
    secretString: apiKey.value.apply(v => JSON.stringify({
        key: v,
        domain: domainName
    }))
});

pulumi.all([secret.id, secretValue.versionId]).apply(([sid, vid]) => {
    const returned = aws.secretsmanager.getSecretVersion({
        secretId: sid,
        versionId: vid
    });
    returned.then(value => {
        console.log(value.secretString);
    });
});

export const siteUrl = pulumi.interpolate`https://${record.name}/`;
