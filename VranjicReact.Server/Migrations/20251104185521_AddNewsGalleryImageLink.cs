using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VranjicReact.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddNewsGalleryImageLink : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_News_GalleryAlbumId",
                table: "News");

            migrationBuilder.AddColumn<int>(
                name: "GalleryImageId",
                table: "News",
                type: "int",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_News_GalleryAlbumId",
                table: "News",
                column: "GalleryAlbumId",
                filter: "[GalleryAlbumId] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_News_GalleryImageId",
                table: "News",
                column: "GalleryImageId");

            migrationBuilder.AddForeignKey(
                name: "FK_News_GalleryImages_GalleryImageId",
                table: "News",
                column: "GalleryImageId",
                principalTable: "GalleryImages",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_News_GalleryImages_GalleryImageId",
                table: "News");

            migrationBuilder.DropIndex(
                name: "IX_News_GalleryAlbumId",
                table: "News");

            migrationBuilder.DropIndex(
                name: "IX_News_GalleryImageId",
                table: "News");

            migrationBuilder.DropColumn(
                name: "GalleryImageId",
                table: "News");

            migrationBuilder.CreateIndex(
                name: "IX_News_GalleryAlbumId",
                table: "News",
                column: "GalleryAlbumId",
                unique: true,
                filter: "[GalleryAlbumId] IS NOT NULL");
        }
    }
}
