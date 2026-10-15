using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging.Abstractions;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Services;

[TestClass]
public sealed class AzureTranslationServiceTests
{
    private const string Success = """[{"translations":[{"text":"Hello, world!","to":"en"}]}]""";

    [TestMethod]
    public async Task Success_SendsRegionalHeadersAndPlainText_ParsesEnglish()
    {
        using var handler = new StubHandler(async (request, ct) =>
        {
            Assert.AreEqual(HttpMethod.Post, request.Method);
            Assert.AreEqual("https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&from=hr&to=en&textType=plain", request.RequestUri?.ToString());
            Assert.AreEqual("test-placeholder-key", request.Headers.GetValues("Ocp-Apim-Subscription-Key").Single());
            Assert.AreEqual("test-region", request.Headers.GetValues("Ocp-Apim-Subscription-Region").Single());
            Assert.AreEqual("application/json", request.Content?.Headers.ContentType?.MediaType);
            using var body = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(ct));
            Assert.AreEqual("Pozdrav, svijete!", body.RootElement[0].GetProperty("Text").GetString());
            return Response(HttpStatusCode.OK, Success);
        });
        using var client = new HttpClient(handler);
        Assert.AreEqual("Hello, world!", await Service(client).TranslateAsync("Pozdrav, svijete!", "hr", "en"));
        Assert.AreEqual(1, handler.Calls);
    }

    [TestMethod]
    [DataRow("")]
    [DataRow("   ")]
    public async Task EmptyText_DoesNotCallAzure(string text)
    {
        using var handler = new StubHandler((_, _) => Task.FromResult(Response(HttpStatusCode.OK, Success)));
        using var client = new HttpClient(handler);
        await Assert.ThrowsAsync<ArgumentException>(() => Service(client).TranslateAsync(text, "hr", "en"));
        Assert.AreEqual(0, handler.Calls);
    }

    [TestMethod]
    public async Task OversizedTextAndUnsupportedLanguages_DoNotCallAzure()
    {
        using var handler = new StubHandler((_, _) => Task.FromResult(Response(HttpStatusCode.OK, Success)));
        using var client = new HttpClient(handler);
        await Assert.ThrowsAsync<ArgumentException>(() => Service(client).TranslateAsync(new string('a', 10001), "hr", "en"));
        await Assert.ThrowsAsync<ArgumentException>(() => Service(client).TranslateAsync("Text", "en", "hr"));
        Assert.AreEqual(0, handler.Calls);
    }

    [TestMethod]
    [DataRow("Key", null)]
    [DataRow("Key", " ")]
    [DataRow("Region", null)]
    [DataRow("Region", " ")]
    [DataRow("Region", "invalid\r\nheader")]
    [DataRow("Endpoint", "http://example.test")]
    [DataRow("Endpoint", "not-a-url")]
    public async Task MissingOrInvalidConfiguration_DoesNotCallAzure(string setting, string? value)
    {
        using var handler = new StubHandler((_, _) => Task.FromResult(Response(HttpStatusCode.OK, Success)));
        using var client = new HttpClient(handler);
        var exception = await Assert.ThrowsAsync<TranslationException>(() => Service(client, setting, value).TranslateAsync("Tekst", "hr", "en"));
        Assert.AreEqual(TranslationFailure.Configuration, exception.Failure);
        Assert.AreEqual(0, handler.Calls);
    }

    [TestMethod]
    [DataRow(401, TranslationFailure.Configuration)]
    [DataRow(403, TranslationFailure.Configuration)]
    [DataRow(429, TranslationFailure.RateLimit)]
    [DataRow(500, TranslationFailure.Unavailable)]
    [DataRow(503, TranslationFailure.Unavailable)]
    [DataRow(400, TranslationFailure.Unavailable)]
    public async Task AzureError_IsMappedWithoutLeakingBody(int status, TranslationFailure expected)
    {
        using var client = new HttpClient(new StubHandler((_, _) => Task.FromResult(Response((HttpStatusCode)status, "sensitive provider response"))));
        var exception = await Assert.ThrowsAsync<TranslationException>(() => Service(client).TranslateAsync("Tekst", "hr", "en"));
        Assert.AreEqual(expected, exception.Failure);
        Assert.AreEqual("Translation failed.", exception.Message);
    }

    [TestMethod]
    [DataRow("not json")]
    [DataRow("null")]
    [DataRow("[]")]
    [DataRow("[{}]")]
    [DataRow("[{\"translations\":[{\"text\":\"Text\",\"to\":\"de\"}]}]")]
    [DataRow("[{\"translations\":[{\"text\":42,\"to\":\"en\"}]}]")]
    public async Task InvalidResponse_IsRejected(string json)
    {
        using var client = new HttpClient(new StubHandler((_, _) => Task.FromResult(Response(HttpStatusCode.OK, json))));
        var exception = await Assert.ThrowsAsync<TranslationException>(() => Service(client).TranslateAsync("Tekst", "hr", "en"));
        Assert.AreEqual(TranslationFailure.InvalidResponse, exception.Failure);
    }

    [TestMethod]
    public async Task NetworkAndTimeout_AreMapped()
    {
        using var network = new HttpClient(new StubHandler((_, _) => throw new HttpRequestException("private detail")));
        var failure = await Assert.ThrowsAsync<TranslationException>(() => Service(network).TranslateAsync("Tekst", "hr", "en"));
        Assert.AreEqual(TranslationFailure.Unavailable, failure.Failure);
        using var timeout = new HttpClient(new StubHandler((_, _) => throw new TaskCanceledException()));
        failure = await Assert.ThrowsAsync<TranslationException>(() => Service(timeout).TranslateAsync("Tekst", "hr", "en"));
        Assert.AreEqual(TranslationFailure.Timeout, failure.Failure);
    }

    [TestMethod]
    public async Task CallerCancellation_IsPropagated()
    {
        using var cancellation = new CancellationTokenSource();
        using var client = new HttpClient(new StubHandler((_, ct) =>
        {
            cancellation.Cancel();
            ct.ThrowIfCancellationRequested();
            return Task.FromResult(Response(HttpStatusCode.OK, Success));
        }));
        await Assert.ThrowsAsync<OperationCanceledException>(() => Service(client).TranslateAsync("Tekst", "hr", "en", cancellation.Token));
    }

    [TestMethod]
    public async Task AnotherLanguage_UsesRequestedTargetAndCaseInsensitiveResponseCode()
    {
        using var client = new HttpClient(new StubHandler((request, _) =>
        {
            StringAssert.Contains(request.RequestUri?.Query, "to=zh-hans");
            return Task.FromResult(Response(HttpStatusCode.OK, """[{"translations":[{"text":"测试","to":"zh-Hans"}]}]"""));
        }));
        Assert.AreEqual("测试", await Service(client).TranslateAsync("Tekst", "hr", "zh-hans"));
    }

    private static AzureTranslationService Service(HttpClient client, string? setting = null, string? value = null)
    {
        var settings = new Dictionary<string, string?>
        {
            ["AzureTranslator:Key"] = "test-placeholder-key",
            ["AzureTranslator:Region"] = "test-region",
        };
        if (setting is not null) settings["AzureTranslator:" + setting] = value;
        return new(client, new ConfigurationBuilder().AddInMemoryCollection(settings).Build(), NullLogger<AzureTranslationService>.Instance);
    }

    private static HttpResponseMessage Response(HttpStatusCode status, string body) => new(status) { Content = new StringContent(body) };

    private sealed class StubHandler(Func<HttpRequestMessage, CancellationToken, Task<HttpResponseMessage>> send) : HttpMessageHandler
    {
        public int Calls { get; private set; }
        protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            Calls++;
            return send(request, cancellationToken);
        }
    }
}
