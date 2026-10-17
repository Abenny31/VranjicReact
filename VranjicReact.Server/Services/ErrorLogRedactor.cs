using System.Text.RegularExpressions;

namespace VranjicReact.Server.Services;

// Request bodies, headers, cookies and query strings are never collected. Exception messages can
// still contain credentials, so remove configured secrets and common credential formats as well.
public sealed class ErrorLogRedactor(IConfiguration configuration)
{
    private static readonly TimeSpan MatchTimeout = TimeSpan.FromMilliseconds(100);
    private static readonly Regex SensitiveSetting = new(
        @"(?:^|:)(?:password|pwd|secret|clientsecret|token|accesstoken|refreshtoken|key|apikey|subscriptionkey|clientkey)$|^ConnectionStrings:",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant, MatchTimeout);
    private static readonly Regex Credentials = new(
        """(?i)(?:["']?(?:password|passwordhash|pwd|secret|client[_-]?secret|access[_-]?token|refresh[_-]?token|api[_-]?key|authorization|connectionstring)["']?\s*[:=]\s*)(?:"(?:\\.|[^"\\])*"|'(?:''|\\.|[^'\\])*'|[^;\s,}]+)""",
        RegexOptions.CultureInvariant, MatchTimeout);
    private static readonly Regex Bearer = new(@"\bBearer\s+[A-Za-z0-9._~+/=-]+", RegexOptions.IgnoreCase, MatchTimeout);
    private static readonly Regex Email = new(@"\b[^\s@<>""']+@[^\s@<>""']+\.[^\s@<>""']+", RegexOptions.CultureInvariant, MatchTimeout);
    private static readonly Regex UrlQuery = new(@"(https?://[^\s?""']+)\?[^\s""']+", RegexOptions.IgnoreCase, MatchTimeout);

    public string Sanitize(string? value, int maximumLength)
    {
        if (string.IsNullOrEmpty(value)) return string.Empty;
        if (value.Length > 131072) return Limit("[Diagnostic text omitted: exceeds safe processing limit]", maximumLength);
        try
        {
            foreach (var setting in configuration.AsEnumerable()
                .Where(pair => !string.IsNullOrEmpty(pair.Value) && SensitiveSetting.IsMatch(pair.Key))
                .OrderByDescending(pair => pair.Value!.Length))
                value = value.Replace(setting.Value!, "[REDACTED]", StringComparison.Ordinal);
            value = Bearer.Replace(value, "Bearer [REDACTED]");
            value = Credentials.Replace(value, "[REDACTED CREDENTIAL]");
            value = UrlQuery.Replace(value, "$1?[REDACTED]");
            value = Email.Replace(value, "[REDACTED EMAIL]");
            return Limit(value, maximumLength);
        }
        catch (RegexMatchTimeoutException)
        {
            return Limit("[Diagnostic text omitted: redaction timed out]", maximumLength);
        }
    }

    private static string Limit(string value, int maximumLength) =>
        value.Length <= maximumLength ? value : value[..maximumLength];
}
