using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VranjicReact.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddGalleryAlbums : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "GalleryAlbums",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Title = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(512)", maxLength: 512, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false, defaultValueSql: "GETUTCDATE()"),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_GalleryAlbums", x => x.Id);
                });

            migrationBuilder.AddColumn<int>(
                name: "AlbumId",
                table: "GalleryImages",
                type: "int",
                nullable: true);

            migrationBuilder.Sql(@"
SET IDENTITY_INSERT GalleryAlbums ON;
INSERT INTO GalleryAlbums (Id, Title, Description, CreatedAt, UpdatedAt)
SELECT Id, Title, Description, UploadedAt, UploadedAt
FROM GalleryImages;
SET IDENTITY_INSERT GalleryAlbums OFF;
");

            migrationBuilder.Sql(@"
UPDATE GalleryImages
SET AlbumId = Id;
");

            migrationBuilder.AlterColumn<int>(
                name: "AlbumId",
                table: "GalleryImages",
                type: "int",
                nullable: false,
                oldClrType: typeof(int),
                oldType: "int",
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_GalleryImages_AlbumId",
                table: "GalleryImages",
                column: "AlbumId");

            migrationBuilder.AddForeignKey(
                name: "FK_GalleryImages_GalleryAlbums_AlbumId",
                table: "GalleryImages",
                column: "AlbumId",
                principalTable: "GalleryAlbums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_GalleryImages_GalleryAlbums_AlbumId",
                table: "GalleryImages");

            migrationBuilder.DropTable(
                name: "GalleryAlbums");

            migrationBuilder.DropIndex(
                name: "IX_GalleryImages_AlbumId",
                table: "GalleryImages");

            migrationBuilder.DropColumn(
                name: "AlbumId",
                table: "GalleryImages");
        }
    }
}
