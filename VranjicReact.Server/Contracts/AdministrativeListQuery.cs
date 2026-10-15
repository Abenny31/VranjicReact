using System.ComponentModel.DataAnnotations;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Contracts;

public class AdministrativeListQuery
{
    [Range(1, ListPagination.MaximumPage)]
    public int Page { get; init; } = 1;

    [Range(1, 200)]
    public int Limit { get; init; } = 100;

    [StringLength(200)]
    public string? Search { get; init; }
}

public sealed class UserListQuery : AdministrativeListQuery
{
    public bool? EmailConfirmed { get; init; }

    [StringLength(64)]
    public string? Role { get; init; }
}

public sealed class ContactListQuery : AdministrativeListQuery
{
    public bool? Archived { get; init; }
    public bool? Processed { get; init; }
}

public sealed class ModeratorAssignmentListQuery : AdministrativeListQuery
{
    [Range(1, int.MaxValue)]
    public int? AreaId { get; init; }

    [RegularExpression("^(all|active|expired|inactive)$")]
    public string Status { get; init; } = "all";
}

public sealed class GalleryItemListQuery : AdministrativeListQuery
{
    [Range(1, int.MaxValue)]
    public int? AlbumId { get; init; }
    public bool ImagesOnly { get; init; }

    public GalleryItemListQuery() { Limit = 200; }
}
