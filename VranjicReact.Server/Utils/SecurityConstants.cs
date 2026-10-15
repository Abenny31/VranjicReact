using System.Collections.Generic;

namespace VranjicReact.Server.Utils;

public static class RoleNames
{
    public const string SuperUser = "SuperUser";
    public const string Administrator = "Administrator";
    public const string Moderator = "Moderator";
    public const string Korisnik = "Korisnik";
    public const string Gost = "Gost";
    public const string Verifier = "Provjeravatelj";

    public static readonly IReadOnlyDictionary<string, string> IdMap = new Dictionary<string, string>
    {
        [SuperUser] = "1",
        [Administrator] = "2",
        [Moderator] = "5",
        [Korisnik] = "3",
        [Gost] = "4",
        [Verifier] = "6",
    };

    public static readonly string[] PortalAccess = [SuperUser, Administrator, Moderator, Korisnik];
    public static readonly string[] SelfService = [SuperUser, Administrator, Moderator, Korisnik, Verifier];
    public static readonly string[] ContentCreate = [SuperUser, Administrator, Moderator, Korisnik];
    public static readonly string[] ContentManage = [SuperUser, Administrator];
    public static readonly string[] ContentVerify = [SuperUser, Administrator, Verifier];
    public static readonly string[] ContentModerate = [SuperUser, Administrator, Moderator];
    public static readonly string[] UserManage = [SuperUser, Administrator];
}

public static class PolicyNames
{
    public const string PortalAccess = "PortalAccess";
    public const string SelfService = "SelfService";
    public const string ContentCreate = "ContentCreate";
    public const string ContentManage = "ContentManage";
    public const string ContentVerify = "ContentVerify";
    public const string ContentModerate = "ContentModerate";
    public const string ModeratorAssignmentManage = "ModeratorAssignmentManage";
    public const string ClassificationManage = "ClassificationManage";
    public const string UserRead = "UserRead";
    public const string UserCreate = "UserCreate";
    public const string UserApprove = "UserApprove";
    public const string UserUpdate = "UserUpdate";
    public const string UserDelete = "UserDelete";
    public const string ContactRead = "ContactRead";
    public const string ContactManage = "ContactManage";
}
