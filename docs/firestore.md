# Persistência no Firestore

Projeto: `connect-gestao-de-atividades`. Banco `(default)`, São Paulo.

| Coleção | Conteúdo |
| --- | --- |
| atividades | Campos da atividade, identificador original, versão, atualização e ordem |
| atividades/{id}/historico | Alterações e autor, salvos atomicamente com a atividade |
| usuarios | E-mail, identidade vinculada, nome, perfil, situação e versão |
| identidades | Vínculo único entre identidade fornecida pelo Site e e-mail autorizado |
| historicoPermissoes | Alterações de cadastro e permissão |
| configuracoes | Estrutura, checksum, contagens e resultado da migração |

IDs de atividade, e-mail e identidade são codificados em Base64 URL-safe para produzir caminhos estáveis. Campos conservam o identificador original. Coleções de histórico vazias surgem na primeira alteração real; não recebem eventos fictícios.

O navegador chama as APIs do Site. O servidor verifica sessão, cadastro ativo, perfil e origem da requisição. As regras do Firestore negam acesso direto pelo cliente. A conta técnica `connect-gestao-firestore` recebe `roles/datastore.user`; sua chave permanece somente em `FIREBASE_SERVICE_ACCOUNT`, segredo do servidor. Não colocar a chave em Git, código, logs ou variáveis públicas.

`DATA_BACKEND=d1` mantém a base original. `maintenance` bloqueia operações durante a cópia. `firestore` ativa o destino somente quando a migração tem status `verified`. Falhas do Firestore retornam erro; o sistema não grava silenciosamente na base anterior.

## Migração

1. Publicar o código com `DATA_BACKEND=maintenance` e confirmar a pausa.
2. Exportar todas as páginas das tabelas live `tasks`, `app_users`, `events`, `user_events`, sem truncamento. Salvar o snapshot fora do Git.
3. Executar `node scripts/migrate-firestore.mjs SNAPSHOT.json CHAVE.json --source-frozen` com caminhos absolutos.
4. O script preserva IDs, valores, versões, vínculos e históricos; impede sobrescrever documentos divergentes; relê cada documento e confere contagens e checksum.
5. Configurar o segredo do servidor e publicar `DATA_BACKEND=firestore`.
6. Conferir consulta, gravação, histórico e perfis. Preservar D1 e snapshot como cópia da data da migração.

Retorno para D1 após novas gravações exige reconciliar as alterações do Firestore. Trocar a variável sem reconciliação perde a visão dessas alterações. Não excluir a base anterior como parte desta migração.

Perfis: `read` consulta; `edit` consulta e edita; `create` também cria atividades; `admin` gerencia usuários. O administrador principal permanece ativo e imutável.
