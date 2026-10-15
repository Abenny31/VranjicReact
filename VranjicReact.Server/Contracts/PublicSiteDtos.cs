namespace VranjicReact.Server.Contracts;

public record PublicDisplayDto(int InitialAreaCount,
    IReadOnlyDictionary<string, string[]> AreaTagSlugs,
    IReadOnlyDictionary<string, string[]> ContentTagSlugs);
public record PublicRoleDescription(string Name, IReadOnlyList<string> Capabilities);
