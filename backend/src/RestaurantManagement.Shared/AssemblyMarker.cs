namespace RestaurantManagement.Shared;

/// <summary>
/// Anchor type used to reference this assembly (e.g. for future DI or configuration scanning).
/// </summary>
public static class AssemblyMarker
{
    /// <summary>The assembly that contains cross-cutting primitives.</summary>
    public static readonly System.Reflection.Assembly Assembly = typeof(AssemblyMarker).Assembly;
}
