using System.Security.Claims;
using System.Text;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public sealed class DatabaseErrorLoggingMiddleware(
    RequestDelegate next,
    ErrorLogRedactor redactor,
    ILogger<DatabaseErrorLoggingMiddleware> logger)
{
    public async Task InvokeAsync(HttpContext context, IErrorLogWriter writer)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            // A client disconnect is not an application failure.
            throw;
        }
        catch (Exception exception) when (exception is not BadHttpRequestException { StatusCode: < 500 })
        {
            var entry = CreateEntry(context, exception);
            // Never pass the original exception to a logger: its message may contain credentials.
            logger.LogError("Unhandled request failure {TraceId}: {ExceptionDetails}", entry.TraceId, entry.ExceptionDetails);
            try
            {
                // Keep logging bounded and independent of client cancellation.
                using var timeout = new CancellationTokenSource(TimeSpan.FromSeconds(5));
                await writer.WriteAsync(entry, timeout.Token);
            }
            catch (Exception loggingException)
            {
                logger.LogError("ErrorLog write failed for {TraceId}: {ExceptionType} {Message}",
                    entry.TraceId, loggingException.GetType().FullName, redactor.Sanitize(loggingException.Message, 4000));
            }

            // Once headers/body were sent, let the server terminate the incomplete response.
            if (context.Response.HasStarted) throw;
            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            await context.Response.WriteAsJsonAsync(new
            {
                message = "Dogodila se pogreška na serveru. Pokušajte ponovno.",
                traceId = entry.TraceId
            }, context.RequestAborted);
        }
    }

    private ErrorLog CreateEntry(HttpContext context, Exception exception)
    {
        var details = new StringBuilder();
        var pending = new Stack<Exception>();
        pending.Push(exception);
        var count = 0;
        while (pending.TryPop(out var current) && count++ < 8)
        {
            details.AppendLine(redactor.Sanitize($"{current.GetType().FullName} (0x{current.HResult:X8}): {current.Message}", 4000));
            details.AppendLine(redactor.Sanitize(current.StackTrace, 8000));
            if (current is AggregateException aggregate)
            {
                foreach (var inner in aggregate.InnerExceptions.Take(8).Reverse()) pending.Push(inner);
            }
            else if (current.InnerException is not null) pending.Push(current.InnerException);
        }

        // Prefer the route template so user-supplied route values are not recorded.
        var route = (context.GetEndpoint() as RouteEndpoint)?.RoutePattern.RawText ?? context.Request.Path.Value;
        return new ErrorLog
        {
            CreatedAtUtc = DateTimeOffset.UtcNow,
            TraceId = redactor.Sanitize(context.TraceIdentifier, 128),
            RequestMethod = redactor.Sanitize(context.Request.Method, 16),
            Path = redactor.Sanitize(route, 1024),
            UserId = context.User.Identity?.IsAuthenticated == true
                ? redactor.Sanitize(context.User.FindFirstValue(ClaimTypes.NameIdentifier), 450) : null,
            StatusCode = StatusCodes.Status500InternalServerError,
            ExceptionType = redactor.Sanitize(exception.GetType().FullName, 512),
            Message = redactor.Sanitize(exception.Message, 4000),
            ExceptionDetails = details.Length <= 32768 ? details.ToString() : details.ToString(0, 32768)
        };
    }
}
