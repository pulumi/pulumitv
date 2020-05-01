import * as pulumi from "@pulumi/pulumi";

/* eslint-disable @typescript-eslint/no-explicit-any */

pulumi.runtime.setMocks({
    /**
     * newResource mocks resource construction calls. This function should
     * return the physical identifier and the output properties for the
     * resource being constructed.
     *
     * @param resourceType: The token that indicates which resource type is
     * being constructed. This token is of the form "package:module:type".
     *
     * @param name: The logical name of the resource instance.
     *
     * @param inputs: The inputs for the resource.
     *
     * @param provider: If provided, the identifier of the provider instnace
     * being used to manage this resource.
     *
     * @param id: If provided, the physical identifier of an existing resource
     * to read or import.
     */
    newResource: function (
        resourceType: string,
        name: string,
        inputs: any,
        provider?: string,
        id?: string,
    ): { id: string; state: Record<string, any> } {
        const defaultState = {
            arn: `${name}-arn`,
            name: name,
            ...inputs,
        };
        // Use id unless it's blank or missing.
        const resourceId = id?.trim() ? id : `${name}-id`;
        if (resourceType === "aws:iam/role:Role") {
            return {
                id: resourceId,
                state: {
                    ...defaultState,
                    ...{
                        // `assumeRolePolicy` input can be either an object
                        // or a string, but the output type for the Role
                        // resource is just string (pulumi internally
                        // stringifies any object received).  This mimics
                        // pulumi's behavior and prevents a type mismatch
                        // from occuring when this property is used.
                        //
                        // In a test, use JSON.parse to convert back to an
                        // object if desired, e.g.:
                        //     const { Statement } = JSON.parse(role.assumeRolePolicy ?? "{}");
                        //     assert.deepEqual(Statement, [/* ... */]);
                        //
                        // Additionally, if assumeRolePolicy is configured
                        // with an output, the value given here as an input
                        // is an object with a `value` field and some other
                        // metadata. We pull off the `value` field if that
                        // is the case.
                        assumeRolePolicy:
                            typeof inputs.assumeRolePolicy === "object"
                                ? JSON.stringify(
                                      inputs.assumeRolePolicy.value ??
                                          inputs.assumeRolePolicy,
                                  )
                                : inputs.assumeRolePolicy,
                    },
                },
            };
        } else if (resourceType === "aws:iam/policy:Policy") {
            return {
                id: resourceId,
                state: {
                    ...defaultState,
                    ...{
                        policy:
                            typeof inputs.policy === "object"
                                ? JSON.stringify(inputs.policy)
                                : inputs.policy,
                    },
                },
            };
        } else if (
            resourceType === "aws:dms/replicationInstance:ReplicationInstance"
        ) {
            return {
                id: resourceId,
                state: {
                    ...defaultState,
                    ...{
                        replicationInstanceArn: defaultState.arn,
                    },
                },
            };
        } else if (resourceType === "aws:dms/endpoint:Endpoint") {
            return {
                id: resourceId,
                state: {
                    ...defaultState,
                    ...{
                        endpointArn: defaultState.arn,
                    },
                },
            };
        } else {
            return { id: resourceId, state: defaultState };
        }
    },
    /**
     * call mocks provider-implemented function calls (e.g.
     * aws.get_availability_zones).
     *
     * @param token: The token that indicates which function is being called.
     * This token is of the form "package:module:function".
     *
     * @param args: The arguments provided to the function call.
     */
    call: function (token: string, args: any): Record<string, any> {
        switch (token) {
            case "aws:index/getCallerIdentity:getCallerIdentity":
                return {
                    accountId: "012345678910",
                };
            case "aws:secretsmanager/getSecretVersion:getSecretVersion":
                return {
                    arn: `${args.secretId}-arn`,
                    secretBinary: "",
                    secretId: args.secretId,
                    secretString: JSON.stringify({
                        username: `username-${args.secretId}`,
                        password: `password-${args.secretId}`,
                        externalId: `externalId-${args.secretId}`,
                    }),
                    versionId: "",
                    versionStages: [],
                    id: "",
                };
        }
        return {};
    },
});
