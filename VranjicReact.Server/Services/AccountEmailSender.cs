using System.Net;
using System.Net.Mail;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Options;
using VranjicReact.Server.Configuration;

namespace VranjicReact.Server.Services;

public interface IAccountEmailSender : IEmailSender<IdentityUser>
{
    Task SendInvitationAsync(string email, string link, CancellationToken ct);
}

public sealed class AccountEmailSender(IOptions<AccountEmailOptions> options) : IAccountEmailSender
{
    public Task SendInvitationAsync(string email, string link, CancellationToken ct) =>
        SendAsync(email, "Pozivnica za DFB", $"Pozvani ste na DFB. Postavite svoju lozinku putem poveznice:\n{link}\n\nPoveznica vrijedi 24 sata. Ako pozivnicu niste očekivali, zanemarite ovu poruku.", ct);

    public Task SendConfirmationLinkAsync(IdentityUser user, string email, string confirmationLink) =>
        SendAsync(email, "Potvrda e-mail adrese", $"Potvrdite svoju e-mail adresu:\n{WebUtility.HtmlDecode(confirmationLink)}", CancellationToken.None);

    public Task SendPasswordResetLinkAsync(IdentityUser user, string email, string resetLink) =>
        SendAsync(email, "Promjena lozinke", $"Postavite novu lozinku:\n{WebUtility.HtmlDecode(resetLink)}", CancellationToken.None);

    public Task SendPasswordResetCodeAsync(IdentityUser user, string email, string resetCode) =>
        SendAsync(email, "Promjena lozinke", $"Kod za promjenu lozinke:\n{WebUtility.HtmlDecode(resetCode)}\n\nAko niste zatražili promjenu, zanemarite ovu poruku.", CancellationToken.None);

    private async Task SendAsync(string email, string subject, string body, CancellationToken ct)
    {
        var settings = options.Value;
        if (!settings.Enabled) throw new InvalidOperationException("Slanje e-maila nije omogućeno.");
        using var message = new MailMessage(new MailAddress(settings.FromAddress, settings.FromName), new MailAddress(email))
        {
            Subject = subject, Body = body, IsBodyHtml = false,
        };
        // STARTTLS is mandatory. Credentials and links must never be logged.
        using var client = new SmtpClient(settings.Host, settings.Port)
        {
            EnableSsl = true,
            Credentials = new NetworkCredential(settings.UserName, settings.Password),
        };
        using var timeout = CancellationTokenSource.CreateLinkedTokenSource(ct);
        timeout.CancelAfter(TimeSpan.FromSeconds(30));
        await client.SendMailAsync(message, timeout.Token);
    }
}
