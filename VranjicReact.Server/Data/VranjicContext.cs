using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Data
{
    public class VranjicContext : IdentityDbContext
    {
        public VranjicContext(DbContextOptions<VranjicContext> options)
            : base(options)
        {
        }

        public DbSet<News> News { get; set; } = default!;
        public DbSet<BlogPost> BlogPosts { get; set; } = default!;
        public DbSet<GalleryImage> GalleryImages { get; set; } = default!;
        public DbSet<ContactMessage> ContactMessages { get; set; } = default!;
    }
}
