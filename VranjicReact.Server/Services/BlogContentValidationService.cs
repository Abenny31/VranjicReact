using VranjicReact.Server.Contracts;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public sealed record ValidatedBlogSource(
    string Title,
    string? Author,
    int? Year,
    ContentSourceType Type,
    string? Url,
    string? Note);

public sealed record BlogValidationResult(
    ContentOrigin? Origin,
    IReadOnlyList<ValidatedBlogSource> Sources,
    string? Error)
{
    public bool IsValid => Error is null;

    public static BlogValidationResult Invalid(string error) =>
        new(null, Array.Empty<ValidatedBlogSource>(), error);
}

public sealed class BlogContentValidationService
{
    public BlogValidationResult Validate(UpsertBlogPostRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Title)
            || string.IsNullOrWhiteSpace(request.Excerpt)
            || string.IsNullOrWhiteSpace(request.Body))
        {
            return BlogValidationResult.Invalid("Naslov, sažetak i sadržaj su obvezni.");
        }

        if (request.Title.Trim().Length > 200 || request.Excerpt.Trim().Length > 512)
        {
            return BlogValidationResult.Invalid("Naslov ili sažetak su predugi.");
        }

        var heroImageUrl = NullIfWhiteSpace(request.HeroImageUrl);
        if (heroImageUrl?.Length > 512 || (heroImageUrl is not null && !IsSafeMediaUrl(heroImageUrl)))
        {
            return BlogValidationResult.Invalid("Poveznica naslovne slike nije valjana.");
        }

        ContentOrigin? parsedOrigin = null;
        if (!string.IsNullOrWhiteSpace(request.Origin))
        {
            if (!TryParseEnumName(request.Origin, out ContentOrigin origin))
            {
                return BlogValidationResult.Invalid("Podrijetlo sadržaja nije valjano.");
            }

            parsedOrigin = origin;
        }

        var sources = new List<ValidatedBlogSource>();
        foreach (var source in request.Sources ?? Array.Empty<UpsertBlogPostSourceRequest>())
        {
            if (string.IsNullOrWhiteSpace(source.Title) || source.Title.Trim().Length > 300)
            {
                return BlogValidationResult.Invalid("Svaki izvor mora imati naslov do 300 znakova.");
            }

            if (!TryParseEnumName(source.Type, out ContentSourceType sourceType))
            {
                return BlogValidationResult.Invalid("Vrsta izvora nije valjana.");
            }

            var author = NullIfWhiteSpace(source.Author);
            var url = NullIfWhiteSpace(source.Url);
            var note = NullIfWhiteSpace(source.Note);
            if (author?.Length > 200 || url?.Length > 1024 || note?.Length > 1000)
            {
                return BlogValidationResult.Invalid("Podaci izvora su predugi.");
            }

            if (source.Year is <= 0 || source.Year > DateTime.UtcNow.Year + 1)
            {
                return BlogValidationResult.Invalid("Godina izvora nije valjana.");
            }

            if (sourceType == ContentSourceType.Url && url is null)
            {
                return BlogValidationResult.Invalid("URL izvor mora imati poveznicu.");
            }

            if (url is not null && !IsSafeHttpUrl(url))
            {
                return BlogValidationResult.Invalid("Poveznica izvora mora biti valjana HTTP/HTTPS adresa.");
            }

            sources.Add(new ValidatedBlogSource(
                source.Title.Trim(),
                author,
                source.Year,
                sourceType,
                url,
                note));
        }

        if (parsedOrigin == ContentOrigin.DocumentedAndVerified && sources.Count == 0)
        {
            return BlogValidationResult.Invalid("Dokumentirani sadržaj mora imati najmanje jedan izvor.");
        }

        return new BlogValidationResult(parsedOrigin, sources, null);
    }

    private static bool TryParseEnumName<TEnum>(string value, out TEnum parsed)
        where TEnum : struct, Enum
    {
        parsed = default;
        var normalized = value.Trim();
        return Enum.GetNames<TEnum>().Contains(normalized, StringComparer.OrdinalIgnoreCase)
            && Enum.TryParse(normalized, true, out parsed);
    }

    private static bool IsSafeMediaUrl(string value)
    {
        if (value.StartsWith('/') && !value.StartsWith("//", StringComparison.Ordinal))
        {
            return true;
        }

        return IsSafeHttpUrl(value);
    }

    private static bool IsSafeHttpUrl(string value) =>
        Uri.TryCreate(value, UriKind.Absolute, out var uri)
        && !string.IsNullOrWhiteSpace(uri.Host)
        && (uri.Scheme == Uri.UriSchemeHttp || uri.Scheme == Uri.UriSchemeHttps);

    private static string? NullIfWhiteSpace(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}
