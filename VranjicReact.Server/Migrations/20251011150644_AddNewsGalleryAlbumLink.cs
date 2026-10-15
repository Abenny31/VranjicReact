using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VranjicReact.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddNewsGalleryAlbumLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "GalleryAlbumId",
                table: "News",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_News_GalleryAlbumId",
                table: "News",
                column: "GalleryAlbumId",
                unique: true,
                filter: "[GalleryAlbumId] IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "FK_News_GalleryAlbums_GalleryAlbumId",
                table: "News",
                column: "GalleryAlbumId",
                principalTable: "GalleryAlbums",
                principalColumn: "Id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_News_GalleryAlbums_GalleryAlbumId",
                table: "News");

            migrationBuilder.DropIndex(
                name: "IX_News_GalleryAlbumId",
                table: "News");

            migrationBuilder.DropColumn(
                name: "GalleryAlbumId",
                table: "News");
        }
    }
}
