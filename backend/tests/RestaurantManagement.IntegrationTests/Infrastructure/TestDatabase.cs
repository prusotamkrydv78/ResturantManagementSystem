using Microsoft.EntityFrameworkCore;
using RestaurantManagement.Infrastructure.Persistence;

namespace RestaurantManagement.IntegrationTests.Infrastructure;

/// <summary>
/// A real SQL Server database for the integration tests.
///
/// Deliberately not the in-memory provider. Half of what this suite protects only
/// exists in the database: the unique index that makes a second payment impossible,
/// the check constraints that keep a cancelled order carrying its reason, and the row
/// version that separates two managers settling at once. An in-memory provider
/// enforces none of those, so tests written against it would pass while the
/// guarantees they claim to protect were gone.
///
/// The schema is built by running the real migrations rather than from the model, so
/// a migration that drifts from the configurations fails here too.
///
/// One database for the whole assembly, created once and dropped at the end. Tests
/// isolate themselves by working in their own restaurant instead, which is both
/// faster and closer to how the product actually keeps data apart.
/// </summary>
public sealed class TestDatabase : IAsyncLifetime
{
    private readonly string _databaseName =
        $"RestaurantManagement_Tests_{Guid.NewGuid():N}";

    /// <summary>Connection string for the database this fixture owns.</summary>
    public string ConnectionString =>
        $"Server=(localdb)\\MSSQLLocalDB;Database={_databaseName};" +
        "Trusted_Connection=True;TrustServerCertificate=True";

    /// <summary>
    /// A fresh context. Each one has its own change tracker, which matters: the
    /// concurrency tests need two callers that genuinely have not seen each other
    /// writes, and sharing a context would quietly make them agree.
    /// </summary>
    public ApplicationDbContext NewContext()
    {
        var options = new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseSqlServer(ConnectionString)
            .EnableSensitiveDataLogging()
            .Options;

        return new ApplicationDbContext(options);
    }

    /// <inheritdoc />
    public async Task InitializeAsync()
    {
        await using var context = NewContext();

        await context.Database.MigrateAsync();
    }

    /// <inheritdoc />
    public async Task DisposeAsync()
    {
        await using var context = NewContext();

        await context.Database.EnsureDeletedAsync();
    }
}

/// <summary>
/// Binds the database fixture to every test class that declares this collection, so
/// the schema is built once for the run rather than once per class.
/// </summary>
[CollectionDefinition(Name)]
public sealed class DatabaseCollection : ICollectionFixture<TestDatabase>
{
    /// <summary>The collection name test classes reference.</summary>
    public const string Name = "database";
}
