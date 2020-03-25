import * as fs from "fs";
import * as Mocha from "mocha";
import * as path from "path";
import * as pulumi from "@pulumi/pulumi";

// runTests executes all test files (*.ts) in the current directory.
export function runTests() {

    if (pulumi.runtime.isDryRun()) {
        console.log("Skipping Mocha tests during preview.");
        return;
    }

    // Create a new Mocha test runner (with a long timeout).
    const mocha = new Mocha({ timeout: 1000*60*30 });

    // Only keep the .ts files, and skip this file (index.ts).
    const testDir = __dirname;
    fs.readdirSync(testDir).
        filter(file => file.endsWith(".ts") && file !== "index.ts").
            forEach(file => { mocha.addFile(path.join(testDir, file)); });

    // Now actually run the tests with the desired reporter.
    console.log(`Running Mocha Tests: ${mocha.files}`);
    mocha.reporter("spec").run(failures => {
        process.exitCode = failures ? 1 : 0;
    });
}

// promise returns a resource output's value, even if it's undefined.
export function promise<T>(output: pulumi.Output<T>): Promise<T | undefined> {
    return (output as any).promise() as Promise<T>;
}
