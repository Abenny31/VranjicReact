using DotNetEnv;

namespace VranjicReact.Server.Configuration;

internal static class DotEnvBootstrap
{
    internal const string PathEnvironmentVariable = "DOTENV_PATH";
    private const string FileName = ".env";
    private const string ProjectDirectoryName = "VranjicReact.Server";
    private const string ProjectFileName = "VranjicReact.Server.csproj";

    internal static DotEnvLoadResult Load(
        string? workingDirectory = null,
        string? applicationDirectory = null)
    {
        var resolution = ResolvePath(
            workingDirectory ?? Directory.GetCurrentDirectory(),
            applicationDirectory ?? AppContext.BaseDirectory,
            Environment.GetEnvironmentVariable(PathEnvironmentVariable));

        if (resolution.Path is null)
        {
            return new DotEnvLoadResult(false, DotEnvSource.None);
        }

        Env.Load(
            resolution.Path,
            new LoadOptions(
                setEnvVars: true,
                clobberExistingVars: false,
                onlyExactPath: true));

        return new DotEnvLoadResult(true, resolution.Source);
    }

    internal static DotEnvPathResolution ResolvePath(
        string workingDirectory,
        string applicationDirectory,
        string? explicitPath)
    {
        if (!string.IsNullOrWhiteSpace(explicitPath))
        {
            if (!Path.IsPathFullyQualified(explicitPath))
            {
                throw new InvalidOperationException(
                    $"{PathEnvironmentVariable} must contain an absolute path to a .env file.");
            }

            var fullExplicitPath = Path.GetFullPath(explicitPath);
            if (!File.Exists(fullExplicitPath))
            {
                throw new InvalidOperationException(
                    $"{PathEnvironmentVariable} points to a file that does not exist: '{fullExplicitPath}'.");
            }

            return new DotEnvPathResolution(fullExplicitPath, DotEnvSource.ExplicitPath);
        }

        var fullWorkingDirectory = Path.GetFullPath(workingDirectory);
        var projectDirectory = ResolveProjectDirectory(fullWorkingDirectory);
        if (projectDirectory is not null)
        {
            var projectEnvPath = Path.Combine(projectDirectory, FileName);
            if (File.Exists(projectEnvPath))
            {
                return new DotEnvPathResolution(projectEnvPath, DotEnvSource.ProjectDirectory);
            }
        }

        var fullApplicationDirectory = Path.GetFullPath(applicationDirectory);
        var applicationEnvPath = Path.Combine(fullApplicationDirectory, FileName);
        return File.Exists(applicationEnvPath)
            ? new DotEnvPathResolution(applicationEnvPath, DotEnvSource.ApplicationDirectory)
            : new DotEnvPathResolution(null, DotEnvSource.None);
    }

    private static string? ResolveProjectDirectory(string workingDirectory)
    {
        if (File.Exists(Path.Combine(workingDirectory, ProjectFileName)))
        {
            return workingDirectory;
        }

        var solutionProjectDirectory = Path.Combine(workingDirectory, ProjectDirectoryName);
        return File.Exists(Path.Combine(solutionProjectDirectory, ProjectFileName))
            ? solutionProjectDirectory
            : null;
    }
}

internal readonly record struct DotEnvLoadResult(bool IsLoaded, DotEnvSource Source);

internal readonly record struct DotEnvPathResolution(string? Path, DotEnvSource Source);

internal enum DotEnvSource
{
    None,
    ExplicitPath,
    ProjectDirectory,
    ApplicationDirectory,
}
