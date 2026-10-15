namespace VranjicReact.Server.Contracts
{
    public record SubmitContactRequest(
        string Name,
        string Email,
        string Message);

    public record ContactMessageDto(
        int Id,
        string Name,
        string Email,
        string Message,
        DateTime SubmittedAt,
        DateTime? ProcessedAt,
        bool Archived);

    public record UpdateArchiveRequest(bool Archived);
}
