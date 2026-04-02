# Credenciais VPS (exemplo — não coloques passwords reais aqui)

Este ficheiro **pode** ser commitado. Copia para `deploy-credentials.local.md` (ignorado pelo Git) e preenche.

| Campo | Exemplo |
|--------|---------|
| Host | `your.server.ip` |
| User | `root` |
| Password | *(só no ficheiro local)* |

## Ficheiros locais (nunca no Git)

- `deploy-credentials.local.md` — notas humanas + credenciais
- `scripts/deploy_credentials.local.py` — constantes para scripts Python
- `.deploy-pw.txt` — **uma linha**, só a password (usado por `scripts/deploy-vps-windows.ps1`)

Se a password tiver sido partilhada em chat ou issue, **altera-a no servidor**.
