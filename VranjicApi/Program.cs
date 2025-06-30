using Microsoft.EntityFrameworkCore;
using VranjicApi.Data;
using VranjicApi.Models;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddDbContext<VranjicContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

var app = builder.Build();

app.UseHttpsRedirection();

app.MapGet("/novosti", async (VranjicContext db) => await db.News.ToListAsync());
app.MapPost("/novosti", async (News news, VranjicContext db) => { db.News.Add(news); await db.SaveChangesAsync(); return Results.Created($"/novosti/{news.Id}", news); });

app.MapGet("/blog", async (VranjicContext db) => await db.BlogPosts.ToListAsync());
app.MapPost("/blog", async (BlogPost post, VranjicContext db) => { db.BlogPosts.Add(post); await db.SaveChangesAsync(); return Results.Created($"/blog/{post.Id}", post); });

app.MapGet("/galerija", async (VranjicContext db) => await db.GalleryImages.ToListAsync());
app.MapPost("/galerija", async (GalleryImage img, VranjicContext db) => { db.GalleryImages.Add(img); await db.SaveChangesAsync(); return Results.Created($"/galerija/{img.Id}", img); });

app.MapPost("/kontakt", async (ContactMessage msg, VranjicContext db) => { db.ContactMessages.Add(msg); await db.SaveChangesAsync(); return Results.Created($"/kontakt/{msg.Id}", msg); });

app.Run();
