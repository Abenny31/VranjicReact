using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public static class GalleryMediaValidation
{
    public const int MaximumBytes = 20 * 1024 * 1024;

    // Basic signature validation prevents serving HTML/SVG under a forged media type.
    // This is not a replacement for malware scanning/transcoding on a public upload service.
    public static bool IsSupported(GalleryMediaType type, string? contentType, ReadOnlySpan<byte> bytes)
    {
        if (bytes.IsEmpty || bytes.Length > MaximumBytes) return false;
        return (type, contentType?.ToLowerInvariant()) switch
        {
            (GalleryMediaType.Image, "image/png") => bytes.StartsWith(new byte[] { 137, 80, 78, 71, 13, 10, 26, 10 }),
            (GalleryMediaType.Image, "image/jpeg") => bytes.StartsWith(new byte[] { 255, 216, 255 }),
            (GalleryMediaType.Image, "image/gif") => bytes.StartsWith("GIF87a"u8) || bytes.StartsWith("GIF89a"u8),
            (GalleryMediaType.Image, "image/webp") => bytes.Length >= 12 && bytes.StartsWith("RIFF"u8) && bytes[8..].StartsWith("WEBP"u8),
            (GalleryMediaType.Video, "video/mp4") => bytes.Length >= 12 && bytes[4..].StartsWith("ftyp"u8),
            (GalleryMediaType.Video, "video/webm") => bytes.StartsWith(new byte[] { 26, 69, 223, 163 }),
            _ => false,
        };
    }
}
