# VranjicReact

This project contains a simple ASP.NET Core REST API and a lightweight React frontend. The API uses Entity Framework Core with SQL Server. The React files live in `client/` and can be copied to the repository root via `./build.sh` for FTP deployment.

## Building the API

```bash
cd VranjicApi
# restore and build (requires access to NuGet)
dotnet build
```

## Building the frontend

```bash
./build.sh
```
