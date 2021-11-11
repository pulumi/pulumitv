# Modern Infrastructure Wednesday: Upgrade Strategies with Python and GCP (MIW 23)

In this episode, we explore upgrade strategies for infrastructure and build and
demonstrate Pulumi's micro blue-green-like deployment strategy for cloud
resources.

If you want to try it on your own, use the code to deploy to Google Cloud. Then,
try changing the Debian family on line 10 of `__main__.py` from `debian-11` to
`debian-9` or `debian-10`, and vice versa. You will be able to run
`curl $(pulumi stack output instanceIP)` throughout the entire process as it
updates on GCP and get `Hello, World!` back as output every time, no matter which
operating system the instance is updating to.

Missed the episode? Check it out [on Youtube](https://youtu.be/vviIVCloMKQ).
