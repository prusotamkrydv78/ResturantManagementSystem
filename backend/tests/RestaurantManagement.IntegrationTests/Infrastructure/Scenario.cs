using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Menu;
using RestaurantManagement.Domain.Restaurants;
using RestaurantManagement.Infrastructure.Persistence;

namespace RestaurantManagement.IntegrationTests.Infrastructure;

/// <summary>
/// One restaurant, ready to trade: a manager, a waiter, a chef, a table and a menu
/// item that can actually be ordered.
///
/// Every test seeds its own, which is what keeps tests apart. It also means the
/// isolation tests get their second restaurant for free rather than needing a special
/// arrangement, and that a test can never accidentally depend on another leftovers.
/// </summary>
internal sealed record Scenario(
    Guid RestaurantId,
    Guid ManagerId,
    Guid WaiterId,
    Guid ChefId,
    Guid TableId,
    string TableName,
    Guid MenuItemId,
    decimal MenuItemPrice)
{
    /// <summary>
    /// Seeds a restaurant and the people and records needed to run an order through
    /// its whole life.
    /// </summary>
    public static async Task<Scenario> SeedAsync(
        ApplicationDbContext context,
        string label)
    {
        var now = DateTimeOffset.UtcNow;
        var restaurantId = Guid.CreateVersion7();
        var managerId = Guid.CreateVersion7();

        var manager = User(managerId, $"{label} Manager", PlatformRole.RestaurantManager);
        context.Users.Add(manager);

        context.Restaurants.Add(new Restaurant
        {
            Id = restaurantId,
            Name = $"{label} Restaurant",
            // Unique per scenario: the slug is unique platform-wide.
            Slug = $"{label.ToLowerInvariant()}-{restaurantId:N}",
            ManagerId = managerId,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var waiterId = Guid.CreateVersion7();
        var waiter = User(waiterId, $"{label} Waiter", PlatformRole.Staff);
        waiter.RestaurantId = restaurantId;
        waiter.StaffRole = StaffRole.Waiter;
        context.Users.Add(waiter);

        var chefId = Guid.CreateVersion7();
        var chef = User(chefId, $"{label} Chef", PlatformRole.Staff);
        chef.RestaurantId = restaurantId;
        chef.StaffRole = StaffRole.Chef;
        context.Users.Add(chef);

        var tableId = Guid.CreateVersion7();
        var tableName = "Table 1";
        context.RestaurantTables.Add(new RestaurantTable
        {
            Id = tableId,
            RestaurantId = restaurantId,
            Name = tableName,
            Capacity = 4,
            Status = TableStatus.Available,
            IsActive = true,
            // A table is not valid without one: the ordering token is unique across the
            // platform, so two tables seeded without one collide on the index rather
            // than quietly sharing a blank. Guest ordering stays off, which is what a
            // real table starts as.
            PublicOrderingToken = PublicOrderingToken.Create(),
            IsOrderingEnabled = false,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var categoryId = Guid.CreateVersion7();
        context.MenuCategories.Add(new MenuCategory
        {
            Id = categoryId,
            RestaurantId = restaurantId,
            Name = "Mains",
            DisplayOrder = 1,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        var menuItemId = Guid.CreateVersion7();
        const decimal price = 12.50m;
        context.MenuItems.Add(new MenuItem
        {
            Id = menuItemId,
            RestaurantId = restaurantId,
            CategoryId = categoryId,
            Name = "Chicken Burger",
            Price = price,
            IsActive = true,
            CreatedAtUtc = now,
            UpdatedAtUtc = now,
        });

        await context.SaveChangesAsync();

        return new Scenario(
            restaurantId,
            managerId,
            waiterId,
            chefId,
            tableId,
            tableName,
            menuItemId,
            price);
    }

    /// <summary>Switches a staff account off, without deleting anything.</summary>
    public static async Task DeactivateAsync(ApplicationDbContext context, Guid userId)
    {
        var user = await context.Users.SingleAsync(candidate => candidate.Id == userId);

        user.IsActive = false;

        await context.SaveChangesAsync();
    }

    private static ApplicationUser User(Guid id, string name, PlatformRole role) =>
        new()
        {
            Id = id,
            FullName = name,
            UserName = $"{id:N}@example.test",
            NormalizedUserName = $"{id:N}@EXAMPLE.TEST",
            Email = $"{id:N}@example.test",
            NormalizedEmail = $"{id:N}@EXAMPLE.TEST",
            EmailConfirmed = true,
            SecurityStamp = Guid.NewGuid().ToString(),
            PasswordHash = "not-a-real-hash",
            PlatformRole = role,
            IsActive = true,
            CreatedAtUtc = DateTimeOffset.UtcNow,
        };
}
