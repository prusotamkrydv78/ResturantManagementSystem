using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class GuardGuestOrderPerTable : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "IX_Orders_TableId_OpenGuestOrder",
                table: "Orders",
                column: "TableId",
                unique: true,
                filter: "[Status] = 'Open' AND [Source] <> 'Staff'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_TableId_OpenGuestOrder",
                table: "Orders");
        }
    }
}
