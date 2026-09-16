using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddSiteAndMedia : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "SiteImages");

            migrationBuilder.DropPrimaryKey(
                name: "PK_RestaurantSites",
                table: "RestaurantSites");

            migrationBuilder.DropIndex(
                name: "IX_RestaurantSites_IsPublished",
                table: "RestaurantSites");

            migrationBuilder.DropIndex(
                name: "IX_RestaurantSites_RestaurantId",
                table: "RestaurantSites");

            migrationBuilder.DropColumn(
                name: "Id",
                table: "RestaurantSites");

            migrationBuilder.DropColumn(
                name: "Template",
                table: "RestaurantSites");

            migrationBuilder.RenameColumn(
                name: "ContentJson",
                table: "RestaurantSites",
                newName: "DraftJson");

            migrationBuilder.AlterColumn<bool>(
                name: "IsPublished",
                table: "RestaurantSites",
                type: "bit",
                nullable: false,
                oldClrType: typeof(bool),
                oldType: "bit",
                oldDefaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "Design",
                table: "RestaurantSites",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AddColumn<string>(
                name: "PublishedDesign",
                table: "RestaurantSites",
                type: "nvarchar(40)",
                maxLength: 40,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PublishedJson",
                table: "RestaurantSites",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddPrimaryKey(
                name: "PK_RestaurantSites",
                table: "RestaurantSites",
                column: "RestaurantId");

            migrationBuilder.CreateTable(
                name: "RestaurantMedia",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    ByteCount = table.Column<int>(type: "int", nullable: false),
                    Content = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_RestaurantMedia", x => x.Id);
                    table.ForeignKey(
                        name: "FK_RestaurantMedia_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RestaurantSites_IsPublished",
                table: "RestaurantSites",
                column: "IsPublished");

            migrationBuilder.CreateIndex(
                name: "IX_RestaurantMedia_RestaurantId_CreatedAtUtc",
                table: "RestaurantMedia",
                columns: new[] { "RestaurantId", "CreatedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "RestaurantMedia");

            migrationBuilder.DropPrimaryKey(
                name: "PK_RestaurantSites",
                table: "RestaurantSites");

            migrationBuilder.DropIndex(
                name: "IX_RestaurantSites_IsPublished",
                table: "RestaurantSites");

            migrationBuilder.DropColumn(
                name: "Design",
                table: "RestaurantSites");

            migrationBuilder.DropColumn(
                name: "PublishedDesign",
                table: "RestaurantSites");

            migrationBuilder.DropColumn(
                name: "PublishedJson",
                table: "RestaurantSites");

            migrationBuilder.RenameColumn(
                name: "DraftJson",
                table: "RestaurantSites",
                newName: "ContentJson");

            migrationBuilder.AlterColumn<bool>(
                name: "IsPublished",
                table: "RestaurantSites",
                type: "bit",
                nullable: false,
                defaultValue: false,
                oldClrType: typeof(bool),
                oldType: "bit");

            migrationBuilder.AddColumn<Guid>(
                name: "Id",
                table: "RestaurantSites",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"));

            migrationBuilder.AddColumn<int>(
                name: "Template",
                table: "RestaurantSites",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddPrimaryKey(
                name: "PK_RestaurantSites",
                table: "RestaurantSites",
                column: "Id");

            migrationBuilder.CreateTable(
                name: "SiteImages",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantSiteId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ByteCount = table.Column<int>(type: "int", nullable: false),
                    Content = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    ContentType = table.Column<string>(type: "nvarchar(64)", maxLength: 64, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    FileName = table.Column<string>(type: "nvarchar(128)", maxLength: 128, nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_SiteImages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_SiteImages_RestaurantSites_RestaurantSiteId",
                        column: x => x.RestaurantSiteId,
                        principalTable: "RestaurantSites",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_RestaurantSites_IsPublished",
                table: "RestaurantSites",
                column: "IsPublished",
                filter: "[IsPublished] = 1");

            migrationBuilder.CreateIndex(
                name: "IX_RestaurantSites_RestaurantId",
                table: "RestaurantSites",
                column: "RestaurantId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_SiteImages_RestaurantId",
                table: "SiteImages",
                column: "RestaurantId");

            migrationBuilder.CreateIndex(
                name: "IX_SiteImages_RestaurantSiteId",
                table: "SiteImages",
                column: "RestaurantSiteId");
        }
    }
}
