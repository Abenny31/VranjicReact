using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Configuration;

namespace VranjicReact.Server.Tests.Configuration;

[TestClass]
public sealed class DotEnvBootstrapTests
{
    [TestMethod]
    public void ResolvePath_UsesProjectDirectoryBeforeApplicationDirectory()
    {
        using var directories = TemporaryDirectories.Create();
        var projectDirectory = Path.Combine(directories.Root, "VranjicReact.Server");
        var applicationDirectory = Path.Combine(directories.Root, "published");
        Directory.CreateDirectory(projectDirectory);
        Directory.CreateDirectory(applicationDirectory);
        File.WriteAllText(Path.Combine(projectDirectory, "VranjicReact.Server.csproj"), string.Empty);
        File.WriteAllText(Path.Combine(projectDirectory, ".env"), "SOURCE=project");
        File.WriteAllText(Path.Combine(applicationDirectory, ".env"), "SOURCE=application");

        var resolution = DotEnvBootstrap.ResolvePath(
            directories.Root,
            applicationDirectory,
            explicitPath: null);

        Assert.AreEqual(DotEnvSource.ProjectDirectory, resolution.Source);
        Assert.AreEqual(Path.Combine(projectDirectory, ".env"), resolution.Path);
    }

    [TestMethod]
    public void ResolvePath_UsesApplicationDirectoryWhenProjectFileIsNotAvailable()
    {
        using var directories = TemporaryDirectories.Create();
        var applicationDirectory = Path.Combine(directories.Root, "published");
        Directory.CreateDirectory(applicationDirectory);
        File.WriteAllText(Path.Combine(applicationDirectory, ".env"), "SOURCE=application");

        var resolution = DotEnvBootstrap.ResolvePath(
            directories.Root,
            applicationDirectory,
            explicitPath: null);

        Assert.AreEqual(DotEnvSource.ApplicationDirectory, resolution.Source);
        Assert.AreEqual(Path.Combine(applicationDirectory, ".env"), resolution.Path);
    }

    [TestMethod]
    public void ResolvePath_ReturnsNoneWhenNoImplicitFileExists()
    {
        using var directories = TemporaryDirectories.Create();

        var resolution = DotEnvBootstrap.ResolvePath(
            directories.Root,
            directories.Root,
            explicitPath: null);

        Assert.AreEqual(DotEnvSource.None, resolution.Source);
        Assert.IsNull(resolution.Path);
    }

    [TestMethod]
    public void Load_ContinuesWithoutFileSoHostConfigurationCanBeUsed()
    {
        using var directories = TemporaryDirectories.Create();
        var previousDotEnvPath = Environment.GetEnvironmentVariable(DotEnvBootstrap.PathEnvironmentVariable);
        try
        {
            Environment.SetEnvironmentVariable(DotEnvBootstrap.PathEnvironmentVariable, null);

            var result = DotEnvBootstrap.Load(directories.Root, directories.Root);

            Assert.IsFalse(result.IsLoaded);
            Assert.AreEqual(DotEnvSource.None, result.Source);
        }
        finally
        {
            Environment.SetEnvironmentVariable(DotEnvBootstrap.PathEnvironmentVariable, previousDotEnvPath);
        }
    }

    [TestMethod]
    public void ResolvePath_RejectsRelativeExplicitPath()
    {
        using var directories = TemporaryDirectories.Create();

        var exception = Assert.ThrowsExactly<InvalidOperationException>(() =>
            DotEnvBootstrap.ResolvePath(
                directories.Root,
                directories.Root,
                ".env"));

        StringAssert.Contains(exception.Message, "absolute path");
    }

    [TestMethod]
    public void ResolvePath_RejectsMissingExplicitFile()
    {
        using var directories = TemporaryDirectories.Create();
        var missingPath = Path.Combine(directories.Root, "missing.env");

        var exception = Assert.ThrowsExactly<InvalidOperationException>(() =>
            DotEnvBootstrap.ResolvePath(
                directories.Root,
                directories.Root,
                missingPath));

        StringAssert.Contains(exception.Message, "does not exist");
    }

    [TestMethod]
    public void Load_DoesNotOverrideExistingHostVariable()
    {
        using var directories = TemporaryDirectories.Create();
        var envPath = Path.Combine(directories.Root, ".env");
        var existingKey = $"DOTENV_TEST_EXISTING_{Guid.NewGuid():N}";
        var newKey = $"DOTENV_TEST_NEW_{Guid.NewGuid():N}";
        File.WriteAllText(envPath, $"{existingKey}=from-file{Environment.NewLine}{newKey}=from-file");

        var previousDotEnvPath = Environment.GetEnvironmentVariable(DotEnvBootstrap.PathEnvironmentVariable);
        try
        {
            Environment.SetEnvironmentVariable(DotEnvBootstrap.PathEnvironmentVariable, envPath);
            Environment.SetEnvironmentVariable(existingKey, "from-host");
            Environment.SetEnvironmentVariable(newKey, null);

            var result = DotEnvBootstrap.Load(directories.Root, directories.Root);

            Assert.IsTrue(result.IsLoaded);
            Assert.AreEqual(DotEnvSource.ExplicitPath, result.Source);
            Assert.AreEqual("from-host", Environment.GetEnvironmentVariable(existingKey));
            Assert.AreEqual("from-file", Environment.GetEnvironmentVariable(newKey));
        }
        finally
        {
            Environment.SetEnvironmentVariable(existingKey, null);
            Environment.SetEnvironmentVariable(newKey, null);
            Environment.SetEnvironmentVariable(DotEnvBootstrap.PathEnvironmentVariable, previousDotEnvPath);
        }
    }

    private sealed class TemporaryDirectories : IDisposable
    {
        private TemporaryDirectories(string root)
        {
            Root = root;
        }

        public string Root { get; }

        public static TemporaryDirectories Create()
        {
            var root = Path.Combine(Path.GetTempPath(), $"vranjic-dotenv-tests-{Guid.NewGuid():N}");
            Directory.CreateDirectory(root);
            return new TemporaryDirectories(root);
        }

        public void Dispose()
        {
            if (Directory.Exists(Root))
            {
                Directory.Delete(Root, recursive: true);
            }
        }
    }
}
