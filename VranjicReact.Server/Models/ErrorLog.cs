namespace VranjicReact.Server.Models;

public sealed class ErrorLog
{
    public long Id { get; set; }
    public DateTimeOffset CreatedAtUtc { get; set; }
    public string TraceId { get; set; } = string.Empty;
    public string RequestMethod { get; set; } = string.Empty;
    public string Path { get; set; } = string.Empty;
    // No foreign key: logging must also work for missing/deleted Identity users.
    public string? UserId { get; set; }
    public int StatusCode { get; set; }
    public string ExceptionType { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public string ExceptionDetails { get; set; } = string.Empty;
}
