using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Data;
using VranjicReact.Server.Configuration;
using VranjicReact.Server.Services;
using VranjicReact.Server.Utils;
using System.Linq;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

var dotEnvLoadResult = DotEnvBootstrap.Load();
var builder = WebApplication.CreateBuilder(args);
builder.Services.AddConfiguredDataProtection(builder.Configuration, builder.Environment.ContentRootPath);

builder.Services.AddControllers(options => options.Filters.Add<ContentTranslationFilter>());
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
{
    throw new InvalidOperationException(
        "Database connection is not configured. Set ConnectionStrings:DefaultConnection in appsettings.json or host configuration.");
}

builder.Services.AddDbContext<VranjicContext>(options =>
    options.UseSqlServer(connectionString));

builder.Services.AddIdentityCore<IdentityUser>(options =>
    {
        options.Password.RequireDigit = true;
        options.Password.RequireLowercase = true;
        options.Password.RequireUppercase = false;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequiredLength = 6;
        options.SignIn.RequireConfirmedAccount = true;
    })
    .AddRoles<IdentityRole>()
    .AddSignInManager()
    .AddEntityFrameworkStores<VranjicContext>()
    .AddDefaultTokenProviders();

builder.Services.AddOptions<AccountEmailOptions>().BindConfiguration("AccountEmail")
    .Validate(options => options.IsValid(), "AccountEmail requires an HTTPS PublicBaseUrl and valid SMTP settings when enabled.")
    .ValidateOnStart();
builder.Services.AddOptions<PublicContactOptions>().BindConfiguration(PublicContactOptions.SectionName)
    .Validate(options => options.IsValid(), "PublicContact requires valid email addresses, a phone number and an HTTPS Facebook URL, or empty values.")
    .ValidateOnStart();
builder.Services.AddOptions<PublicDisplayOptions>().BindConfiguration(PublicDisplayOptions.SectionName)
    .Validate(options => options.IsValid(), "PublicDisplay must have a valid area count and contribution tag slugs.")
    .ValidateOnStart();
builder.Services.AddSingleton<IAccountEmailSender, AccountEmailSender>();
builder.Services.AddSingleton<IEmailSender<IdentityUser>>(services => services.GetRequiredService<IAccountEmailSender>());
builder.Services.AddScoped<AccountProtectionService>();
builder.Services.AddScoped<AccountInvitationService>();
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("contact-submissions", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 5, Window = TimeSpan.FromMinutes(10), QueueLimit = 0 }));
    options.AddPolicy("account-invitations", context => RateLimitPartition.GetFixedWindowLimiter(
        context.User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value
            ?? context.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
        _ => new FixedWindowRateLimiterOptions { PermitLimit = 20, Window = TimeSpan.FromMinutes(1), QueueLimit = 0 }));
});
builder.Services.AddScoped<ContentClassificationService>();
builder.Services.AddScoped<BlogContentValidationService>();
builder.Services.AddScoped<AreaModerationService>();
builder.Services.AddScoped<EditorialWorkflowService>();
builder.Services.AddScoped<UpdatesService>();
builder.Services.AddScoped<EditorialUpdatesService>();
builder.Services.AddScoped<ModerationQueueService>();
builder.Services.AddScoped<UserDirectoryService>();
builder.Services.AddScoped<UserNicknameService>();
builder.Services.AddScoped<MyContentService>();
builder.Services.AddScoped<ContentImageService>();
builder.Services.AddHttpClient<ITranslationService, AzureTranslationService>(client =>
    client.Timeout = TimeSpan.FromSeconds(30))
    .ConfigurePrimaryHttpMessageHandler(() => new HttpClientHandler { AllowAutoRedirect = false })
    .RedactLoggedHeaders(_ => true);
builder.Services.AddHealthChecks().AddCheck<DatabaseReadinessCheck>("database", tags: ["ready"]);

builder.Services.AddAuthentication()
    .AddBearerToken(IdentityConstants.BearerScheme);

