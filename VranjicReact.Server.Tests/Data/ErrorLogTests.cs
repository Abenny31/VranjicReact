using System.Transactions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.VisualStudio.TestTools.UnitTesting;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;
using VranjicReact.Server.Services;

namespace VranjicReact.Server.Tests.Data;

[TestClass]
public sealed class ErrorLogTests
{
    [TestMethod]
    public void ErrorLogUsesDefaultSchemaAndHasNoDependencyOnUserOrContentTables()
    {
        using var db = new VranjicContext(new DbContextOptionsBuilder<VranjicContext>()
            .UseSqlServer("Server=unused;Database=unused;Integrated Security=true").Options);
        var entity = db.Model.FindEntityType(typeof(ErrorLog));
        Assert.IsNotNull(entity);
        Assert.AreEqual("ErrorLog", entity.GetTableName());
        Assert.IsNull(entity.GetSchema());
        Assert.AreEqual(0, entity.GetForeignKeys().Count());
        Assert.AreEqual(128, entity.FindProperty(nameof(ErrorLog.TraceId))!.GetMaxLength());
        Assert.AreEqual(4000, entity.FindProperty(nameof(ErrorLog.Message))!.GetMaxLength());
        Assert.IsFalse(db.ErrorLogs.ToQueryString().Contains("[dbo]", StringComparison.Ordinal));
        Assert.IsFalse(db.ErrorLogs.ToQueryString().Contains("powerhouse", StringComparison.Ordinal));
    }

    [TestMethod]
    public async Task WriterUsesFreshTrackerAndSuppressesAmbientTransaction()
    {
        var interceptor = new CaptureSaveInterceptor();
        var options = new DbContextOptionsBuilder<VranjicContext>()
            .UseSqlServer("Server=unused;Database=unused;Integrated Security=true")
            .AddInterceptors(interceptor).Options;
        await using var requestDb = new VranjicContext(options);
        requestDb.News.Add(new News { Title = "Unsaved request content" });
        var entry = new ErrorLog { Message = "Request failed" };
        using var transaction = new TransactionScope(TransactionScopeAsyncFlowOption.Enabled);
        Assert.IsNotNull(Transaction.Current);

        await new DatabaseErrorLogWriter(options).WriteAsync(entry, CancellationToken.None);

        Assert.IsNotNull(Transaction.Current);
        Assert.IsTrue(interceptor.TransactionWasSuppressed);
        Assert.AreNotSame(requestDb, interceptor.SavedContext);
        Assert.AreSame(entry, interceptor.SavedEntities.Single());
        Assert.AreEqual(EntityState.Added, requestDb.ChangeTracker.Entries<News>().Single().State);
        transaction.Complete();
    }

    // Intercept at the actual EF save boundary without connecting to any database.
    private sealed class CaptureSaveInterceptor : SaveChangesInterceptor
    {
        public DbContext? SavedContext { get; private set; }
        public object[] SavedEntities { get; private set; } = [];
        public bool TransactionWasSuppressed { get; private set; }
        public override ValueTask<InterceptionResult<int>> SavingChangesAsync(
            DbContextEventData eventData, InterceptionResult<int> result, CancellationToken cancellationToken = default)
        {
            SavedContext = eventData.Context;
            SavedEntities = eventData.Context!.ChangeTracker.Entries().Select(entry => entry.Entity).ToArray();
            TransactionWasSuppressed = Transaction.Current is null;
            return ValueTask.FromResult(InterceptionResult<int>.SuppressWithResult(1));
        }
    }
}
