using System.Net;
using System.Text.Json;

namespace VranjicReact.Server.Services;

public sealed class AzureTranslationService(HttpClient httpClient, IConfiguration configuration,
    ILogger<AzureTranslationService> logger) : ITranslationService
{
    public async Task<string> TranslateAsync(string text, string sourceLanguage, string targetLanguage,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(text) || text.Length > TranslationLimits.MaxTextLength)
            throw new ArgumentException("Text must contain between 1 and 10000 characters.", nameof(text));
        if (sourceLanguage != "hr" || targetLanguage == "hr" || !System.Text.RegularExpressions.Regex.IsMatch(targetLanguage, "^[a-z]{2,3}(-[a-z0-9]{2,8})?$", System.Text.RegularExpressions.RegexOptions.CultureInvariant))
            throw new ArgumentException("Specify hr as source and a valid target language code.");

        var endpoint = configuration["AzureTranslator:Endpoint"] ?? "https://api.cognitive.microsofttranslator.com";
        var key = configuration["AzureTranslator:Key"];
        var region = configuration["AzureTranslator:Region"];
        if (string.IsNullOrWhiteSpace(key) || string.IsNullOrWhiteSpace(region)
            || key.Any(char.IsControl) || region.Any(char.IsControl)
            || !Uri.TryCreate(endpoint, UriKind.Absolute, out var baseUri)
            || baseUri.Scheme != Uri.UriSchemeHttps || !string.IsNullOrEmpty(baseUri.UserInfo)
            || !string.IsNullOrEmpty(baseUri.Query) || !string.IsNullOrEmpty(baseUri.Fragment))
        {
            logger.LogError("Azure Translator configuration is missing or invalid. Check Endpoint, Key and Region.");
            throw new TranslationException(TranslationFailure.Configuration);
        }

        using var request = new HttpRequestMessage(HttpMethod.Post,
            endpoint.TrimEnd('/') + $"/translate?api-version=3.0&from=hr&to={Uri.EscapeDataString(targetLanguage)}&textType=plain");
        request.Headers.Add("Ocp-Apim-Subscription-Key", key);
        request.Headers.Add("Ocp-Apim-Subscription-Region", region);
        var traceId = Guid.NewGuid().ToString();
        request.Headers.Add("X-ClientTraceId", traceId);
        request.Content = JsonContent.Create(new[] { new Dictionary<string, string> { ["Text"] = text } });

        try
        {
            using var response = await httpClient.SendAsync(request, cancellationToken);
            if (!response.IsSuccessStatusCode)
            {
                // Do not log response bodies, headers, text, or exception messages containing request details.
                logger.LogWarning("Azure Translator returned HTTP {StatusCode}; client trace {TraceId}.",
                    (int)response.StatusCode, traceId);
                throw new TranslationException(response.StatusCode switch
                {
                    HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden => TranslationFailure.Configuration,
                    HttpStatusCode.TooManyRequests => TranslationFailure.RateLimit,
                    _ => TranslationFailure.Unavailable,
                });
            }

            using var document = await JsonDocument.ParseAsync(
                await response.Content.ReadAsStreamAsync(cancellationToken), cancellationToken: cancellationToken);
            var root = document.RootElement;
            if (root.ValueKind == JsonValueKind.Array && root.GetArrayLength() == 1
                && root[0].ValueKind == JsonValueKind.Object
                && root[0].TryGetProperty("translations", out var translations)
                && translations.ValueKind == JsonValueKind.Array)
            {
                foreach (var translation in translations.EnumerateArray())
                {
                    if (translation.ValueKind == JsonValueKind.Object
                        && translation.TryGetProperty("to", out var to) && to.ValueKind == JsonValueKind.String
                        && string.Equals(to.GetString(), targetLanguage, StringComparison.OrdinalIgnoreCase)
                        && translation.TryGetProperty("text", out var result) && result.ValueKind == JsonValueKind.String
                        && !string.IsNullOrWhiteSpace(result.GetString()))
                        return result.GetString()!;
                }
            }
            logger.LogError("Azure Translator response did not contain the requested translation; client trace {TraceId}.", traceId);
            throw new TranslationException(TranslationFailure.InvalidResponse);
        }
        catch (JsonException)
        {
            logger.LogError("Azure Translator returned invalid JSON; client trace {TraceId}.", traceId);
            throw new TranslationException(TranslationFailure.InvalidResponse);
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            logger.LogWarning("Azure Translator request timed out; client trace {TraceId}.", traceId);
            throw new TranslationException(TranslationFailure.Timeout);
        }
        catch (HttpRequestException)
        {
            logger.LogWarning("Azure Translator network request failed; client trace {TraceId}.", traceId);
            throw new TranslationException(TranslationFailure.Unavailable);
        }
    }
}
