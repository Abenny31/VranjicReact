namespace VranjicReact.Server.Services;

public interface ITranslationService
{
    Task<string> TranslateAsync(string text, string sourceLanguage, string targetLanguage,
        CancellationToken cancellationToken = default);
}

public static class TranslationLimits
{
    public const int MaxTextLength = 10_000;
}
