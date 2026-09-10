using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace RestaurantManagement.Infrastructure.Persistence.Migrations
{
    /// <inheritdoc />
    public partial class AddPerDishKitchenProgress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ReadyAtUtc",
                table: "KitchenTicketItems",
                type: "datetimeoffset",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "ServedAtUtc",
                table: "KitchenTicketItems",
                type: "datetimeoffset",
                nullable: true);

            // Existing tickets, brought forward.
            //
            // Progress used to live only on the ticket, so every line that already
            // exists says nothing about itself. Left null, a ticket the kitchen had
            // already finished would have no cooked dishes on it - which now means
            // nothing waiting at the pass and nothing a waiter could carry, so the
            // evening's food would quietly vanish off the floor's screen.
            //
            // The ticket's own stamps are the best available answer for lines that were
            // never tracked individually: everything on a finished ticket was cooked
            // when the ticket was, and carried when the ticket was.
            migrationBuilder.Sql("""
                UPDATE i
                SET i.ReadyAtUtc = t.ReadyAtUtc
                FROM KitchenTicketItems AS i
                INNER JOIN KitchenTickets AS t ON t.Id = i.KitchenTicketId
                WHERE t.ReadyAtUtc IS NOT NULL;
                """);

            migrationBuilder.Sql("""
                UPDATE i
                SET i.ServedAtUtc = t.ServedAtUtc
                FROM KitchenTicketItems AS i
                INNER JOIN KitchenTickets AS t ON t.Id = i.KitchenTicketId
                WHERE t.ServedAtUtc IS NOT NULL;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "ReadyAtUtc",
                table: "KitchenTicketItems");

            migrationBuilder.DropColumn(
                name: "ServedAtUtc",
                table: "KitchenTicketItems");
        }
    }
}
