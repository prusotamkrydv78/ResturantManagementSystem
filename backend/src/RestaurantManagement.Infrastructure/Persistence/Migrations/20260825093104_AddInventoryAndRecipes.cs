using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddInventoryAndRecipes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_MenuItems_Id_RestaurantId",
                table: "MenuItems",
                columns: new[] { "Id", "RestaurantId" });

            migrationBuilder.CreateTable(
                name: "InventoryItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    QuantityInStock = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    MinimumQuantity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InventoryItems", x => x.Id);
                    table.UniqueConstraint("AK_InventoryItems_Id_RestaurantId", x => new { x.Id, x.RestaurantId });
                    table.CheckConstraint("CK_InventoryItems_MinimumQuantity", "[MinimumQuantity] >= 0");
                    table.ForeignKey(
                        name: "FK_InventoryItems_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "MenuItemIngredients",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    MenuItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Quantity = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_MenuItemIngredients", x => x.Id);
                    table.CheckConstraint("CK_MenuItemIngredients_Quantity", "[Quantity] > 0");
                    table.ForeignKey(
                        name: "FK_MenuItemIngredients_InventoryItems_InventoryItemId_RestaurantId",
                        columns: x => new { x.InventoryItemId, x.RestaurantId },
                        principalTable: "InventoryItems",
                        principalColumns: new[] { "Id", "RestaurantId" });
                    table.ForeignKey(
                        name: "FK_MenuItemIngredients_MenuItems_MenuItemId_RestaurantId",
                        columns: x => new { x.MenuItemId, x.RestaurantId },
                        principalTable: "MenuItems",
                        principalColumns: new[] { "Id", "RestaurantId" },
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "StockMovements",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    InventoryItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Kind = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    QuantityDelta = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    QuantityAfter = table.Column<decimal>(type: "decimal(18,3)", precision: 18, scale: 3, nullable: false),
                    Unit = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false),
                    Reason = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    KitchenTicketId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    RecordedByUserId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RecordedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StockMovements", x => x.Id);
                    table.CheckConstraint("CK_StockMovements_ConsumedOutward", "[Kind] <> 'Consumed' OR [QuantityDelta] < 0");
                    table.CheckConstraint("CK_StockMovements_Delta", "[QuantityDelta] <> 0");
                    table.CheckConstraint("CK_StockMovements_Reason", "([Kind] IN ('Adjusted', 'Wasted') AND [Reason] IS NOT NULL) OR [Kind] NOT IN ('Adjusted', 'Wasted')");
                    table.CheckConstraint("CK_StockMovements_WasteOutward", "[Kind] <> 'Wasted' OR [QuantityDelta] < 0");
                    table.ForeignKey(
                        name: "FK_StockMovements_InventoryItems_InventoryItemId_RestaurantId",
                        columns: x => new { x.InventoryItemId, x.RestaurantId },
                        principalTable: "InventoryItems",
                        principalColumns: new[] { "Id", "RestaurantId" });
                });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItems_RestaurantId_IsActive",
                table: "InventoryItems",
                columns: new[] { "RestaurantId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_InventoryItems_RestaurantId_Name",
                table: "InventoryItems",
                columns: new[] { "RestaurantId", "Name" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemIngredients_InventoryItemId",
                table: "MenuItemIngredients",
                column: "InventoryItemId");

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemIngredients_InventoryItemId_RestaurantId",
                table: "MenuItemIngredients",
                columns: new[] { "InventoryItemId", "RestaurantId" });

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemIngredients_MenuItemId_InventoryItemId",
                table: "MenuItemIngredients",
                columns: new[] { "MenuItemId", "InventoryItemId" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_MenuItemIngredients_MenuItemId_RestaurantId",
                table: "MenuItemIngredients",
                columns: new[] { "MenuItemId", "RestaurantId" });

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_InventoryItemId_RecordedAtUtc",
                table: "StockMovements",
                columns: new[] { "InventoryItemId", "RecordedAtUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_InventoryItemId_RestaurantId",
                table: "StockMovements",
                columns: new[] { "InventoryItemId", "RestaurantId" });

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_OrderId",
                table: "StockMovements",
                column: "OrderId");

            migrationBuilder.CreateIndex(
                name: "IX_StockMovements_RestaurantId_Kind",
                table: "StockMovements",
                columns: new[] { "RestaurantId", "Kind" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "MenuItemIngredients");

            migrationBuilder.DropTable(
                name: "StockMovements");

            migrationBuilder.DropTable(
                name: "InventoryItems");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_MenuItems_Id_RestaurantId",
                table: "MenuItems");
        }
    }
}
