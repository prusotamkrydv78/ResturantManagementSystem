using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddReviews : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Reviews",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Rating = table.Column<int>(type: "int", nullable: false),
                    FoodRating = table.Column<int>(type: "int", nullable: true),
                    ServiceRating = table.Column<int>(type: "int", nullable: true),
                    Comment = table.Column<string>(type: "nvarchar(1000)", maxLength: 1000, nullable: true),
                    SubmittedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reviews", x => x.Id);
                    table.CheckConstraint("CK_Reviews_Ratings", "[Rating] BETWEEN 1 AND 5 AND ([FoodRating] IS NULL OR [FoodRating] BETWEEN 1 AND 5) AND ([ServiceRating] IS NULL OR [ServiceRating] BETWEEN 1 AND 5)");
                    table.ForeignKey(
                        name: "FK_Reviews_Orders_OrderId_RestaurantId",
                        columns: x => new { x.OrderId, x.RestaurantId },
                        principalTable: "Orders",
                        principalColumns: new[] { "Id", "RestaurantId" });
                    table.ForeignKey(
                        name: "FK_Reviews_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_OrderId",
                table: "Reviews",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_OrderId_RestaurantId",
                table: "Reviews",
                columns: new[] { "OrderId", "RestaurantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Reviews_RestaurantId_SubmittedAtUtc",
                table: "Reviews",
                columns: new[] { "RestaurantId", "SubmittedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Reviews");
        }
    }
}
