using System.ComponentModel.DataAnnotations;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Contracts;

public sealed record TranslateRequest(
    [Required, StringLength(TranslationLimits.MaxTextLength)] string Text,
    [Required, RegularExpression("^hr$")] string SourceLanguage = "hr",
    [Required, RegularExpression("^[a-z]{2,3}(-[a-z0-9]{2,8})?$")] string TargetLanguage = "en");

public sealed record TranslateResponse(string Text);
