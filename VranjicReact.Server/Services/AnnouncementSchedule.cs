namespace VranjicReact.Server.Services;

public static class AnnouncementSchedule
{
    public static bool IsActive(
        DateTime? publishedAt,
        DateTime startsAt,
        DateTime? expiresAt,
        DateTime utcNow) =>
        publishedAt.HasValue
        && publishedAt <= utcNow
        && startsAt <= utcNow
        && (!expiresAt.HasValue || expiresAt > utcNow);

    public static bool IsExpired(DateTime? expiresAt, DateTime utcNow) =>
        expiresAt.HasValue && expiresAt <= utcNow;
}
