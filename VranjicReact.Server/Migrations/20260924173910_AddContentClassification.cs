using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VranjicReact.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddContentClassification : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "AreaId",
                table: "News",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TimePerspective",
                table: "News",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "AreaId",
                table: "GalleryAlbums",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "TimePerspective",
                table: "GalleryAlbums",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Areas",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ShortDescription = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    Description = table.Column<string>(type: "nvarchar(max)", nullable: true),
                    CoverImageUrl = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    SortOrder = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Areas", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Tags",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Slug = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Tags", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "GalleryAlbumTags",
                columns: table => new
                {
                    GalleryAlbumId = table.Column<int>(type: "int", nullable: false),
                    TagId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GalleryAlbumTags", x => new { x.GalleryAlbumId, x.TagId });
                    table.ForeignKey(
                        name: "FK_GalleryAlbumTags_GalleryAlbums_GalleryAlbumId",
                        column: x => x.GalleryAlbumId,
                        principalTable: "GalleryAlbums",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_GalleryAlbumTags_Tags_TagId",
                        column: x => x.TagId,
                        principalTable: "Tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "NewsTags",
                columns: table => new
                {
                    NewsId = table.Column<int>(type: "int", nullable: false),
                    TagId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_NewsTags", x => new { x.NewsId, x.TagId });
                    table.ForeignKey(
                        name: "FK_NewsTags_News_NewsId",
                        column: x => x.NewsId,
                        principalTable: "News",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_NewsTags_Tags_TagId",
                        column: x => x.TagId,
                        principalTable: "Tags",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_News_AreaId",
                table: "News",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_News_TimePerspective",
                table: "News",
                column: "TimePerspective");

            migrationBuilder.CreateIndex(
                name: "IX_GalleryAlbums_AreaId",
                table: "GalleryAlbums",
                column: "AreaId");

            migrationBuilder.CreateIndex(
                name: "IX_GalleryAlbums_TimePerspective",
                table: "GalleryAlbums",
                column: "TimePerspective");

            migrationBuilder.CreateIndex(
                name: "IX_Areas_IsActive_SortOrder",
                table: "Areas",
                columns: new[] { "IsActive", "SortOrder" });

            migrationBuilder.CreateIndex(
                name: "IX_Areas_Slug",
                table: "Areas",
                column: "Slug",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_GalleryAlbumTags_TagId",
                table: "GalleryAlbumTags",
                column: "TagId");

            migrationBuilder.CreateIndex(
                name: "IX_NewsTags_TagId",
                table: "NewsTags",
                column: "TagId");

            migrationBuilder.CreateIndex(
                name: "IX_Tags_IsActive_Name",
                table: "Tags",
                columns: new[] { "IsActive", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_Tags_Slug",
                table: "Tags",
                column: "Slug",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "FK_GalleryAlbums_Areas_AreaId",
                table: "GalleryAlbums",
                column: "AreaId",
                principalTable: "Areas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_News_Areas_AreaId",
                table: "News",
                column: "AreaId",
                principalTable: "Areas",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GalleryAlbums_Areas_AreaId",
                table: "GalleryAlbums");

            migrationBuilder.DropForeignKey(
                name: "FK_News_Areas_AreaId",
                table: "News");

            migrationBuilder.DropTable(
                name: "Areas");

            migrationBuilder.DropTable(
                name: "GalleryAlbumTags");

            migrationBuilder.DropTable(
                name: "NewsTags");

            migrationBuilder.DropTable(
                name: "Tags");

            migrationBuilder.DropIndex(
                name: "IX_News_AreaId",
                table: "News");

            migrationBuilder.DropIndex(
                name: "IX_News_TimePerspective",
                table: "News");

            migrationBuilder.DropIndex(
                name: "IX_GalleryAlbums_AreaId",
                table: "GalleryAlbums");

            migrationBuilder.DropIndex(
                name: "IX_GalleryAlbums_TimePerspective",
                table: "GalleryAlbums");

            migrationBuilder.DropColumn(
                name: "AreaId",
                table: "News");

            migrationBuilder.DropColumn(
                name: "TimePerspective",
                table: "News");

            migrationBuilder.DropColumn(
                name: "AreaId",
                table: "GalleryAlbums");

            migrationBuilder.DropColumn(
                name: "TimePerspective",
                table: "GalleryAlbums");
        }
    }
}
