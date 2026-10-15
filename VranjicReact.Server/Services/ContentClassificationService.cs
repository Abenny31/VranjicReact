using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public sealed record ClassificationSelection(
    Area? Area,
    ContentTimePerspective? TimePerspective,
    IReadOnlyList<Tag> Tags,
    string? ValidationError)
{
    public bool IsValid => ValidationError is null;
}

public sealed class ContentClassificationService
{
    private readonly VranjicContext _db;

    public ContentClassificationService(VranjicContext db)
    {
        _db = db;
    }

    public async Task<ClassificationSelection> ResolveAsync(
        int? areaId,
        string? timePerspective,
        IReadOnlyList<int>? tagIds,
        CancellationToken cancellationToken)
    {
        Area? area = null;
        if (areaId is int requestedAreaId)
        {
            area = await _db.Areas.FirstOrDefaultAsync(candidate => candidate.Id == requestedAreaId, cancellationToken);
            if (area is null)
            {
                return Invalid("Odabrano područje ne postoji.");
            }
        }

        ContentTimePerspective? perspective = null;
        if (!string.IsNullOrWhiteSpace(timePerspective))
        {
            var requestedPerspective = timePerspective.Trim();
            if (!Enum.GetNames<ContentTimePerspective>().Contains(requestedPerspective, StringComparer.OrdinalIgnoreCase)
                || !Enum.TryParse<ContentTimePerspective>(requestedPerspective, true, out var parsedPerspective))
            {
                return Invalid("Vremenska perspektiva mora biti Jucer, Danas ili Sutra.");
            }

            perspective = parsedPerspective;
        }

        if (tagIds?.Any(id => id <= 0) == true)
        {
            return Invalid("Oznake moraju imati valjane identifikatore.");
        }

        var requestedTagIds = tagIds?
            .Distinct()
            .ToArray() ?? Array.Empty<int>();

        var tags = requestedTagIds.Length == 0
            ? new List<Tag>()
            : await _db.Tags
                .Where(tag => requestedTagIds.Contains(tag.Id))
                .OrderBy(tag => tag.Name)
                .ToListAsync(cancellationToken);

        if (tags.Count != requestedTagIds.Length)
        {
            return Invalid("Jedna ili više odabranih oznaka ne postoje.");
        }

        return new ClassificationSelection(area, perspective, tags, null);
    }

    private static ClassificationSelection Invalid(string message) =>
        new(null, null, Array.Empty<Tag>(), message);
}
