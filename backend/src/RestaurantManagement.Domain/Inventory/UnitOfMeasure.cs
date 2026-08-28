namespace RestaurantManagement.Domain.Inventory;

/// <summary>
/// How an ingredient is measured.
///
/// Five units, in three families: things you count, things you weigh, and things you
/// pour. Deliberately no cups, spoons, dozens or cases. Every one of those is either
/// ambiguous or a packaging quantity dressed up as a unit, and a kitchen that needs
/// them can express the same thing in grams or pieces without the system having to
/// guess how big a cup is.
/// </summary>
public enum UnitOfMeasure
{
    /// <summary>Counted individually. A bun, an egg, a slice of cheese.</summary>
    Piece = 0,

    /// <summary>Mass, and the base unit its family converts through.</summary>
    Gram = 1,

    /// <summary>A thousand grams.</summary>
    Kilogram = 2,

    /// <summary>Volume, and the base unit its family converts through.</summary>
    Millilitre = 3,

    /// <summary>A thousand millilitres.</summary>
    Litre = 4,
}

/// <summary>
/// What kind of quantity a unit measures.
///
/// Exists so a recipe asking for grams of a liquid can be refused. Converting across
/// families would mean knowing a density the system has no way to know, so the honest
/// answer is that it cannot be done rather than a number that looks plausible.
/// </summary>
public enum UnitFamily
{
    /// <summary>Counted things. No conversion, because half a bun is not a unit.</summary>
    Count = 0,

    /// <summary>Weighed things.</summary>
    Mass = 1,

    /// <summary>Poured things.</summary>
    Volume = 2,
}

/// <summary>
/// Conversions between units of the same kind.
///
/// Only within a family, and only by exact factors of a thousand, so nothing here
/// introduces a rounding error or a hidden assumption. A recipe may therefore ask for
/// 150 grams of something stocked in kilograms, which is how a kitchen actually talks,
/// without the stock having to be kept in whichever unit the recipe happened to use.
/// </summary>
public static class Units
{
    /// <summary>Which family a unit belongs to.</summary>
    public static UnitFamily Family(this UnitOfMeasure unit) => unit switch
    {
        UnitOfMeasure.Piece => UnitFamily.Count,
        UnitOfMeasure.Gram or UnitOfMeasure.Kilogram => UnitFamily.Mass,
        UnitOfMeasure.Millilitre or UnitOfMeasure.Litre => UnitFamily.Volume,
        _ => UnitFamily.Count,
    };

    /// <summary>
    /// Whether a quantity in one unit can be expressed in the other.
    ///
    /// Same family only. Grams to millilitres would need a density per ingredient,
    /// which nothing in this product stores, so it is refused rather than guessed.
    /// </summary>
    public static bool CanConvert(UnitOfMeasure from, UnitOfMeasure to) =>
        from.Family() == to.Family();

    /// <summary>
    /// How many of the family base unit one of this unit is worth.
    ///
    /// Whole thousands, so every conversion is exact in decimal arithmetic.
    /// </summary>
    private static decimal ToBaseFactor(UnitOfMeasure unit) => unit switch
    {
        UnitOfMeasure.Kilogram => 1000m,
        UnitOfMeasure.Litre => 1000m,
        _ => 1m,
    };

    /// <summary>
    /// The same quantity expressed in another unit of the same family.
    ///
    /// Throws when the units are incompatible, because that is a programming mistake
    /// rather than a runtime condition: every caller validates compatibility first,
    /// and silently returning a wrong number would put a fabricated figure into a
    /// stock ledger.
    /// </summary>
    public static decimal Convert(decimal quantity, UnitOfMeasure from, UnitOfMeasure to)
    {
        if (!CanConvert(from, to))
        {
            throw new InvalidOperationException(
                $"{from} and {to} measure different kinds of quantity and cannot be converted.");
        }

        if (from == to)
        {
            return quantity;
        }

        return quantity * ToBaseFactor(from) / ToBaseFactor(to);
    }

    /// <summary>How a unit is written next to a number, such as "150 g".</summary>
    public static string ShortName(this UnitOfMeasure unit) => unit switch
    {
        UnitOfMeasure.Piece => "pc",
        UnitOfMeasure.Gram => "g",
        UnitOfMeasure.Kilogram => "kg",
        UnitOfMeasure.Millilitre => "ml",
        UnitOfMeasure.Litre => "L",
        _ => unit.ToString(),
    };
}
