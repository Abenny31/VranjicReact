using System.Net.Mail;
using System.Text.RegularExpressions;

namespace VranjicReact.Server.Configuration;

public sealed class PublicContactOptions
{
    public const string SectionName = "PublicContact";

    public string Address { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string SupportEmail { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string FacebookUrl { get; set; } = string.Empty;

    public bool IsValid() => Address.Length <= 300
        && IsEmailOrEmpty(Email) && IsEmailOrEmpty(SupportEmail)
        && (string.IsNullOrWhiteSpace(Phone) || Regex.IsMatch(Phone.Trim(), @"^\+?[0-9][0-9 ()/.-]{2,39}$"))
        && (string.IsNullOrWhiteSpace(FacebookUrl) ||
            (FacebookUrl.Length <= 2048 && Uri.TryCreate(FacebookUrl.Trim(), UriKind.Absolute, out var uri)
             && uri.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(uri.UserInfo)));

    private static bool IsEmailOrEmpty(string value) => string.IsNullOrWhiteSpace(value) ||
        (value.Length <= 254 && !value.Any(char.IsControl)
         && MailAddress.TryCreate(value.Trim(), out var address) && address.Address == value.Trim());
}
