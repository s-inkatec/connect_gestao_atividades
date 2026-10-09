# Connect — Gestão de atividades

Sistema baseado nas 55 atividades da planilha organizada. A classificação respeita as decisões confirmadas pelo usuário: 19 Bugs, 17 Melhorias e 19 Novos Projetos.

## Funcionalidades

- Lista e quadro por status, busca e filtros combináveis.
- Cadastro e edição dos nove campos da base.
- Indicadores gerenciais, vencimentos pelo horário de Brasília e destaque para lacunas nas atividades abertas.
- Histórico de alterações com data, autor e campos alterados.
- Exportação CSV dos resultados filtrados, compatível com Excel.
- Persistência no banco D1 e controle de versão para impedir sobrescrita de edições simultâneas.
- Acesso autenticado. A publicação prevista é privada, com acesso somente do proprietário; compartilhamento com a equipe exige configuração posterior.

## Prévia local

A prévia usa http://127.0.0.1:5173/. A simulação local de autenticação identifica o usuário como Seedy e não usa a identidade real. Ela não integra a versão de produção.

Para iniciar novamente, execute `node scripts/run-framework.mjs dev` nesta pasta. O ambiente requer Node.js e as dependências já instaladas. As migrações locais ficam em `.wrangler/state` e não fazem parte da publicação.

## Dados e operação

A planilha serve como carga inicial. As alterações feitas no sistema não atualizam o Excel original. Os dados iniciais ficam em `lib/seed.json`; a inicialização insere registros ausentes e preserva todas as edições já salvas.

Responsáveis múltiplos usam ponto e vírgula. Referências são texto; a primeira versão não cria nem sincroniza chamados no Jira. Não há exclusão de atividades nesta versão. Para retirar um item do fluxo, revise seu status e registre o motivo na descrição.

O sistema carrega registros do servidor. Uma falha de leitura mostra erro e bloqueia cadastro/exportação. Uma falha de gravação mantém o formulário preenchido. Histórico exibe as 30 alterações mais recentes por atividade.

## Validação

- As 55 atividades e os totais por tipo conferem com a planilha.
- Edição, leitura posterior e histórico conferidos no banco local; dado temporário restaurado.
- API anônima retorna 401; tipo inválido retorna 400; versão de edição obsoleta retorna 409.
- Busca por CON-98 retorna a atividade correspondente.
- Conferência visual do resumo e compilação da aplicação.

A publicação externa permanece pendente de autorização após rejeição pela revisão automática de aprovação. O endereço reservado não comprova que exista uma versão publicada.
