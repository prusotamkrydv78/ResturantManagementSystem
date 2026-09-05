using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddOrderSourceAudit : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PlacedFromIp",
                table: "Orders",
                type: "nvarchar(45)",
                maxLength: 45,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "PlacedFromIp",
                table: "Orders");
        }
    }
}
