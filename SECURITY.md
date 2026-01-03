# Security Policy

## Reporting a Vulnerability

If you discover a security vulnerability:

1. **Do NOT** create a public GitHub issue
2. Email the maintainer directly
3. Allow reasonable time for a fix before public disclosure
4. Include steps to reproduce the vulnerability

## Security Model

This workload integrates with Microsoft Fabric's security:

- **Authentication**: Microsoft Entra ID via Fabric Workload SDK
- **Authorization**: Fabric workspace roles and item permissions
- **Data Access**: GraphQL API with Fabric security context
- **Metadata Only**: Reads object definitions, never table data

## Deployment Best Practices

- Never commit `.env` files with credentials
- Review GraphQL API permissions in Fabric Portal

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x.x   | Yes       |
