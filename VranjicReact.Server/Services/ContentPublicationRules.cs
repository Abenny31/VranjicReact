namespace VranjicReact.Server.Services;

public static class ContentPublicationRules
{
    public static DateTime? ResolvePublishedAt(bool canManageContent, DateTime? requestedPublishedAt) =>
        canManageContent ? requestedPublishedAt?.ToUniversalTime() : null;
}
