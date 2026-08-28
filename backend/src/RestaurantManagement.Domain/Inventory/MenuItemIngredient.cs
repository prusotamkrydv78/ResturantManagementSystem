using RestaurantManagement.Domain.Menu;

namespace RestaurantManagement.Domain.Inventory;

/// <summary>
/// One ingredient a menu item is made from, and how much of it.
///
/// A menu item has as many of these as it needs, and one inventory item appears at
/// most once in a given recipe: two rows for the same ingredient would be two answers
/// to the same question, and adding them silently would hide whichever was wrong.
///
/// The quantity is per one of the menu item. Sending three burgers to the kitchen
/// consumes three times this.
/// </summary>
public class MenuItemIngredient
{
    /// <summary>Primary key.</summary>
    public Guid Id { get; set; }

    /// <summary>
    /// The restaurant this belongs to. Carried so both sides of the recipe can be bound
    /// to it, which is what makes a recipe crossing restaurants unrepresentable rather
    /// than merely guarded against.
    /// </summary>
    public Guid RestaurantId { get; set; }

    /// <summary>The menu item being made.</summary>
    public Guid MenuItemId { get; set; }

    /// <summary>Navigation to the menu item.</summary>
    public MenuItem MenuItem { get; set; } = null!;

    /// <summary>The ingredient it is made from.</summary>
    public Guid InventoryItemId { get; set; }

    /// <summary>Navigation to the ingredient.</summary>
    public InventoryItem InventoryItem { get; set; } = null!;

    /// <summary>
    /// How much is needed for one, in <see cref="Unit"/>. Always positive: a recipe
    /// asking for nothing is not a recipe line, it is a line somebody forgot to delete.
    /// </summary>
    public decimal Quantity { get; set; }

    /// <summary>
    /// The unit the quantity is written in.
    ///
    /// Need not match the unit the ingredient is stocked in, only measure the same kind
    /// of thing. A kitchen says "150 grams of chicken" whether the chicken is counted in
    /// grams or kilograms, and the conversion between the two is exact, so forcing the
    /// recipe to use the stock unit would make it read wrongly for no benefit.
    /// </summary>
    public UnitOfMeasure Unit { get; set; }

    /// <summary>When the line was added.</summary>
    public DateTimeOffset CreatedAtUtc { get; set; }

    /// <summary>When it was last changed.</summary>
    public DateTimeOffset UpdatedAtUtc { get; set; }

    /// <summary>
    /// How much stock one of the menu item consumes, in the unit the ingredient is
    /// actually stocked in.
    ///
    /// Requires <see cref="InventoryItem"/> to be loaded. Converting here rather than at
    /// the point of deduction keeps the arithmetic in one place, next to the two units
    /// it reconciles.
    /// </summary>
    public decimal QuantityInStockUnit() =>
        Units.Convert(Quantity, Unit, InventoryItem.Unit);
}
