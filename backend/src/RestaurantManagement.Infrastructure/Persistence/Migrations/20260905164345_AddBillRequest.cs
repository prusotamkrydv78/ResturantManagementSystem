using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBillRequest : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "BillRequestedAtUtc",
                table: "Orders",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_RestaurantId_BillRequestedAtUtc",
                table: "Orders",
                columns: new[] { "RestaurantId", "BillRequestedAtUtc" },
                filter: "[BillRequestedAtUtc] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_RestaurantId_BillRequestedAtUtc",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "BillRequestedAtUtc",
                table: "Orders");
        }
    }
}
