import * as assert from "assert";

import { getOutput } from "./test-helpers";

import {
    pulumiExtractCloudwatchEventTarget,
    pulumiExtractStepStack,
} from "./pulumi-extract";

describe("pulumiExtractCloudwatchEventTarget", () => {
    it("targets the pulumi extract state machine", async () => {
        assert.equal(
            await getOutput(pulumiExtractCloudwatchEventTarget.arn),
            await getOutput(pulumiExtractStepStack.id),
        );
    });
    it("uses the pulumi extract cloudwatch role");
    it("triggers from the pulumi extract cloudwatch event rule");
});
