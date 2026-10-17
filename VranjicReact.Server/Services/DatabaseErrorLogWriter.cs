using System.Transactions;
using Microsoft.EntityFrameworkCore;
using VranjicReact.Server.Data;
using VranjicReact.Server.Models;

namespace VranjicReact.Server.Services;

public interface IErrorLogWriter
{
    Task WriteAsync(ErrorLog entry, CancellationToken cancellationToken);
}

public sealed class DatabaseErrorLogWriter(DbContextOptions<VranjicContext> options) : IErrorLogWriter
{
    public async Task WriteAsync(ErrorLog entry, CancellationToken cancellationToken)
    {
        // Do not reuse the failed request's tracker, connection or ambient transaction.
        using var transaction = new TransactionScope(TransactionScopeOption.Suppress, TransactionScopeAsyncFlowOption.Enabled);
        await using var db = new VranjicContext(options);
        db.Database.SetCommandTimeout(3);
        db.Set<ErrorLog>().Add(entry);
        await db.SaveChangesAsync(cancellationToken);
        transaction.Complete();
    }
}
