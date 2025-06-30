# VranjicReact

This project contains an ASP.NET Core REST API and a simple React front end. The API lives in `api/` and serves the static React files from `api/wwwroot`.

## Build workflow

```bash
# build the React app and publish the API
./build.sh
```

The script restores Node packages in `client/`, builds the React bundle into `api/wwwroot/`, and publishes the API into `publish/` for FTP deployment.

To build only the API:

```bash
cd api
# restore and build (requires NuGet packages)
dotnet build
```
