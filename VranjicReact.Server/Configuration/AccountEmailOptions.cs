using System.Net.Mail;

namespace VranjicReact.Server.Configuration;

public sealed class AccountEmailOptions
{
    public bool Enabled { get; set; }
    public string PublicBaseUrl { get; set; } = string.Empty;
    public string Host { get; set; } = string.Empty;
    public int Port { get; set; } = 587;
    public string UserName { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string FromAddress { get; set; } = string.Empty;
    public string FromName { get; set; } = "DFB";

    public bool IsValid() => !Enabled ||
        (Uri.TryCreate(PublicBaseUrl, UriKind.Absolute, out var uri)
         && uri.Scheme == Uri.UriSchemeHttps && string.IsNullOrEmpty(uri.UserInfo)
         && string.IsNullOrEmpty(uri.Query) && string.IsNullOrEmpty(uri.Fragment)
         && !string.IsNullOrWhiteSpace(Host) && Port is > 0 and <= 65535
         && !string.IsNullOrWhiteSpace(UserName) && !string.IsNullOrWhiteSpace(Password)
         && MailAddress.TryCreate(FromAddress, out var address) && address.Address == FromAddress);
}
