using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace VranjicReact.Server.Utils
{
    public static partial class SlugHelper
    {
        public static string GenerateSlug(string value)
        {
            if (string.IsNullOrWhiteSpace(value))
            {
                return Guid.NewGuid().ToString("n");
            }

            var normalized = value.Trim().ToLowerInvariant().Normalize(NormalizationForm.FormD);
            var builder = new StringBuilder(normalized.Length);

            foreach (var ch in normalized)
            {
                var unicodeCategory = CharUnicodeInfo.GetUnicodeCategory(ch);
                if (unicodeCategory == UnicodeCategory.NonSpacingMark)
                {
                    continue;
                }

                if (char.IsLetterOrDigit(ch))
                {
                    builder.Append(ch);
                }
                else if (char.IsWhiteSpace(ch) || ch == '-' || ch == '_')
                {
                    builder.Append('-');
                }
            }

            var collapsed = MultipleDashes().Replace(builder.ToString(), "-").Trim('-');

            return string.IsNullOrEmpty(collapsed) ? Guid.NewGuid().ToString("n") : collapsed;
        }

        [GeneratedRegex("-+")]
        private static partial Regex MultipleDashes();
    }
}
