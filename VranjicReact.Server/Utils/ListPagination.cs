namespace VranjicReact.Server.Utils;

/// <summary>Additive pagination metadata for legacy APIs whose response body remains an array.</summary>
public static class ListPagination
{
    public const string HasMoreHeader = "X-Has-More";
    public const int MaximumPage = 10000;

    public static bool IsValidPage(int page) => page is >= 1 and <= MaximumPage;

    // Queries fetch one extra row, after filtering and stable ordering, to avoid a separate COUNT query.
    public static void Complete<T>(HttpResponse response, List<T> rows, int pageSize)
    {
        response.Headers[HasMoreHeader] = rows.Count > pageSize ? "true" : "false";
        if (rows.Count > pageSize) rows.RemoveRange(pageSize, rows.Count - pageSize);
    }
}
