using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddKitchenTickets : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddUniqueConstraint(
                name: "AK_Orders_Id_RestaurantId",
                table: "Orders",
                columns: new[] { "Id", "RestaurantId" });

            migrationBuilder.CreateTable(
                name: "KitchenTickets",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    TicketNumber = table.Column<int>(type: "int", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(24)", maxLength: 24, nullable: false, defaultValue: "Pending"),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KitchenTickets", x => x.Id);
                    table.ForeignKey(
                        name: "FK_KitchenTickets_Orders_OrderId_RestaurantId",
                        columns: x => new { x.OrderId, x.RestaurantId },
                        principalTable: "Orders",
                        principalColumns: new[] { "Id", "RestaurantId" });
                });

            migrationBuilder.CreateTable(
                name: "KitchenTicketItems",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    KitchenTicketId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    OrderItemId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ItemName = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Quantity = table.Column<int>(type: "int", nullable: false),
                    Note = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_KitchenTicketItems", x => x.Id);
                    table.CheckConstraint("CK_KitchenTicketItems_Quantity", "[Quantity] >= 1");
                    table.ForeignKey(
                        name: "FK_KitchenTicketItems_KitchenTickets_KitchenTicketId",
                        column: x => x.KitchenTicketId,
                        principalTable: "KitchenTickets",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_KitchenTicketItems_OrderItems_OrderItemId",
                        column: x => x.OrderItemId,
                        principalTable: "OrderItems",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateIndex(
                name: "IX_KitchenTicketItems_KitchenTicketId",
                table: "KitchenTicketItems",
                column: "KitchenTicketId");

            migrationBuilder.CreateIndex(
                name: "IX_KitchenTicketItems_OrderItemId",
                table: "KitchenTicketItems",
                column: "OrderItemId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_KitchenTickets_OrderId_RestaurantId",
                table: "KitchenTickets",
                columns: new[] { "OrderId", "RestaurantId" });

            migrationBuilder.CreateIndex(
                name: "IX_KitchenTickets_RestaurantId_Status",
                table: "KitchenTickets",
                columns: new[] { "RestaurantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_KitchenTickets_RestaurantId_TicketNumber",
                table: "KitchenTickets",
                columns: new[] { "RestaurantId", "TicketNumber" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "KitchenTicketItems");

            migrationBuilder.DropTable(
                name: "KitchenTickets");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_Orders_Id_RestaurantId",
                table: "Orders");
        }
    }
}
