using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddTicketServing : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ServedAtUtc",
                table: "KitchenTickets",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ServedByStaffId",
                table: "KitchenTickets",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_KitchenTickets_RestaurantId_ServedAtUtc",
                table: "KitchenTickets",
                columns: new[] { "RestaurantId", "ServedAtUtc" },
                filter: "[ServedAtUtc] IS NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_KitchenTickets_Served",
                table: "KitchenTickets",
                sql: "([ServedAtUtc] IS NULL AND [ServedByStaffId] IS NULL) OR ([ServedAtUtc] IS NOT NULL AND [ServedByStaffId] IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_KitchenTickets_RestaurantId_ServedAtUtc",
                table: "KitchenTickets");

            migrationBuilder.DropCheckConstraint(
                name: "CK_KitchenTickets_Served",
                table: "KitchenTickets");

            migrationBuilder.DropColumn(
                name: "ServedAtUtc",
                table: "KitchenTickets");

            migrationBuilder.DropColumn(
                name: "ServedByStaffId",
                table: "KitchenTickets");
        }
    }
}