builder.Services.AddAuthorizationBuilder()
    .AddPolicy(PolicyNames.PortalAccess, policy => policy.RequireRole(RoleNames.PortalAccess))
    .AddPolicy(PolicyNames.SelfService, policy => policy.RequireRole(RoleNames.SelfService))
    .AddPolicy(PolicyNames.ContentCreate, policy => policy.RequireRole(RoleNames.ContentCreate))
    .AddPolicy(PolicyNames.ContentManage, policy => policy.RequireRole(RoleNames.ContentManage))
    .AddPolicy(PolicyNames.ContentVerify, policy => policy.RequireRole(RoleNames.ContentVerify))
    .AddPolicy(PolicyNames.ContentModerate, policy => policy.RequireRole(RoleNames.ContentModerate))
    .AddPolicy(PolicyNames.ModeratorAssignmentManage, policy => policy.RequireRole(RoleNames.ContentManage))
    .AddPolicy(PolicyNames.ClassificationManage, policy => policy.RequireRole(RoleNames.ContentManage))
    .AddPolicy(PolicyNames.UserRead, policy => policy.RequireRole(RoleNames.UserManage))
    .AddPolicy(PolicyNames.UserCreate, policy => policy.RequireRole(RoleNames.UserManage))
    .AddPolicy(PolicyNames.UserApprove, policy => policy.RequireRole(RoleNames.SuperUser))
    .AddPolicy(PolicyNames.UserUpdate, policy => policy.RequireRole(RoleNames.SuperUser))
    .AddPolicy(PolicyNames.UserDelete, policy => policy.RequireRole(RoleNames.SuperUser, RoleNames.Administrator))
    .AddPolicy(PolicyNames.ContactRead, policy => policy.RequireRole(RoleNames.SuperUser, RoleNames.Administrator))
    .AddPolicy(PolicyNames.ContactManage, policy => policy.RequireRole(RoleNames.SuperUser, RoleNames.Administrator));

var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>()?
    .Where(origin => !string.IsNullOrWhiteSpace(origin))
    .Select(origin => origin.Trim().TrimEnd('/'))
    .Distinct(StringComparer.OrdinalIgnoreCase)
    .ToArray() ?? Array.Empty<string>();

if (allowedOrigins.Length > 0)
{
    builder.Services.AddCors(options =>
        options.AddPolicy("Frontend", policy =>
            policy.WithOrigins(allowedOrigins)
                  .AllowAnyHeader()
                  .AllowAnyMethod()
                  .WithExposedHeaders(ListPagination.HasMoreHeader)));
}

var app = builder.Build();

if (dotEnvLoadResult.IsLoaded)
{
    app.Logger.LogInformation(
        ".env configuration loaded from {DotEnvSource}; existing host environment variables kept their values.",
        dotEnvLoadResult.Source);
}

if (!app.Environment.IsDevelopment() && string.IsNullOrWhiteSpace(app.Configuration["AllowedHosts"]))
{
    throw new InvalidOperationException(
        "AllowedHosts is not configured. Set AllowedHosts in appsettings.json or host configuration for non-development environments.");
}

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.Logger.LogInformation("CONTENTROOT={contentRoot}  WEBROOT={webRoot}",
    app.Environment.ContentRootPath, app.Environment.WebRootPath);

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}
//app.UseHttpsRedirection();

if (allowedOrigins.Length > 0)
{
    app.UseCors("Frontend");
}
app.UseAuthentication();
app.UseAuthorization();
app.UseRateLimiter();

app.UseDefaultFiles();
app.UseStaticFiles();

app.MapGroup("").AddEndpointFilter<IdentityAccessFilter>().MapIdentityApi<IdentityUser>()
    .Add(endpoint =>
    {
        if (endpoint is RouteEndpointBuilder route && route.RoutePattern.RawText is "/forgotPassword" or "/resendConfirmationEmail")
            endpoint.Metadata.Add(new EnableRateLimitingAttribute("account-invitations"));
    });
