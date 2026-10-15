using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Configuration;

namespace VranjicReact.Server.Tests.Configuration;

[TestClass]
public sealed class PublicContactOptionsTests
{
    [TestMethod]
    public void MissingConfiguration_IsOptional()
    {
        Assert.IsTrue(new PublicContactOptions().IsValid());
    }

    [TestMethod]
    public void PublicContacts_AcceptFormattedPhoneAndPlainEmails()
    {
        Assert.IsTrue(new PublicContactOptions
        {
            Email = " public@example.test ", SupportEmail = "support@example.test", Phone = "+385 (98) 123-4567",
            FacebookUrl = "https://www.facebook.com/example", Address = "Test address"
        }.IsValid());
    }

    [TestMethod]
    [DataRow("javascript:alert(1)")]
    [DataRow("http://www.facebook.com/example")]
    [DataRow("https://user:password@www.facebook.com/example")]
    public void UnsafeSocialLinks_AreRejected(string url)
    {
        Assert.IsFalse(new PublicContactOptions { FacebookUrl = url }.IsValid());
    }

    [TestMethod]
    [DataRow("not-an-email")]
    [DataRow("Public Name <public@example.test>")]
    [DataRow("public@example.test\r\nBcc: hidden@example.test")]
    public void InvalidEmails_AreRejectedForBothAddresses(string email)
    {
        Assert.IsFalse(new PublicContactOptions { Email = email }.IsValid());
        Assert.IsFalse(new PublicContactOptions { SupportEmail = email }.IsValid());
    }

    [TestMethod]
    [DataRow("098123?body=test")]
    [DataRow("tel:098123")]
    public void Phone_MustContainOnlyPhoneCharacters(string phone)
    {
        Assert.IsFalse(new PublicContactOptions { Phone = phone }.IsValid());
    }
}
