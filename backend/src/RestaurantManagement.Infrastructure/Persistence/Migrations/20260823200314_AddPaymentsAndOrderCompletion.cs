using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPaymentsAndOrderCompletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "CompletedAtUtc",
                table: "Orders",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "Payments",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Amount = table.Column<decimal>(type: "decimal(18,2)", precision: 18, scale: 2, nullable: false),
                    Method = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    RecordedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecordedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Payments", x => x.Id);
                    table.CheckConstraint("CK_Payments_Amount", "[Amount] >= 0");
                    table.ForeignKey(
                        name: "FK_Payments_Orders_OrderId_RestaurantId",
                        columns: x => new { x.OrderId, x.RestaurantId },
                        principalTable: "Orders",
                        principalColumns: new[] { "Id", "RestaurantId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_Orders_RestaurantId_CompletedAtUtc",
                table: "Orders",
                columns: new[] { "RestaurantId", "CompletedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrderId",
                table: "Payments",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrderId_RestaurantId",
                table: "Payments",
                columns: new[] { "OrderId", "RestaurantId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_RestaurantId_Method",
                table: "Payments",
                columns: new[] { "RestaurantId", "Method" });

            migrationBuilder.CreateIndex(
                name: "IX_Payments_RestaurantId_RecordedAtUtc",
                table: "Payments",
                columns: new[] { "RestaurantId", "RecordedAtUtc" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Orders_RestaurantId_CompletedAtUtc",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "CompletedAtUtc",
                table: "Orders");
        }
    }
}