app.MapControllers();
app.MapHealthChecks("/health/live", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = _ => false,
});
app.MapHealthChecks("/health/ready", new Microsoft.AspNetCore.Diagnostics.HealthChecks.HealthCheckOptions
{
    Predicate = check => check.Tags.Contains("ready"),
});
app.MapFallbackToFile("index.html");

// Seed only when explicitly requested via configuration.
var seedFlag = app.Configuration.GetSection("SeedAdminUser").GetValue<bool?>("Enabled");
if (seedFlag == true)
{
    app.Logger.LogInformation("SeedAdminUser.Enabled=true detected; executing startup seeding.");
    try
    {
        await EnsureRolesAsync(app.Services);
        await EnsureSuperUserAsync(app.Services, app.Configuration);
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Startup seeding failed");
    }
}
else
{
    app.Logger.LogInformation("Startup seeding skipped (SeedAdminUser.Enabled {state}).", seedFlag.HasValue ? seedFlag.ToString() : "not set");
}

// Upgrade existing seeded accounts too, even after startup seeding was disabled.
if (!string.IsNullOrWhiteSpace(app.Configuration["SeedAdminUser:Email"]))
{
    using var scope = app.Services.CreateScope();
    var users = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();
    var seedUser = await users.FindByEmailAsync(app.Configuration["SeedAdminUser:Email"]!.Trim());
    if (seedUser is not null && await users.IsInRoleAsync(seedUser, RoleNames.SuperUser))
        await scope.ServiceProvider.GetRequiredService<AccountProtectionService>().MarkSeedAsync(seedUser);
}

app.Run();

static async Task EnsureRolesAsync(IServiceProvider services)
{
    using var scope = services.CreateScope();
    var roleManager = scope.ServiceProvider.GetRequiredService<RoleManager<IdentityRole>>();

    foreach (var (roleName, roleId) in RoleNames.IdMap)
    {
        if (!await roleManager.RoleExistsAsync(roleName))
        {
            var role = new IdentityRole
            {
                Id = roleId,
                Name = roleName,
                NormalizedName = roleName.ToUpperInvariant(),
            };
            await roleManager.CreateAsync(role);
        }
    }
}

static async Task EnsureSuperUserAsync(IServiceProvider services, IConfiguration configuration)
{
    var superUserEmail = configuration["SeedAdminUser:Email"];
    var superUserPassword = configuration["SeedAdminUser:Password"];

    if (string.IsNullOrWhiteSpace(superUserEmail) || string.IsNullOrWhiteSpace(superUserPassword))
    {
        return;
    }

    using var scope = services.CreateScope();
    var userManager = scope.ServiceProvider.GetRequiredService<UserManager<IdentityUser>>();

    var user = await userManager.FindByEmailAsync(superUserEmail);

    if (user is null)
    {
        user = new IdentityUser
        {
            UserName = superUserEmail,
            Email = superUserEmail,
            EmailConfirmed = true,
        };

        var createResult = await userManager.CreateAsync(user, superUserPassword);

        if (!createResult.Succeeded)
        {
            var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
            var details = string.Join(", ", createResult.Errors.Select(e => e.Description));
            logger.LogError("Unable to create seed super user: {details}", details);
            return; // Do not crash the app in production if seeding fails
        }
    }

    if (!await userManager.IsInRoleAsync(user, RoleNames.SuperUser))
    {
        await userManager.AddToRoleAsync(user, RoleNames.SuperUser);
    }

    if (!await userManager.IsInRoleAsync(user, RoleNames.Administrator))
    {
        await userManager.AddToRoleAsync(user, RoleNames.Administrator);
    }

    await scope.ServiceProvider.GetRequiredService<AccountProtectionService>().MarkSeedAsync(user);

    // ensure legacy Admin role holders retain access if role still exists
    if (await userManager.IsInRoleAsync(user, "Admin"))
    {
        await userManager.RemoveFromRoleAsync(user, "Admin");
    }
}

public partial class Program;
