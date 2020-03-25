## Usage

Build https://github.com/pulumi/pulumi and https://github.com/pulumi/pulumi-policy 
per the instructions in those repos, then:

```
$ yarn link @pulumi/pulumi
$ yarn link @pulumi/policy
```

To publish policies:

```
$ export PULUMI_DEBUG_COMMANDS=true
$ pulumi policy publish your_org/your_policy_pack_name
...
```

To apply policies:

```
$ export PULUMI_DEBUG_COMMANDS=true
$ pulumi policy apply your_org/your_policy_pack_name VERSION_FROM_APPLY_STEP
...
```
