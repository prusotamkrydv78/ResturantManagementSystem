namespace RestaurantManagement.Infrastructure;

/// <summary>
/// Anchor type used to reference the infrastructure assembly.
/// </summary>
public static class AssemblyMarker
{
    /// <summary>The assembly that contains persistence and external integrations.</summary>
    public static readonly System.Reflection.Assembly Assembly = typeof(AssemblyMarker).Assembly;
}
