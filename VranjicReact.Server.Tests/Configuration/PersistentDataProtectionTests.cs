using System.Security.Cryptography;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Configuration;

namespace VranjicReact.Server.Tests.Configuration;

[TestClass]
public sealed class PersistentDataProtectionTests
{
    [TestMethod]
    public void Unconfigured_PreservesHostingDefaults()
    {
        var services = new ServiceCollection();
        services.AddConfiguredDataProtection(Config(null, null), Path.GetTempPath());
        Assert.AreEqual(0, services.Count);
    }

    [TestMethod]
    [DataRow(null, "Example")]
    [DataRow("relative/keys", null)]
    [DataRow("relative/keys", "Example")]
    public void InvalidConfiguration_IsRejected(string? path, string? name)
    {
        Assert.ThrowsExactly<InvalidOperationException>(() => new ServiceCollection()
            .AddConfiguredDataProtection(Config(path, name), Path.GetTempPath()));
    }

    [TestMethod]
    public void ApplicationDirectoryAndPublicSubdirectory_AreRejected()
    {
        var root = Path.Combine(Path.GetTempPath(), "DFB_KeyValidation");
        foreach (var path in new[] { root, Path.Combine(root, "wwwroot", "keys"), Path.Combine(root, "private") })
            Assert.ThrowsExactly<InvalidOperationException>(() => new ServiceCollection()
                .AddConfiguredDataProtection(Config(path, "Test"), root));
    }

    [TestMethod]
    public void MissingDirectory_IsRejectedWithoutCreatingIt()
    {
        var directory = Path.Combine(Path.GetTempPath(), "DFB_MissingKeys_" + Guid.NewGuid().ToString("N"));
        Assert.ThrowsExactly<InvalidOperationException>(() => new ServiceCollection()
            .AddConfiguredDataProtection(Config(directory, "Test"), Path.Combine(Path.GetTempPath(), "DFB_App")));
        Assert.IsFalse(Directory.Exists(directory));
    }

    [TestMethod]
    public void ProtectedPayload_SurvivesProviderRecreation_AndIsolatesApplicationNames()
    {
        if (!OperatingSystem.IsWindows()) Assert.Inconclusive("DPAPI persistence requires Windows.");
        var root = Path.Combine(Path.GetTempPath(), "DFB_KeyTest_" + Guid.NewGuid().ToString("N"));
        var keys = Path.Combine(root, "keys");
        Directory.CreateDirectory(keys);
        try
        {
            ServiceProvider Provider(string name)
            {
                var services = new ServiceCollection().AddLogging();
                services.AddConfiguredDataProtection(Config(keys, name), Path.Combine(root, "app"));
                return services.BuildServiceProvider();
            }
            string protectedValue;
            using (var first = Provider("Test.Production"))
                protectedValue = first.GetRequiredService<IDataProtectionProvider>().CreateProtector("test").Protect("non-secret-test-payload");
            using (var second = Provider("Test.Production"))
                Assert.AreEqual("non-secret-test-payload", second.GetRequiredService<IDataProtectionProvider>().CreateProtector("test").Unprotect(protectedValue));
            using (var other = Provider("Test.Staging"))
                Assert.ThrowsExactly<CryptographicException>(() => other.GetRequiredService<IDataProtectionProvider>().CreateProtector("test").Unprotect(protectedValue));
            var keyFiles = Directory.GetFiles(keys, "key-*.xml");
            Assert.IsTrue(keyFiles.Length > 0);
            foreach (var file in keyFiles) StringAssert.Contains(File.ReadAllText(file), "encryptedSecret");
        }
        finally
        {
            // Only the unique directory allocated by this test; no application key store is read or removed.
            Directory.Delete(root, recursive: true);
        }
    }

    private static IConfiguration Config(string? path, string? name) => new ConfigurationBuilder()
        .AddInMemoryCollection(new Dictionary<string, string?>
        {
            ["DataProtection:KeyDirectory"] = path,
            ["DataProtection:ApplicationName"] = name,
        }).Build();
}
