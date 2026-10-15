using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace VranjicReact.Server.Migrations
{
    /// <inheritdoc />
    public partial class AddEditorialModerationWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "EditorialStatus",
                table: "News",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "News",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.AddColumn<string>(
                name: "EditorialStatus",
                table: "BlogPosts",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<byte[]>(
                name: "RowVersion",
                table: "BlogPosts",
                type: "rowversion",
                rowVersion: true,
                nullable: false,
                defaultValue: new byte[0]);

            migrationBuilder.Sql(
                "UPDATE [News] SET [EditorialStatus] = CASE WHEN [PublishedAt] IS NULL THEN N'Draft' ELSE N'Published' END WHERE [EditorialStatus] IS NULL;");

            migrationBuilder.Sql(
                "UPDATE [BlogPosts] SET [EditorialStatus] = CASE WHEN [PublishedAt] IS NULL THEN N'Draft' ELSE N'Published' END WHERE [EditorialStatus] IS NULL;");

            migrationBuilder.CreateTable(
                name: "AreaModeratorAssignments",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    UserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: false),
                    AreaId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    AssignedByUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    AssignedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EndsAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_AreaModeratorAssignments", x => x.Id);
                    table.ForeignKey(
                        name: "FK_AreaModeratorAssignments_Areas_AreaId",
                        column: x => x.AreaId,
                        principalTable: "Areas",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_AreaModeratorAssignments_AspNetUsers_AssignedByUserId",
                        column: x => x.AssignedByUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_AreaModeratorAssignments_AspNetUsers_UserId",
                        column: x => x.UserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "ContentModerationActions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    NewsId = table.Column<int>(type: "int", nullable: true),
                    BlogPostId = table.Column<int>(type: "int", nullable: true),
                    Action = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    PreviousStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    NewStatus = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: false),
                    ActorUserId = table.Column<string>(type: "nvarchar(450)", maxLength: 450, nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_ContentModerationActions", x => x.Id);
                    table.CheckConstraint("CK_ContentModerationActions_ExactlyOneContent", "(CASE WHEN [NewsId] IS NULL THEN 0 ELSE 1 END + CASE WHEN [BlogPostId] IS NULL THEN 0 ELSE 1 END) = 1");
                    table.ForeignKey(
                        name: "FK_ContentModerationActions_AspNetUsers_ActorUserId",
                        column: x => x.ActorUserId,
                        principalTable: "AspNetUsers",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.SetNull);
                    table.ForeignKey(
                        name: "FK_ContentModerationActions_BlogPosts_BlogPostId",
                        column: x => x.BlogPostId,
                        principalTable: "BlogPosts",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_ContentModerationActions_News_NewsId",
                        column: x => x.NewsId,
                        principalTable: "News",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_News_EditorialStatus",
                table: "News",
                column: "EditorialStatus");

            migrationBuilder.CreateIndex(
                name: "IX_BlogPosts_EditorialStatus",
                table: "BlogPosts",
                column: "EditorialStatus");

            migrationBuilder.CreateIndex(
                name: "IX_AreaModeratorAssignments_AreaId_IsActive_EndsAt",
                table: "AreaModeratorAssignments",
                columns: new[] { "AreaId", "IsActive", "EndsAt" });

            migrationBuilder.CreateIndex(
                name: "IX_AreaModeratorAssignments_AssignedByUserId",
                table: "AreaModeratorAssignments",
                column: "AssignedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_AreaModeratorAssignments_UserId_AreaId",
                table: "AreaModeratorAssignments",
                columns: new[] { "UserId", "AreaId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_ContentModerationActions_ActorUserId",
                table: "ContentModerationActions",
                column: "ActorUserId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentModerationActions_BlogPostId",
                table: "ContentModerationActions",
                column: "BlogPostId");

            migrationBuilder.CreateIndex(
                name: "IX_ContentModerationActions_CreatedAt",
                table: "ContentModerationActions",
                column: "CreatedAt");

            migrationBuilder.CreateIndex(
                name: "IX_ContentModerationActions_NewsId",
                table: "ContentModerationActions",
                column: "NewsId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "AreaModeratorAssignments");

            migrationBuilder.DropTable(
                name: "ContentModerationActions");

            migrationBuilder.DropIndex(
                name: "IX_News_EditorialStatus",
                table: "News");

            migrationBuilder.DropIndex(
                name: "IX_BlogPosts_EditorialStatus",
                table: "BlogPosts");

            migrationBuilder.DropColumn(
                name: "EditorialStatus",
                table: "News");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "News");

            migrationBuilder.DropColumn(
                name: "EditorialStatus",
                table: "BlogPosts");

            migrationBuilder.DropColumn(
                name: "RowVersion",
                table: "BlogPosts");
        }
    }
}
