using Pulumi;
using Github = Pulumi.Github;

class MyStack : Stack
{
    public MyStack()
    {
        var repos = Github.GetRepositories.InvokeAsync(new Github.GetRepositoriesArgs
        {
            Query = "org:<your org> gitception",
        });
 
        foreach (string repo in repos.Result.Names) {
            var label = new Github.IssueLabel($"{repo}-example-label", new Github.IssueLabelArgs{
                Repository=repo,
                Color="512668",
                Name="pulumitv"
            });
        }
    }
}
