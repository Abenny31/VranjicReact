using Microsoft.Extensions.Options;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Configuration;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Configuration;

[TestClass]
public sealed class AccountEmailOptionsTests
{
    [TestMethod]
    public async Task DisabledByDefault_DoesNotSendOrPretendSuccess()
    {
        var options = new AccountEmailOptions();
        Assert.IsFalse(options.Enabled);
        Assert.IsTrue(options.IsValid());
        await Assert.ThrowsExactlyAsync<InvalidOperationException>(() =>
            new AccountEmailSender(Options.Create(options)).SendInvitationAsync("test@example.test", "https://example.test", CancellationToken.None));
    }

    [TestMethod]
    public void Enabled_RequiresCompleteSettingsAndHttpsPublicUrl()
    {
        var options = new AccountEmailOptions { Enabled = true };
        Assert.IsFalse(options.IsValid());
        options.PublicBaseUrl = "https://example.test"; options.Host = "smtp.example.test";
        options.UserName = "test"; options.Password = "test"; options.FromAddress = "test@example.test";
        Assert.IsTrue(options.IsValid());
        foreach (var invalid in new[] { "http://example.test", "https://user:password@example.test", "https://example.test?redirect=elsewhere", "https://example.test#fragment" })
        {
            options.PublicBaseUrl = invalid;
            Assert.IsFalse(options.IsValid());
        }
    }
}
