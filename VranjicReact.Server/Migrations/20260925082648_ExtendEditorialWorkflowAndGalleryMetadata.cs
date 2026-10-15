using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VranjicReact.Server.Migrations
{
    /// <inheritdoc />
    public partial class ExtendEditorialWorkflowAndGalleryMetadata : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_ContentModerationActions_ExactlyOneContent",
                table: "ContentModerationActions");

            migrationBuilder.AddColumn<string>(
                name: "CreatedByUserId",
                table: "GalleryAlbums",
                type: "nvarchar(450)",
                maxLength: 450,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EditorialStatus",
                table: "GalleryAlbums",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<DateOnly>(
                name: "EventDate",
                table: "GalleryAlbums",
                type: "date",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Photographer",
                table: "GalleryAlbums",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PublishedAt",
                table: "GalleryAlbums",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "GalleryAlbums",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<int>(
                name: "AnnouncementId",
                table: "ContentModerationActions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "GalleryAlbumId",
                table: "ContentModerationActions",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "EditorialStatus",
                table: "Announcements",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "Announcements",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.CreateIndex(
                name: "IX_GalleryAlbums_CreatedByUserId",
                table: "GalleryAlbums",
                column: "CreatedByUserId");

            // Existing albums were public. Preserve visibility without inventing event dates or authors.
            migrationBuilder.Sql("UPDATE [GalleryAlbums] SET [EditorialStatus] = N'Published', [PublishedAt] = [CreatedAt] WHERE [EditorialStatus] IS NULL;");
            migrationBuilder.Sql("UPDATE [Announcements] SET [EditorialStatus] = CASE WHEN [PublishedAt] IS NULL THEN N'Draft' ELSE N'Published' END WHERE [EditorialStatus] IS NULL;");

            migrationBuilder.CreateIndex(
                name: "IX_GalleryAlbums_EditorialStatus",
                table: "GalleryAlbums",
                column: "EditorialStatus");

            migrationBuilder.CreateIndex(
                name: "IX_GalleryAlbums_EventDate",
                table: "GalleryAlbums",
                column: "EventDate");

            migrationBuilder.CreateIndex(
                name: "IX_ContentModerationActions_AnnouncementId",
                table: "ContentModerationActions",
                column: "AnnouncementId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentModerationActions_GalleryAlbumId",
                table: "ContentModerationActions",
                column: "GalleryAlbumId");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ContentModerationActions_ExactlyOneContent",
                table: "ContentModerationActions",
                sql: "(CASE WHEN [NewsId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [BlogPostId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [AnnouncementId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [GalleryAlbumId] IS NULL THEN 0 ELSE 1 END) = 1");

            migrationBuilder.CreateIndex(
                name: "IX_Announcements_EditorialStatus",
                table: "Announcements",
                column: "EditorialStatus");

            migrationBuilder.AddForeignKey(
                name: "FK_ContentModerationActions_Announcements_AnnouncementId",
                table: "ContentModerationActions",
                column: "AnnouncementId",
                principalTable: "Announcements",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_ContentModerationActions_GalleryAlbums_GalleryAlbumId",
                table: "ContentModerationActions",
                column: "GalleryAlbumId",
                principalTable: "GalleryAlbums",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);

            migrationBuilder.AddForeignKey(
                name: "FK_GalleryAlbums_AspNetUsers_CreatedByUserId",
                table: "GalleryAlbums",
                column: "CreatedByUserId",
                principalTable: "AspNetUsers",
                principalColumn: "Id",
                onDelete: ReferentialAction.Restrict);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                IF EXISTS (SELECT 1 FROM [ContentModerationActions] WHERE [AnnouncementId] IS NOT NULL OR [GalleryAlbumId] IS NOT NULL)
                    THROW 51000, 'Rollback would lose moderation history. Restore the pre-deployment backup instead.', 1;
                IF EXISTS (SELECT 1 FROM [GalleryAlbums] WHERE [EditorialStatus] <> N'Published' OR [PublishedAt] > GETUTCDATE())
                    THROW 51001, 'Rollback would expose private albums. Restore the pre-deployment backup instead.', 1;
                """);
            migrationBuilder.DropForeignKey(
                name: "FK_ContentModerationActions_Announcements_AnnouncementId",
                table: "ContentModerationActions");

            migrationBuilder.DropForeignKey(
                name: "FK_ContentModerationActions_GalleryAlbums_GalleryAlbumId",
                table: "ContentModerationActions");

            migrationBuilder.DropForeignKey(
                name: "FK_GalleryAlbums_AspNetUsers_CreatedByUserId",
                table: "GalleryAlbums");

            migrationBuilder.DropIndex(
                name: "IX_GalleryAlbums_CreatedByUserId",
                table: "GalleryAlbums");

            migrationBuilder.DropIndex(
                name: "IX_GalleryAlbums_EditorialStatus",
                table: "GalleryAlbums");

            migrationBuilder.DropIndex(
                name: "IX_GalleryAlbums_EventDate",
                table: "GalleryAlbums");

            migrationBuilder.DropIndex(
                name: "IX_ContentModerationActions_AnnouncementId",
                table: "ContentModerationActions");

            migrationBuilder.DropIndex(
                name: "IX_ContentModerationActions_GalleryAlbumId",
                table: "ContentModerationActions");

            migrationBuilder.DropCheckConstraint(
                name: "CK_ContentModerationActions_ExactlyOneContent",
                table: "ContentModerationActions");

            migrationBuilder.DropIndex(
                name: "IX_Announcements_EditorialStatus",
                table: "Announcements");

            migrationBuilder.DropColumn(
                name: "CreatedByUserId",
                table: "GalleryAlbums");

            migrationBuilder.DropColumn(
                name: "EditorialStatus",
                table: "GalleryAlbums");

            migrationBuilder.DropColumn(
                name: "EventDate",
                table: "GalleryAlbums");

            migrationBuilder.DropColumn(
                name: "Photographer",
                table: "GalleryAlbums");

            migrationBuilder.DropColumn(
                name: "PublishedAt",
                table: "GalleryAlbums");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "GalleryAlbums");

            migrationBuilder.DropColumn(
                name: "AnnouncementId",
                table: "ContentModerationActions");

            migrationBuilder.DropColumn(
                name: "GalleryAlbumId",
                table: "ContentModerationActions");

            migrationBuilder.DropColumn(
                name: "EditorialStatus",
                table: "Announcements");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "Announcements");

            migrationBuilder.AddCheckConstraint(
                name: "CK_ContentModerationActions_ExactlyOneContent",
                table: "ContentModerationActions",
                sql: "(CASE WHEN [NewsId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [BlogPostId] IS NULL THEN 0 ELSE 1 END) = 1");
        }
    }
}
