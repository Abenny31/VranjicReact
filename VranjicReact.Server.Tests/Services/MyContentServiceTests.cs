using System.Reflection;
using System.Security.Claims;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Controllers;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;

namespace VranjicReact.Server.Tests.Services;

[TestClass]
public sealed class MyContentServiceTests
{
    [TestMethod]
    public void OwnContentQuery_TranslatesWithOwnerFilterInEveryBranchAndPaging()
    {
        using var db = ContentImageServiceTests.Context();
        var service = new MyContentService(db, new AreaModerationService(db));
        // Compiles SQL only; no connection or command execution.
        var sql = service.BuildQuery("account-123").OrderByDescending(row => row.LastChangedAt)
            .ThenBy(row => row.ContentType).ThenByDescending(row => row.Id).Skip(20).Take(21).ToQueryString();
        Assert.AreEqual(4, Regex.Matches(sql, @"WHERE .*\[CreatedByUserId\] = @").Count);
        StringAssert.Contains(sql, "UNION ALL");
        StringAssert.Contains(sql, "OFFSET");
        StringAssert.Contains(sql, "FETCH NEXT");
        Assert.IsFalse(sql.Contains("[Body]") || sql.Contains("[Data]"));
    }

    [TestMethod]
    public async Task Endpoint_RequiresCreatorPolicyIdentityAndValidPage()
    {
        Assert.AreEqual(PolicyNames.ContentCreate, typeof(MyContentController).GetCustomAttribute<AuthorizeAttribute>()?.Policy);
        using var db = ContentImageServiceTests.Context();
        var controller = new MyContentController(new(db, new(db))) {
            ControllerContext = new() { HttpContext = new DefaultHttpContext() } };
        Assert.IsInstanceOfType<UnauthorizedResult>((await controller.Get()).Result);
        controller.HttpContext.User = new(new ClaimsIdentity([new Claim(ClaimTypes.NameIdentifier, "owner")], "test"));
        Assert.IsInstanceOfType<BadRequestObjectResult>((await controller.Get(0)).Result);
        Assert.IsInstanceOfType<BadRequestObjectResult>((await controller.Get(10001)).Result);
    }
}
