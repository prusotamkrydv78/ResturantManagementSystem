using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RenamePublicOrderKey : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_PublicCancelKey",
                table: "Orders");

            migrationBuilder.RenameColumn(
                name: "PublicCancelKey",
                table: "Orders",
                newName: "PublicOrderKey");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PublicOrderKey",
                table: "Orders",
                column: "PublicOrderKey",
                unique: true,
                filter: "[PublicOrderKey] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Orders_PublicOrderKey",
                table: "Orders");

            migrationBuilder.RenameColumn(
                name: "PublicOrderKey",
                table: "Orders",
                newName: "PublicCancelKey");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_PublicCancelKey",
                table: "Orders",
                column: "PublicCancelKey",
                unique: true,
                filter: "[PublicCancelKey] IS NOT NULL");
        }
    }
}
