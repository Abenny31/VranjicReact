namespace VranjicReact.Server.Models;

// Shared workflow contract, not an EF inheritance hierarchy: existing tables stay intact.
public interface IEditorialContent
{
    int Id { get; }
    int? AreaId { get; }
    string? CreatedByUserId { get; }
    EditorialStatus? EditorialStatus { get; set; }
    DateTime? PublishedAt { get; set; }
    DateTime? UpdatedAt { get; set; }
    byte[] RowVersion { get; }
}
