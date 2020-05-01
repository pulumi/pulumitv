import * as pulumi from "@pulumi/pulumi";

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Returns a resource output's value, even if it's undefined.
 */
export function promise<T>(output: pulumi.Output<T>): Promise<T | undefined> {
    return (output as any).promise() as Promise<T>;
}

// Alias for promise until we do a full replacement
export const getOutput = <T>(
    output: pulumi.Output<T>,
): Promise<T | undefined> => promise(output);
