using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class RemoveRestaurantTimeZoneSettings : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Restaurants_DayStartHour",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "DayStartHour",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "TimeZoneId",
                table: "Restaurants");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<int>(
                name: "DayStartHour",
                table: "Restaurants",
                type: "int",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "TimeZoneId",
                table: "Restaurants",
                type: "nvarchar(64)",
                maxLength: 64,
                nullable: false,
                defaultValue: "UTC");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Restaurants_DayStartHour",
                table: "Restaurants",
                sql: "[DayStartHour] >= 0 AND [DayStartHour] <= 23");
        }
    }
}
