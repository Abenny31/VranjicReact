using System.Security.Claims;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.Logging.Abstractions;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Services;

[TestClass]
public sealed class UserNicknameServiceTests
{
    [TestMethod]
    public async Task SetsAndReplacesNicknameWithoutChangingOtherClaimsOrLogin()
    {
        using var manager = new MemoryUserManager();
        manager.Claims.Add(new Claim("dfb:seed", "true"));
        var user = new IdentityUser { UserName = "user@example.test" };
        var service = new UserNicknameService(manager);
        Assert.IsTrue((await service.SetAsync(user, "  Ante  ")).Succeeded);
        Assert.AreEqual("Ante", UserNicknameService.Read(manager.Claims));
        Assert.IsTrue((await service.SetAsync(user, "Toni")).Succeeded);
        Assert.AreEqual("Toni", UserNicknameService.Read(manager.Claims));
        Assert.AreEqual(2, manager.Claims.Count);
        Assert.AreEqual("true", manager.Claims.Single(claim => claim.Type == "dfb:seed").Value);
        Assert.AreEqual("user@example.test", user.UserName);
    }

    [TestMethod]
    public async Task OmittedNicknamePreservesExistingValueAndEmptyClearsOnlyNickname()
    {
        using var manager = new MemoryUserManager();
        manager.Claims.Add(new Claim(UserNicknameService.ClaimType, "Ante"));
        manager.Claims.Add(new Claim("dfb:invitation", "true"));
        var service = new UserNicknameService(manager);
        var user = new IdentityUser();
        Assert.IsTrue((await service.SetAsync(user, null)).Succeeded);
        Assert.AreEqual("Ante", UserNicknameService.Read(manager.Claims));
        Assert.IsTrue((await service.SetAsync(user, "   ")).Succeeded);
        Assert.IsNull(UserNicknameService.Read(manager.Claims));
        Assert.AreEqual("dfb:invitation", manager.Claims.Single().Type);
    }

    [TestMethod]
    public async Task RejectsOversizedAndControlCharactersWithoutChangingClaims()
    {
        using var manager = new MemoryUserManager();
        manager.Claims.Add(new Claim(UserNicknameService.ClaimType, "Ante"));
        var service = new UserNicknameService(manager);
        foreach (var invalid in new[] { new string('a', 61), "Ante\nToni", "Ante\tToni", "Ante\0Toni" })
            Assert.IsFalse((await service.SetAsync(new IdentityUser(), invalid)).Succeeded);
        Assert.AreEqual("Ante", UserNicknameService.Read(manager.Claims));
        Assert.IsNull(UserNicknameService.Validate(new string('a', 60)));
    }

    [TestMethod]
    public async Task ReturnsStoreFailureInsteadOfReportingSuccess()
    {
        using var manager = new MemoryUserManager { FailWrites = true };
        var result = await new UserNicknameService(manager).SetAsync(new IdentityUser(), "Ante");
        Assert.IsFalse(result.Succeeded);
        Assert.AreEqual("StoreFailure", result.Errors.Single().Code);
        Assert.AreEqual(0, manager.Claims.Count);
    }

    // No EF context or database connection: only the UserManager claim operations used by the service.
    private sealed class MemoryUserManager() : UserManager<IdentityUser>(new UnusedStore(), Microsoft.Extensions.Options.Options.Create(new IdentityOptions()),
        new PasswordHasher<IdentityUser>(), [], [], new UpperInvariantLookupNormalizer(), new IdentityErrorDescriber(),
        null!, NullLogger<UserManager<IdentityUser>>.Instance)
    {
        public List<Claim> Claims { get; } = [];
        public bool FailWrites { get; init; }
        public override Task<IList<Claim>> GetClaimsAsync(IdentityUser user) => Task.FromResult<IList<Claim>>(Claims.ToList());
        public override Task<IdentityResult> AddClaimAsync(IdentityUser user, Claim claim) => Write(() => Claims.Add(claim));
        public override Task<IdentityResult> RemoveClaimsAsync(IdentityUser user, IEnumerable<Claim> claims) =>
            Write(() => { foreach (var claim in claims) Claims.Remove(claim); });
        public override Task<IdentityResult> ReplaceClaimAsync(IdentityUser user, Claim claim, Claim replacement) =>
            Write(() => { Claims.Remove(claim); Claims.Add(replacement); });
        private Task<IdentityResult> Write(Action action)
        {
            if (FailWrites) return Task.FromResult(IdentityResult.Failed(new IdentityError { Code = "StoreFailure" }));
            action(); return Task.FromResult(IdentityResult.Success);
        }
    }

    private sealed class UnusedStore : IUserStore<IdentityUser>
    {
        public void Dispose() { }
        public Task<string> GetUserIdAsync(IdentityUser user, CancellationToken ct) => throw new NotSupportedException();
        public Task<string?> GetUserNameAsync(IdentityUser user, CancellationToken ct) => throw new NotSupportedException();
        public Task SetUserNameAsync(IdentityUser user, string? name, CancellationToken ct) => throw new NotSupportedException();
        public Task<string?> GetNormalizedUserNameAsync(IdentityUser user, CancellationToken ct) => throw new NotSupportedException();
        public Task SetNormalizedUserNameAsync(IdentityUser user, string? name, CancellationToken ct) => throw new NotSupportedException();
        public Task<IdentityResult> CreateAsync(IdentityUser user, CancellationToken ct) => throw new NotSupportedException();
        public Task<IdentityResult> UpdateAsync(IdentityUser user, CancellationToken ct) => throw new NotSupportedException();
        public Task<IdentityResult> DeleteAsync(IdentityUser user, CancellationToken ct) => throw new NotSupportedException();
        public Task<IdentityUser?> FindByIdAsync(string id, CancellationToken ct) => throw new NotSupportedException();
        public Task<IdentityUser?> FindByNameAsync(string name, CancellationToken ct) => throw new NotSupportedException();
    }
}
