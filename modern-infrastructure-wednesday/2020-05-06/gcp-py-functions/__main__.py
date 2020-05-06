"""Python Pulumi program for creating Google Cloud Functions.

Create a single Google Cloud Function. The deployed application will calculate
the estimated travel time to a given location, sending the results via SMS.
"""

import pulumi
import funcs

# Export the DNS name of the bucket and the cloud function URL.
pulumi.export("bucket_name", funcs.bucket.url)
pulumi.export("fxn_url", funcs.fxn.https_trigger_url)
