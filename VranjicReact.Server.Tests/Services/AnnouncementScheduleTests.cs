using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Services;

[TestClass]
public sealed class AnnouncementScheduleTests
{
    private static readonly DateTime UtcNow = new(2026, 9, 24, 12, 0, 0, DateTimeKind.Utc);

    [TestMethod]
    public void PublishedAnnouncementWithinWindow_IsActive()
    {
        var result = AnnouncementSchedule.IsActive(
            UtcNow.AddHours(-2),
            UtcNow.AddHours(-1),
            UtcNow.AddHours(1),
            UtcNow);

        Assert.IsTrue(result);
    }

    [TestMethod]
    public void ExpiredAnnouncement_IsNotActiveAndIsArchived()
    {
        var expiresAt = UtcNow.AddMinutes(-1);

        Assert.IsFalse(AnnouncementSchedule.IsActive(
            UtcNow.AddDays(-1),
            UtcNow.AddDays(-1),
            expiresAt,
            UtcNow));
        Assert.IsTrue(AnnouncementSchedule.IsExpired(expiresAt, UtcNow));
    }

    [TestMethod]
    public void DraftOrFutureAnnouncement_IsNotActive()
    {
        Assert.IsFalse(AnnouncementSchedule.IsActive(null, UtcNow.AddHours(-1), null, UtcNow));
        Assert.IsFalse(AnnouncementSchedule.IsActive(
            UtcNow.AddHours(-1),
            UtcNow.AddHours(1),
            null,
            UtcNow));
    }

    [TestMethod]
    public void ContributorCannotAssignPublishedAtFromRequest()
    {
        Assert.IsNull(ContentPublicationRules.ResolvePublishedAt(false, UtcNow));
        Assert.AreEqual(UtcNow, ContentPublicationRules.ResolvePublishedAt(true, UtcNow));
    }
}
