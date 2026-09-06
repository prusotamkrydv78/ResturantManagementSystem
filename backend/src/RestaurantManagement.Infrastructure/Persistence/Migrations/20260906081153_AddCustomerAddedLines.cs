using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomerAddedLines : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "AddedByCustomer",
                table: "OrderItems",
                type: "bit",
                nullable: false,
                defaultValue: false);

            // Lines already on an order a customer started were added by that customer,
            // so they keep needing agreement exactly as they did before this column
            // existed. Left at the default they would all read as staff-entered, and any
            // order mid-service would lose its confirmation gate the moment this ships.
            migrationBuilder.Sql(
                "UPDATE i SET i.AddedByCustomer = 1 " +
                "FROM [OrderItems] i " +
                "JOIN [Orders] o ON o.Id = i.OrderId " +
                "WHERE o.[Source] IN ('Website', 'QrCode');");

            // And every open order gets the handle that its table's printed code hands
            // back. Without this, orders taken before today stay unreachable from the
            // table they belong to - which is the whole failure being fixed.
            //
            // Derived from NEWID rather than from a cryptographic source, which is only
            // acceptable because these are orders already running that will close within
            // the day. Every new key is minted in the application from the crypto
            // generator.
            migrationBuilder.Sql(
                "UPDATE [Orders] SET [PublicOrderKey] = LOWER(LEFT(CONVERT(varchar(64), " +
                "HASHBYTES('SHA2_256', CAST(NEWID() AS varchar(36))), 2), 32)) " +
                "WHERE [PublicOrderKey] IS NULL AND [Status] = 'Open';");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "AddedByCustomer",
                table: "OrderItems");
        }
    }
}
