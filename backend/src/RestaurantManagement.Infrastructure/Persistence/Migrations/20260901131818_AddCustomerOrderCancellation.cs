using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerOrderCancellation : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_Cancellation",
                table: "Orders");

            migrationBuilder.AddColumn<string>(
                name: "PublicCancelKey",
                table: "Orders",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PublicCancelKey",
                table: "Orders",
                column: "PublicCancelKey",
                unique: true,
                filter: "[PublicCancelKey] IS NOT NULL");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_Cancellation",
                table: "Orders",
                sql: "([Status] = 'Cancelled' AND [CancelledAtUtc] IS NOT NULL AND [CancellationReason] IS NOT NULL) OR ([Status] <> 'Cancelled' AND [CancelledAtUtc] IS NULL AND [CancelledByUserId] IS NULL AND [CancellationReason] IS NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_PublicCancelKey",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_Cancellation",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "PublicCancelKey",
                table: "Orders");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_Cancellation",
                table: "Orders",
                sql: "([Status] = 'Cancelled' AND [CancelledAtUtc] IS NOT NULL AND [CancelledByUserId] IS NOT NULL AND [CancellationReason] IS NOT NULL) OR ([Status] <> 'Cancelled' AND [CancelledAtUtc] IS NULL AND [CancelledByUserId] IS NULL AND [CancellationReason] IS NULL)");
        }
    }
}
