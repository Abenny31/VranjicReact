using VranjicReact.Server.Contracts;

namespace VranjicReact.Server.Utils;

// Descriptions follow the same role groups used by server policies. Resource restrictions
// (ownership, active area assignment and content status) still apply to each operation.
public static class PublicRoleCatalog
{
    public static IReadOnlyList<PublicRoleDescription> Describe() =>
        new[] { RoleNames.Gost, RoleNames.Korisnik, RoleNames.Moderator, RoleNames.Verifier, RoleNames.Administrator }
            .Select(role => new PublicRoleDescription(role, Capabilities(role))).ToArray();

    private static IReadOnlyList<string> Capabilities(string role)
    {
        var result = new List<string> { "Pregled javno objavljenog sadržaja." };
        bool manager = RoleNames.ContentManage.Contains(role);
        if (RoleNames.ContentCreate.Contains(role))
        {
            result.Add(manager ? "Izrada i uređivanje sadržaja svih autora." : "Izrada vlastitih priča, obavijesti i galerija; uređivanje vlastitih nacrta i sadržaja vraćenog na doradu.");
            result.Add("Slanje pripremljenog sadržaja na pregled.");
        }
        if (RoleNames.ContentModerate.Contains(role))
            result.Add(manager ? "Pregled i moderiranje sadržaja drugih autora u svim područjima." : "Pregled, odobravanje, vraćanje na doradu i odbijanje poslanog sadržaja u aktivno dodijeljenim područjima. Ne odobrava vlastiti sadržaj.");
        if (RoleNames.ContentVerify.Contains(role))
            result.Add("Pregled priča i izvora, uključujući neobjavljene priče, te označavanje sadržaja kao dokumentiranog i provjerenog. Provjera sama ne objavljuje priču.");
        if (manager)
        {
            result.Add("Objavljivanje i arhiviranje sadržaja te upravljanje područjima, oznakama i dodjelama moderatora.");
            result.Add("Pregled i obrada poruka iz kontaktnog obrasca.");
        }
        if (RoleNames.UserManage.Contains(role))
            result.Add("Pregled i kreiranje korisničkih računa te brisanje nezaštićenih računa uz ograničenja za vlastiti račun i vlasnika sustava. Odobravanje računa i promjenu uloga obavlja vlasnik sustava.");
        if (RoleNames.SelfService.Contains(role)) result.Add("Promjena vlastite lozinke.");
        return result;
    }
}
