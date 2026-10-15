using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/moderation")]
public sealed class ModerationController(EditorialWorkflowService workflow, ModerationQueueService queue) : ControllerBase
{
    [HttpPost("translate")]
    [Authorize(Policy = PolicyNames.ContentCreate)]
    [RequestSizeLimit(128_000)]
    public async Task<ActionResult<TranslateResponse>> Translate(TranslateRequest request,
        [FromServices] ITranslationService translation, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Text)) return BadRequest("Unesite tekst za prijevod.");
        if (request.TargetLanguage == "hr") return BadRequest("Odaberite ciljni jezik različit od hrvatskog.");
        try
        {
            return Ok(new TranslateResponse(await translation.TranslateAsync(
                request.Text, request.SourceLanguage, request.TargetLanguage, cancellationToken)));
        }
        catch (TranslationException exception)
        {
            var (status, message) = exception.Failure switch
            {
                TranslationFailure.Configuration => (503, "Prijevod nije konfiguriran. Obratite se administratoru."),
                TranslationFailure.RateLimit => (429, "Dosegnuto je ograničenje prijevoda. Pokušajte ponovno kasnije."),
                TranslationFailure.Timeout => (504, "Prijevod je trajao predugo. Pokušajte ponovno."),
                _ => (502, "Servis za prijevod trenutačno nije dostupan. Pokušajte ponovno kasnije."),
            };
            return StatusCode(status, new { message });
        }
    }

    [HttpGet("queue")]
    [Authorize(Policy = PolicyNames.ContentModerate)]
    public async Task<ActionResult<IReadOnlyList<ModerationQueueItemDto>>> GetQueue(
        [FromQuery] int limit = 100, [FromQuery] int page = 1, CancellationToken cancellationToken = default)
    {
        if (!ListPagination.IsValidPage(page)) return BadRequest("Neispravna stranica.");
        var take = Math.Clamp(limit, 1, 200);
        var rows = await queue.GetAsync(User, page, take, cancellationToken);
        ListPagination.Complete(Response, rows, take);
        return Ok(rows);
    }

    [HttpPost("{contentType}/{id:int}/submit")]
    [Authorize(Policy = PolicyNames.ContentCreate)]
    public async Task<IActionResult> Submit(string contentType, int id, SubmitForReviewRequest request, CancellationToken ct) =>
        Result(await workflow.ExecuteAsync(contentType, id, EditorialOperation.Submit, request.RowVersion, User, ct));

    [HttpPost("{contentType}/{id:int}/decision")]
    [Authorize(Policy = PolicyNames.ContentModerate)]
    public async Task<IActionResult> Decide(string contentType, int id, ModerationDecisionRequest request, CancellationToken ct) =>
        Result(await workflow.ExecuteAsync(contentType, id, EditorialOperation.Decide, request.RowVersion, User, ct,
            decision: request.Decision, comment: request.Comment));

    [HttpPost("{contentType}/{id:int}/publish")]
    [Authorize(Policy = PolicyNames.ContentManage)]
    public async Task<IActionResult> Publish(string contentType, int id, PublishContentRequest request, CancellationToken ct) =>
        Result(await workflow.ExecuteAsync(contentType, id, EditorialOperation.Publish, request.RowVersion, User, ct,
            publishedAt: request.PublishedAt));

    [HttpPost("{contentType}/{id:int}/archive")]
    [Authorize(Policy = PolicyNames.ContentManage)]
    public async Task<IActionResult> Archive(string contentType, int id, SubmitForReviewRequest request, CancellationToken ct) =>
        Result(await workflow.ExecuteAsync(contentType, id, EditorialOperation.Archive, request.RowVersion, User, ct));

    [HttpGet("{contentType}/{id:int}/history")]
    [Authorize]
    public async Task<IActionResult> History(string contentType, int id, [FromQuery] int? beforeId, CancellationToken ct)
    {
        var content = await workflow.FindAsync(contentType, id, ct);
        if (content is null) return NotFound();
        if (!await workflow.CanPreviewAsync(User, content, ct)) return Forbid();
        return Ok(await workflow.GetHistoryAsync(contentType, id, beforeId, ct));
    }

    private IActionResult Result(WorkflowResult result) => result.StatusCode switch
    {
        204 => NoContent(), 403 => Forbid(), 404 => NotFound(),
        _ => StatusCode(result.StatusCode, result.Error),
    };
}
