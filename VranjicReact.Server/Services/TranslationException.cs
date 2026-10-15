namespace VranjicReact.Server.Services;

public enum TranslationFailure
{
    Configuration,
    RateLimit,
    Unavailable,
    Timeout,
    InvalidResponse,
}

public sealed class TranslationException(TranslationFailure failure) : Exception("Translation failed.")
{
    public TranslationFailure Failure { get; } = failure;
}
