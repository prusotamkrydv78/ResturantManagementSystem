using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddBillingCharges : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "IX_Payments_OrderId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_OrderId_RestaurantId",
                table: "Payments");

            migrationBuilder.AddColumn<string>(
                name: "Currency",
                table: "Restaurants",
                type: "nvarchar(3)",
                maxLength: 3,
                nullable: false,
                defaultValue: "NPR");

            migrationBuilder.AddColumn<decimal>(
                name: "ServiceChargeRate",
                table: "Restaurants",
                type: "decimal(6,4)",
                precision: 6,
                scale: 4,
                nullable: false,
                defaultValue: 0.10m);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                table: "Restaurants",
                type: "decimal(6,4)",
                precision: 6,
                scale: 4,
                nullable: false,
                defaultValue: 0.13m);

            migrationBuilder.AddColumn<decimal>(
                name: "DiscountAmount",
                table: "Orders",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<string>(
                name: "DiscountReason",
                table: "Orders",
                type: "nvarchar(200)",
                maxLength: 200,
                nullable: true);

            migrationBuilder.AddColumn<decimal>(
                name: "ServiceChargeAmount",
                table: "Orders",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "ServiceChargeRate",
                table: "Orders",
                type: "decimal(6,4)",
                precision: 6,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "Total",
                table: "Orders",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "VatAmount",
                table: "Orders",
                type: "decimal(18,2)",
                precision: 18,
                scale: 2,
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "VatRate",
                table: "Orders",
                type: "decimal(6,4)",
                precision: 6,
                scale: 4,
                nullable: false,
                defaultValue: 0m);

            // Existing orders were priced before any of this existed, so their bill is
            // whatever the food came to and nothing on top. Backfilled explicitly rather
            // than left at the column default of zero: a Total of zero on a real order
            // would read as a bill that owes nothing, and a report would believe it.
            //
            // Their rates stay at zero on purpose. These orders were never quoted a
            // service charge or a tax, and inventing one retrospectively would change
            // what somebody already agreed to pay.
            migrationBuilder.Sql("UPDATE [Orders] SET [Total] = [Subtotal];");

            migrationBuilder.AddCheckConstraint(
                name: "CK_Restaurants_Rates",
                table: "Restaurants",
                sql: "[VatRate] >= 0 AND [VatRate] <= 1 AND [ServiceChargeRate] >= 0 AND [ServiceChargeRate] <= 1");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrderId",
                table: "Payments",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrderId_RestaurantId",
                table: "Payments",
                columns: new[] { "OrderId", "RestaurantId" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_Discount",
                table: "Orders",
                sql: "([DiscountAmount] = 0 AND [DiscountReason] IS NULL) OR ([DiscountAmount] > 0 AND [DiscountReason] IS NOT NULL)");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "CK_Restaurants_Rates",
                table: "Restaurants");

            migrationBuilder.DropIndex(
                name: "IX_Payments_OrderId",
                table: "Payments");

            migrationBuilder.DropIndex(
                name: "IX_Payments_OrderId_RestaurantId",
                table: "Payments");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_Discount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Currency",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "ServiceChargeRate",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "VatRate",
                table: "Restaurants");

            migrationBuilder.DropColumn(
                name: "DiscountAmount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "DiscountReason",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ServiceChargeAmount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "ServiceChargeRate",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Total",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "VatAmount",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "VatRate",
                table: "Orders");

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrderId",
                table: "Payments",
                column: "OrderId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Payments_OrderId_RestaurantId",
                table: "Payments",
                columns: new[] { "OrderId", "RestaurantId" },
                unique: true);
        }
    }
}
