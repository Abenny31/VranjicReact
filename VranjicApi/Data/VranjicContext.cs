using Microsoft.EntityFrameworkCore;
using VranjicApi.Models;

namespace VranjicApi.Data
{
    public class VranjicContext : DbContext
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
