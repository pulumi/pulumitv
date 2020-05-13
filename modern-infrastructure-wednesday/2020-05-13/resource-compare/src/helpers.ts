import * as pulumi from "@pulumi/pulumi";
import * as aws from "@pulumi/aws";
import { AxiosResponse } from "axios";
import axios from "axios";

const config = new pulumi.Config("datalake");

const environment = pulumi.getStack();
const secretRole = config.require("pulumiSecretRole");
const secretId = config.require("pulumiSecretId");

/**
 * Make an authenticated GET request to Pulumi's APIs. The
 * authentication token is retrieved from secrets management.
 *
 * @example
 *
 * const response = await pulumiHttpGet("https://api.pulumi.com/api/user/stacks");
 *
 * @param {string} url - the Pulumi API url
 *
 * @returns {AxiosResponse} - the result of the GET request
 *     interface AxiosResponse<T = any> {
 *         data: T;
 *         status: number;
 *         statusText: string;
 *         headers: any;
 *         config: AxiosRequestConfig;
 *         request?: any;
 *     }
 */
export const pulumiHttpGet = async (url: string): Promise<AxiosResponse> => {
    const sts = new aws.sdk.STS();
    const adminRole = await sts
        .assumeRole({
            RoleArn: secretRole,
            RoleSessionName: `${environment}-pulumiHttpGet`,
            DurationSeconds: 900, // 900s = 15 min
        })
        .promise();

    if (!adminRole || !adminRole.Credentials) {
        throw new Error(
            "Unable to assume admin role to view Pulumi API token.",
        );
    }

    const secretsManager = new aws.sdk.SecretsManager({
        accessKeyId: adminRole.Credentials.AccessKeyId,
        secretAccessKey: adminRole.Credentials.SecretAccessKey,
        sessionToken: adminRole.Credentials.SessionToken,
    });

    const pulumiAPIToken = await secretsManager
        .getSecretValue({
            SecretId: secretId,
            VersionStage: "AWSCURRENT",
        })
        .promise();

    if (!pulumiAPIToken.SecretString) {
        throw new Error("Unable to get Pulumi API token.");
    }

    const token = JSON.parse(pulumiAPIToken.SecretString)["access token"];
    if (!token) {
        throw new Error("Unable to parse Pulumi API token.");
    }

    try {
        return await axios.get(url, {
            headers: {
                Authorization: "token " + token,
            },
            responseType: "json",
        });
    } catch (e) {
        if (e.isAxiosError || e.config) {
            // If this is an axios error, mask the config
            // parameter so the access token is not
            // logged.
            throw new Error("Could not contact Pulumi API: " + e.message);
        } else {
            throw e;
        }
    }
};

/**
 * Create a policy document with the given statements.
 *
 * This can be used in an aws.iam.Policy resource.
 *
 * ## Example
 *
 *    const statements = [
 *        {
 *            Effect: <const>"Allow",
 *            Action: ["s3:ListBucket"],
 *            Resource: ["arn:somebucket*"],
 *        },
 *    ];
 *    const policyDocument = makePolicyDocument(statements);
 */
export const makePolicyDocument: (
    s: pulumi.Input<aws.iam.PolicyStatement[]>,
) => pulumi.Output<aws.iam.PolicyDocument> = (policyStatements) => {
    return pulumi.output(policyStatements).apply((statements) => {
        return {
            Version: <const>"2012-10-17",
            Statement: statements,
        };
    });
};
