using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddRestaurantSubdomain : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "Subdomain",
                table: "Restaurants",
                type: "nvarchar(63)",
                maxLength: 63,
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "IX_Restaurants_Subdomain",
                table: "Restaurants",
                column: "Subdomain",
                unique: true,
                filter: "[Subdomain] IS NOT NULL");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Restaurants_Subdomain",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "Subdomain",
                table: "Restaurants");
        }
    }
}
