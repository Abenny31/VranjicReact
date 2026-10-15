using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.VisualStudio.TestTools.UnitTesting;

namespace VranjicReact.Server.Tests.Integration;

[TestClass]
public sealed class PublicContactApiTests
{
    [TestMethod]
    public async Task AnonymousRequest_ReturnsOnlyExplicitPublicContactFields()
    {
        using var app = new ContactApplication();
        using var client = app.CreateClient(new() { BaseAddress = new Uri("https://localhost") });
        using var response = await client.GetAsync("/api/public-contact");
        Assert.AreEqual(HttpStatusCode.OK, response.StatusCode);
        Assert.IsTrue(response.Headers.CacheControl?.NoStore);
        var contact = await response.Content.ReadFromJsonAsync<JsonElement>();
        CollectionAssert.AreEquivalent(new[] { "address", "email", "supportEmail", "phone", "facebookUrl" },
            contact.EnumerateObject().Select(property => property.Name).ToArray());
        Assert.AreEqual("public@example.test", contact.GetProperty("email").GetString());
        Assert.AreEqual("support@example.test", contact.GetProperty("supportEmail").GetString());
        Assert.AreEqual("+385 98 123 4567", contact.GetProperty("phone").GetString());
        Assert.AreEqual("Test address", contact.GetProperty("address").GetString());
        Assert.AreEqual("https://www.facebook.com/example", contact.GetProperty("facebookUrl").GetString());
    }

    private sealed class ContactApplication : WebApplicationFactory<Program>
    {
        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");
            builder.UseSetting("SeedAdminUser:Enabled", "false");
            builder.UseSetting("SeedAdminUser:Email", "");
            builder.UseSetting("AccountEmail:Enabled", "false");
            builder.UseSetting("AccountEmail:Password", "private-test-value");
            builder.UseSetting("AllowedHosts", "localhost");
            // This endpoint must work without connecting to a database.
            builder.UseSetting("ConnectionStrings:DefaultConnection", "Server=unavailable.invalid;Database=Unused;Integrated Security=true;Connect Timeout=1");
            builder.UseSetting("PublicContact:Address", " Test address ");
            builder.UseSetting("PublicContact:Email", " public@example.test ");
            builder.UseSetting("PublicContact:SupportEmail", "support@example.test");
            builder.UseSetting("PublicContact:Phone", "+385 98 123 4567");
            builder.UseSetting("PublicContact:FacebookUrl", "HTTPS://www.facebook.com/example");
            builder.ConfigureServices(services => services.AddDataProtection().UseEphemeralDataProtectionProvider());
        }
    }
}
