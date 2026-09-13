# Secrets Store retrieval example

An asynchronous PAGI application reading `API_KEY` through
`WebDyne::Cloudflare::SecretsStore`. Successful retrieval returns a fixed text
response with `Cache-Control: no-store`; the value is never returned or logged.
Use the parent directory's README for configuration and local provisioning.
