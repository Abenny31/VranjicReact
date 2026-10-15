using System.Security.Claims;
using System.Net.Mail;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class ContactController : ControllerBase
    {
        private readonly VranjicContext _db;
        private readonly ILogger<ContactController> _logger;

        public ContactController(VranjicContext db, ILogger<ContactController> logger)
        {
            _db = db;
            _logger = logger;
        }

        [HttpPost]
        [AllowAnonymous]
        [EnableRateLimiting("contact-submissions")]
        [RequestSizeLimit(32 * 1024)]
        public async Task<IActionResult> Submit(SubmitContactRequest request, CancellationToken ct)
        {
            var name = request.Name?.Trim();
            var email = request.Email?.Trim();
            var message = request.Message?.Trim();

            if (string.IsNullOrWhiteSpace(name) || string.IsNullOrWhiteSpace(email) || string.IsNullOrWhiteSpace(message))
            {
                return BadRequest("Name, email and message are required.");
            }

            if (name.Length > 128 || email.Length > 256 || message.Length > 4096)
            {
                return BadRequest("Submitted values exceed the allowed length.");
            }

            try
            {
                var parsedEmail = new MailAddress(email);
                if (!string.Equals(parsedEmail.Address, email, StringComparison.OrdinalIgnoreCase))
                {
                    return BadRequest("Email is not valid.");
                }
            }
            catch (FormatException)
            {
                return BadRequest("Email is not valid.");
            }

            var entity = new ContactMessage
            {
                Name = name,
                Email = email,
                Message = message,
                SubmittedAt = DateTime.UtcNow,
            };

            _db.ContactMessages.Add(entity);
            await _db.SaveChangesAsync(ct);

            return AcceptedAtAction(nameof(GetMessages), new { id = entity.Id }, null);
        }

        [HttpGet("messages")]
        [Authorize(Policy = PolicyNames.ContactRead)]
        public async Task<ActionResult<IEnumerable<ContactMessageDto>>> GetMessages([FromQuery] ContactListQuery options, CancellationToken ct)
        {
            IQueryable<ContactMessage> query = _db.ContactMessages.AsNoTracking();

            if (options.Archived is bool archived)
            {
                query = query.Where(m => m.Archived == archived);
            }
            if (options.Processed is bool processed)
                query = query.Where(m => (m.ProcessedAt != null) == processed);
            var search = options.Search?.Trim();
            if (!string.IsNullOrEmpty(search))
                query = query.Where(m => m.Name.Contains(search) || m.Email.Contains(search) || m.Message.Contains(search));

            var items = await query
                .OrderByDescending(m => m.SubmittedAt)
                .ThenByDescending(m => m.Id)
                .Skip((options.Page - 1) * options.Limit).Take(options.Limit + 1)
                .Select(m => new ContactMessageDto(m.Id, m.Name, m.Email, m.Message, m.SubmittedAt, m.ProcessedAt, m.Archived))
                .ToListAsync(ct);
            ListPagination.Complete(Response, items, options.Limit);
            return Ok(items);
        }

        [HttpPost("{id:int}/process")]
        [Authorize(Policy = PolicyNames.ContactManage)]
        public async Task<IActionResult> MarkProcessed(int id, CancellationToken ct)
        {
            var entity = await _db.ContactMessages.FirstOrDefaultAsync(m => m.Id == id, ct);

            if (entity is null)
            {
                return NotFound();
            }

            entity.ProcessedAt = DateTime.UtcNow;
            entity.ProcessedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);

            await _db.SaveChangesAsync(ct);

            return NoContent();
        }

        [HttpPost("{id:int}/archive")]
        [Authorize(Policy = PolicyNames.ContactManage)]
        public async Task<IActionResult> ToggleArchive(int id, UpdateArchiveRequest request, CancellationToken ct)
        {
            var entity = await _db.ContactMessages.FirstOrDefaultAsync(m => m.Id == id, ct);

            if (entity is null)
            {
                return NotFound();
            }

            entity.Archived = request.Archived;

            if (!request.Archived)
            {
                entity.ProcessedAt = null;
                entity.ProcessedByUserId = null;
            }

            await _db.SaveChangesAsync(ct);

            return NoContent();
        }
    }
}
