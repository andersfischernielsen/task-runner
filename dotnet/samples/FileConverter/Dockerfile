FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY samples/schemas /schemas

COPY dotnet/TaskRunner.sln .
COPY dotnet/src/TaskRunner.Abstractions/TaskRunner.Abstractions.csproj src/TaskRunner.Abstractions/
COPY dotnet/src/TaskRunner.Core/TaskRunner.Core.csproj src/TaskRunner.Core/
COPY dotnet/src/TaskRunner.Dependencies/TaskRunner.Dependencies.csproj src/TaskRunner.Dependencies/
COPY dotnet/samples/FileConverter/FileConverter.csproj samples/FileConverter/
COPY dotnet/tools/SchemaCodeGenerator/SchemaCodeGenerator.csproj tools/SchemaCodeGenerator/

RUN dotnet restore samples/FileConverter/FileConverter.csproj

COPY dotnet/. .

RUN mkdir -p /src/../samples && ln -s /schemas /src/../samples/schemas

WORKDIR /src/samples/FileConverter
RUN dotnet build -c Release -o /app/build

RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0
WORKDIR /app
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "FileConverter.dll"]
