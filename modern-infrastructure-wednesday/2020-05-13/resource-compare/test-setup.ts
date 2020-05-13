import * as pulumi from "@pulumi/pulumi";

/* eslint-disable @typescript-eslint/no-explicit-any */

pulumi.runtime.setMocks({
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
        return { id: resourceId, state: defaultState };
    },
    call: function (): Record<string, any> {
        return {};
    },
});
