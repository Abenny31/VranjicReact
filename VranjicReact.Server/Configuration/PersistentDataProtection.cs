using Microsoft.AspNetCore.DataProtection;

namespace VranjicReact.Server.Configuration;

internal static class PersistentDataProtection
{
    public static IServiceCollection AddConfiguredDataProtection(this IServiceCollection services,
        IConfiguration configuration, string contentRoot)
    {
        var directory = configuration["DataProtection:KeyDirectory"];
        var applicationName = configuration["DataProtection:ApplicationName"];
        // Preserve the host's existing defaults unless explicitly configured.
        if (string.IsNullOrWhiteSpace(directory) && string.IsNullOrWhiteSpace(applicationName)) return services;
        if (string.IsNullOrWhiteSpace(directory) || string.IsNullOrWhiteSpace(applicationName))
            throw new InvalidOperationException("Set both DataProtection__KeyDirectory and DataProtection__ApplicationName, or leave both unset.");

        if (!Path.IsPathFullyQualified(directory))
            throw new InvalidOperationException("DataProtection__KeyDirectory must be an absolute path outside the application directory.");
        var fullDirectory = Path.GetFullPath(directory);
        var root = Path.GetFullPath(contentRoot).TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar);
        if (string.Equals(fullDirectory.TrimEnd(Path.DirectorySeparatorChar, Path.AltDirectorySeparatorChar), root, StringComparison.OrdinalIgnoreCase)
            || fullDirectory.StartsWith(root + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase)
            || string.Equals(fullDirectory, Path.GetPathRoot(fullDirectory), StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("DataProtection__KeyDirectory must be a dedicated private directory outside the application directory.");
        if (!Directory.Exists(fullDirectory))
            throw new InvalidOperationException("DataProtection__KeyDirectory must already exist and be writable by the application's Windows identity.");
        if (!OperatingSystem.IsWindows())
            throw new InvalidOperationException("Configured persistent key protection currently requires Windows DPAPI. Leave both settings unset to use hosting defaults on other platforms.");

        services.AddDataProtection()
            .SetApplicationName(applicationName.Trim())
            .PersistKeysToFileSystem(new DirectoryInfo(fullDirectory))
            // Current-user protection, never machine-wide decryption for other hosted applications.
            .ProtectKeysWithDpapi();
        return services;
    }
}
