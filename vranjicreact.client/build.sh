#!/usr/bin/env bash
set -e

# Build React bundle into api/wwwroot
npm ci --prefix client
npm run build --prefix client

# Publish the ASP.NET Core API

dotnet publish api -c Release -o publish

