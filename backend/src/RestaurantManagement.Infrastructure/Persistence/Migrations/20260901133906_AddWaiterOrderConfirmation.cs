using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddWaiterOrderConfirmation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_Source",
                table: "Orders");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ConfirmedAtUtc",
                table: "Orders",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "ConfirmedByStaffId",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_RestaurantId_ConfirmedAtUtc",
                table: "Orders",
                columns: new[] { "RestaurantId", "ConfirmedAtUtc" },
                filter: "[ConfirmedAtUtc] IS NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_Confirmation",
                table: "Orders",
                sql: "([ConfirmedAtUtc] IS NULL AND [ConfirmedByStaffId] IS NULL) OR ([ConfirmedAtUtc] IS NOT NULL AND [ConfirmedByStaffId] IS NOT NULL)");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_Source",
                table: "Orders",
                sql: "([Source] IN ('QrCode', 'Website') AND [CreatedByStaffId] IS NULL) OR ([Source] NOT IN ('QrCode', 'Website') AND [CreatedByStaffId] IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_RestaurantId_ConfirmedAtUtc",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_Confirmation",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_Source",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ConfirmedAtUtc",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ConfirmedByStaffId",
                table: "Orders");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_Source",
                table: "Orders",
                sql: "([Source] = 'QrCode' AND [CreatedByStaffId] IS NULL) OR ([Source] <> 'QrCode' AND [CreatedByStaffId] IS NOT NULL)");
        }
    }
}
