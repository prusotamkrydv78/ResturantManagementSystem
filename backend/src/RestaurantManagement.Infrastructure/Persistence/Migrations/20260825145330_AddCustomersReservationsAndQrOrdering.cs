using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddCustomersReservationsAndQrOrdering : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "IsOrderingEnabled",
                table: "RestaurantTables",
                type: "bit",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "PublicOrderingToken",
                table: "RestaurantTables",
                type: "nvarchar(32)",
                maxLength: 32,
                nullable: false,
                defaultValue: "");

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedByStaffId",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true,
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier");

            migrationBuilder.AddColumn<Guid>(
                name: "CustomerId",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "Orders",
                type: "nvarchar(16)",
                maxLength: 16,
                nullable: false,
                defaultValue: "Staff");

            migrationBuilder.AddUniqueConstraint(
                name: "AK_RestaurantTables_Id_RestaurantId",
                table: "RestaurantTables",
                columns: new[] { "Id", "RestaurantId" });

            migrationBuilder.CreateTable(
                name: "Customers",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    Name = table.Column<string>(type: "nvarchar(120)", maxLength: 120, nullable: false),
                    Phone = table.Column<string>(type: "nvarchar(32)", maxLength: 32, nullable: true),
                    Email = table.Column<string>(type: "nvarchar(256)", maxLength: 256, nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Customers", x => x.Id);
                    table.UniqueConstraint("AK_Customers_Id_RestaurantId", x => new { x.Id, x.RestaurantId });
                    table.ForeignKey(
                        name: "FK_Customers_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "Reservations",
                columns: table => new
                {
                    Id = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    RestaurantId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    CustomerId = table.Column<Guid>(type: "uniqueidentifier", nullable: false),
                    ReservedForUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    DurationMinutes = table.Column<int>(type: "int", nullable: false, defaultValue: 90),
                    GuestCount = table.Column<int>(type: "int", nullable: false),
                    TableId = table.Column<Guid>(type: "uniqueidentifier", nullable: true),
                    Status = table.Column<string>(type: "nvarchar(16)", maxLength: 16, nullable: false, defaultValue: "Pending"),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CancellationReason = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    UpdatedAtUtc = table.Column<DateTimeOffset>(type: "datetimeoffset", nullable: false),
                    RowVersion = table.Column<byte[]>(type: "rowversion", rowVersion: true, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Reservations", x => x.Id);
                    table.CheckConstraint("CK_Reservations_CancellationReason", "[Status] = 'Cancelled' OR [CancellationReason] IS NULL");
                    table.CheckConstraint("CK_Reservations_Duration", "[DurationMinutes] >= 15 AND [DurationMinutes] <= 480");
                    table.CheckConstraint("CK_Reservations_GuestCount", "[GuestCount] >= 1 AND [GuestCount] <= 200");
                    table.CheckConstraint("CK_Reservations_SeatedHasTable", "[Status] <> 'Seated' OR [TableId] IS NOT NULL");
                    table.ForeignKey(
                        name: "FK_Reservations_Customers_CustomerId_RestaurantId",
                        columns: x => new { x.CustomerId, x.RestaurantId },
                        principalTable: "Customers",
                        principalColumns: new[] { "Id", "RestaurantId" });
                    table.ForeignKey(
                        name: "FK_Reservations_RestaurantTables_TableId_RestaurantId",
                        columns: x => new { x.TableId, x.RestaurantId },
                        principalTable: "RestaurantTables",
                        principalColumns: new[] { "Id", "RestaurantId" });
                    table.ForeignKey(
                        name: "FK_Reservations_Restaurants_RestaurantId",
                        column: x => x.RestaurantId,
                        principalTable: "Restaurants",
                        principalColumn: "Id");
                });

            // Every table that already exists needs a token of its own before the unique
            // index below can be created: the column default is the empty string, and a
            // restaurant with two tables would collide on it immediately.
            //
            // NEWID gives a distinct value per row and thirty-two hex characters once the
            // hyphens are stripped, which is exactly the column width. It is used only to
            // backfill rows that predate the feature; tokens the application issues come
            // from a cryptographic generator.
            migrationBuilder.Sql(
                @"UPDATE [RestaurantTables]
                  SET [PublicOrderingToken] =
                      LOWER(REPLACE(CONVERT(nvarchar(36), NEWID()), '-', ''))
                  WHERE [PublicOrderingToken] = N'';");

            migrationBuilder.CreateIndex(
                name: "IX_RestaurantTables_PublicOrderingToken",
                table: "RestaurantTables",
                column: "PublicOrderingToken",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CustomerId",
                table: "Orders",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Orders_CustomerId_RestaurantId",
                table: "Orders",
                columns: new[] { "CustomerId", "RestaurantId" });

            migrationBuilder.AddCheckConstraint(
                name: "CK_Orders_Source",
                table: "Orders",
                sql: "([Source] = 'QrCode' AND [CreatedByStaffId] IS NULL) OR ([Source] <> 'QrCode' AND [CreatedByStaffId] IS NOT NULL)");

            migrationBuilder.CreateIndex(
                name: "IX_Customers_RestaurantId_IsActive",
                table: "Customers",
                columns: new[] { "RestaurantId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_Customers_RestaurantId_Name",
                table: "Customers",
                columns: new[] { "RestaurantId", "Name" });

            migrationBuilder.CreateIndex(
                name: "IX_Customers_RestaurantId_Phone",
                table: "Customers",
                columns: new[] { "RestaurantId", "Phone" },
                unique: true,
                filter: "[Phone] IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_CustomerId",
                table: "Reservations",
                column: "CustomerId");

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_CustomerId_RestaurantId",
                table: "Reservations",
                columns: new[] { "CustomerId", "RestaurantId" });

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_RestaurantId_ReservedForUtc",
                table: "Reservations",
                columns: new[] { "RestaurantId", "ReservedForUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_RestaurantId_Status",
                table: "Reservations",
                columns: new[] { "RestaurantId", "Status" });

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_TableId_ReservedForUtc",
                table: "Reservations",
                columns: new[] { "TableId", "ReservedForUtc" });

            migrationBuilder.CreateIndex(
                name: "IX_Reservations_TableId_RestaurantId",
                table: "Reservations",
                columns: new[] { "TableId", "RestaurantId" });

            migrationBuilder.AddForeignKey(
                name: "FK_Orders_Customers_CustomerId_RestaurantId",
                table: "Orders",
                columns: new[] { "CustomerId", "RestaurantId" },
                principalTable: "Customers",
                principalColumns: new[] { "Id", "RestaurantId" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_Orders_Customers_CustomerId_RestaurantId",
                table: "Orders");

            migrationBuilder.DropTable(
                name: "Reservations");

            migrationBuilder.DropTable(
                name: "Customers");

            migrationBuilder.DropUniqueConstraint(
                name: "AK_RestaurantTables_Id_RestaurantId",
                table: "RestaurantTables");

            migrationBuilder.DropIndex(
                name: "IX_RestaurantTables_PublicOrderingToken",
                table: "RestaurantTables");

            migrationBuilder.DropIndex(
                name: "IX_Orders_CustomerId",
                table: "Orders");

            migrationBuilder.DropIndex(
                name: "IX_Orders_CustomerId_RestaurantId",
                table: "Orders");

            migrationBuilder.DropCheckConstraint(
                name: "CK_Orders_Source",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "IsOrderingEnabled",
                table: "RestaurantTables");

            migrationBuilder.DropColumn(
                name: "PublicOrderingToken",
                table: "RestaurantTables");

            migrationBuilder.DropColumn(
                name: "CustomerId",
                table: "Orders");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "Orders");

            migrationBuilder.AlterColumn<Guid>(
                name: "CreatedByStaffId",
                table: "Orders",
                type: "uniqueidentifier",
                nullable: false,
                defaultValue: new Guid("00000000-0000-0000-0000-000000000000"),
                oldClrType: typeof(Guid),
                oldType: "uniqueidentifier",
                oldNullable: true);
        }
    }
}
