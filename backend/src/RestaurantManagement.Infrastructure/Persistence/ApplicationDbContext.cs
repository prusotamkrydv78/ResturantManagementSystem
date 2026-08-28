using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Domain.Identity;
using RestaurantManagement.Domain.Customers;
using RestaurantManagement.Domain.Inventory;
using RestaurantManagement.Domain.Reservations;
using RestaurantManagement.Domain.Menu;
using RestaurantManagement.Domain.Orders;
using RestaurantManagement.Domain.Payments;
using RestaurantManagement.Domain.Restaurants;

namespace RestaurantManagement.Infrastructure.Persistence;

/// <summary>
/// The application's EF Core context. Derives from the Identity user context rather
/// than the full Identity context because roles are not part of the system yet, so
/// no role tables are created.
/// Each module contributes entities through an
/// <see cref="IEntityTypeConfiguration{TEntity}"/> in the Configurations folder,
/// which is picked up automatically below.
/// </summary>
public class ApplicationDbContext : IdentityUserContext<ApplicationUser, Guid>
{
    /// <summary>Creates the context with the supplied options.</summary>
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
        : base(options)
    {
    }

    /// <summary>Refresh tokens issued to users.</summary>
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    /// <summary>Restaurants on the platform.</summary>
    public DbSet<Restaurant> Restaurants => Set<Restaurant>();

    /// <summary>Tables belonging to restaurants.</summary>
    public DbSet<RestaurantTable> RestaurantTables => Set<RestaurantTable>();

    /// <summary>Menu categories belonging to restaurants.</summary>
    public DbSet<MenuCategory> MenuCategories => Set<MenuCategory>();

    /// <summary>Menu items belonging to categories.</summary>
    public DbSet<MenuItem> MenuItems => Set<MenuItem>();

    /// <summary>Orders placed on tables.</summary>
    public DbSet<Order> Orders => Set<Order>();

    /// <summary>Lines on orders.</summary>
    public DbSet<OrderItem> OrderItems => Set<OrderItem>();

    /// <summary>Submissions of order lines to the kitchen.</summary>
    public DbSet<KitchenTicket> KitchenTickets => Set<KitchenTicket>();

    /// <summary>Lines on kitchen tickets.</summary>
    public DbSet<KitchenTicketItem> KitchenTicketItems => Set<KitchenTicketItem>();

    /// <summary>Records that an order was paid for. One per order.</summary>
    public DbSet<Payment> Payments => Set<Payment>();

    /// <summary>What the kitchen keeps on its shelves.</summary>
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();

    /// <summary>Every change to a stock figure, and why. Append only.</summary>
    public DbSet<StockMovement> StockMovements => Set<StockMovement>();

    /// <summary>What each menu item is made from.</summary>
    public DbSet<MenuItemIngredient> MenuItemIngredients => Set<MenuItemIngredient>();

    /// <summary>People the restaurant knows. Not accounts: nobody signs in.</summary>
    public DbSet<Customer> Customers => Set<Customer>();

    /// <summary>Tables held for somebody at a time.</summary>
    public DbSet<Reservation> Reservations => Set<Reservation>();

    /// <inheritdoc />
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(ApplicationDbContext).Assembly);
    }
}
