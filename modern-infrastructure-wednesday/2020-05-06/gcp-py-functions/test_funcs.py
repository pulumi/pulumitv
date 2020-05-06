import pulumi
import pytest

class MyMocks(pulumi.runtime.Mocks):
    def new_resource(self, type_, name, inputs, provider, id_):
        return [name + '_id', inputs]
    def call(self, token, args, provider):
        return {}

pulumi.runtime.set_mocks(MyMocks())

import funcs

@pulumi.runtime.test
def test_object_in_bucket():
    def buckets_match(args):
        bucket_name, source_bucket = args
        assert bucket_name == source_bucket
    return pulumi.Output.all(funcs.bucket.name, funcs.source_archive_object.bucket).apply(buckets_match)

@pulumi.runtime.test
def test_function_runtime():
    def check_runtime(rt):
        assert rt == "python37"
    return funcs.fxn.runtime.apply(check_runtime)

@pulumi.runtime.test
def test_function_entrypoint():
    def check_entrypoint(ep):
        import functions.main
        assert callable(getattr(functions.main, ep))
    return funcs.fxn.entry_point.apply(check_entrypoint)
