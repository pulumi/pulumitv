import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";
import * as fs from "fs";
import * as mime from "mime";
import * as path from "path";

export const websiteProgram = async (cwd: string) => {
    // Create a bucket and expose a website index document.
    const siteBucket = new aws.s3.Bucket("s3-website-bucket", {
        website: {
            indexDocument: "index.html",
        },
    });

    const siteDir = "app/build";

    function crawlDirectory(dir: string, f: (_: string) => void) {
        const files = fs.readdirSync(dir);
        for (const file of files) {
            const filePath = `${dir}/${file}`;
            const stat = fs.statSync(filePath);
            if (stat.isDirectory()) {
                crawlDirectory(filePath, f);
            }
            if (stat.isFile()) {
                f(filePath);
            }
        }
    }

    const webContentsRootPath = path.join(cwd, siteDir);
    console.log("Syncing contents from local disk at", webContentsRootPath);
    crawlDirectory(webContentsRootPath,
        (filePath: string) => {
            const relativeFilePath = filePath.replace(webContentsRootPath + "/", "");
            const contentFile = new aws.s3.BucketObject(
                relativeFilePath,
                {
                    key: relativeFilePath,
                    acl: "public-read",
                    bucket: siteBucket,
                    contentType: mime.getType(filePath) || undefined,
                    source: new pulumi.asset.FileAsset(filePath),
                },
                {
                    parent: siteBucket,
                });
        }
    );

    return {
        websiteUrl: siteBucket.websiteEndpoint,
    };
};
