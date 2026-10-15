using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Contracts;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Controllers;

[ApiController]
[Route("api/moderator-assignments")]
[Authorize(Policy = PolicyNames.ModeratorAssignmentManage)]
public sealed class AreaModeratorAssignmentsController(
    VranjicContext db,
    UserManager<IdentityUser> userManager) : ControllerBase
{
    [HttpGet]
    public async Task<ActionResult<IReadOnlyList<AreaModeratorAssignmentDto>>> GetAll(
        [FromQuery] ModeratorAssignmentListQuery options,
        CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var query = from assignment in db.AreaModeratorAssignments.AsNoTracking()
                    join user in db.Users on assignment.UserId equals user.Id into users
                    from user in users.DefaultIfEmpty()
                    select new { Assignment = assignment, Email = user == null ? assignment.UserId : user.Email ?? user.UserName ?? user.Id };
        if (options.AreaId is int areaId) query = query.Where(row => row.Assignment.AreaId == areaId);
        var search = options.Search?.Trim();
        if (!string.IsNullOrEmpty(search))
            query = query.Where(row => row.Email.Contains(search) || row.Assignment.Area.Name.Contains(search));
        query = options.Status switch
        {
            "active" => query.Where(row => row.Assignment.IsActive && (!row.Assignment.EndsAt.HasValue || row.Assignment.EndsAt > now)),
            "expired" => query.Where(row => row.Assignment.IsActive && row.Assignment.EndsAt <= now),
            "inactive" => query.Where(row => !row.Assignment.IsActive),
            _ => query,
        };
        var items = await query.OrderBy(row => row.Assignment.Area.SortOrder).ThenBy(row => row.Assignment.Area.Name)
            .ThenBy(row => row.Assignment.UserId).ThenBy(row => row.Assignment.Id)
            .Skip((options.Page - 1) * options.Limit).Take(options.Limit + 1)
            .Select(row => new AreaModeratorAssignmentDto(row.Assignment.Id, row.Assignment.UserId, row.Email,
                new AreaReferenceDto(row.Assignment.Area.Id, row.Assignment.Area.Name, row.Assignment.Area.Slug),
                row.Assignment.IsActive, row.Assignment.AssignedAt, row.Assignment.EndsAt,
                !row.Assignment.IsActive ? "Inactive" : row.Assignment.EndsAt <= now ? "Expired" : "Active"))
            .ToListAsync(cancellationToken);
        ListPagination.Complete(Response, items, options.Limit);
        return Ok(items);
    }

    [HttpPost]
    public async Task<ActionResult<AreaModeratorAssignmentDto>> Upsert(
        UpsertAreaModeratorAssignmentRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.UserId) || request.AreaId <= 0)
        {
            return BadRequest("Korisnik i područje su obavezni.");
        }

        var user = await userManager.FindByIdAsync(request.UserId);
        if (user is null)
        {
            return BadRequest("Odabrani korisnik ne postoji.");
        }

        if (!await userManager.IsInRoleAsync(user, RoleNames.Moderator))
        {
            return BadRequest("Korisnik mora imati ulogu Moderator prije dodjele područja.");
        }

        var area = await db.Areas.FirstOrDefaultAsync(
            candidate => candidate.Id == request.AreaId && candidate.IsActive,
            cancellationToken);
        if (area is null)
        {
            return BadRequest("Odabrano aktivno područje ne postoji.");
        }

        var endsAt = request.EndsAt?.ToUniversalTime();
        if (endsAt.HasValue && endsAt <= DateTime.UtcNow)
        {
            return BadRequest("Završetak dodjele mora biti u budućnosti.");
        }

        var assignment = await db.AreaModeratorAssignments.FirstOrDefaultAsync(
            candidate => candidate.UserId == request.UserId && candidate.AreaId == request.AreaId,
            cancellationToken);
        var created = assignment is null;
        if (assignment is null)
        {
            assignment = new AreaModeratorAssignment
            {
                UserId = request.UserId,
                AreaId = request.AreaId,
            };
            db.AreaModeratorAssignments.Add(assignment);
        }

        assignment.Area = area;
        assignment.IsActive = true;
        assignment.EndsAt = endsAt;
        assignment.AssignedAt = DateTime.UtcNow;
        assignment.AssignedByUserId = User.FindFirstValue(ClaimTypes.NameIdentifier);
        await db.SaveChangesAsync(cancellationToken);

        var dto = ToDto(assignment, user.Email ?? user.UserName ?? user.Id);
        return created
            ? CreatedAtAction(nameof(GetAll), dto)
            : Ok(dto);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> Deactivate(int id, CancellationToken cancellationToken)
    {
        var assignment = await db.AreaModeratorAssignments.FirstOrDefaultAsync(
            candidate => candidate.Id == id,
            cancellationToken);
        if (assignment is null)
        {
            return NotFound();
        }

        assignment.IsActive = false;
        await db.SaveChangesAsync(cancellationToken);
        return NoContent();
    }

    private static AreaModeratorAssignmentDto ToDto(
        AreaModeratorAssignment assignment,
        string email) =>
        new(
            assignment.Id,
            assignment.UserId,
            email,
            new AreaReferenceDto(assignment.Area.Id, assignment.Area.Name, assignment.Area.Slug),
            assignment.IsActive,
            assignment.AssignedAt,
            assignment.EndsAt,
            !assignment.IsActive ? "Inactive" : assignment.EndsAt <= DateTime.UtcNow ? "Expired" : "Active");
}
