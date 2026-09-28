# nassauTickets

## Descrição
O nassauTickets é um Sistema de Controle de Atendimento desenvolvido para um Laboratório de Análises Clínicas. Ele gerencia o fluxo de pacientes desde a emissão da senha em um totem até o atendimento final nos guichês. O sistema lida com três tipos de senhas (Prioritária - SP, Retirada de Exames - SE e Geral - SG) e aplica regras de negócio específicas para garantir a ordem justa e eficiente das chamadas, operando com diferentes agentes: Sistema (AS), Atendente (AA) e Cliente (AC).

## Objetivo
Este projeto tem como objetivo consolidar os conhecimentos práticos e teóricos adquiridos na disciplina de desenvolvimento Web. A atividade foca na organização de projetos, documentação, versionamento colaborativo com Git/GitHub, desenvolvimento de interface com React e integração estruturada entre o frontend e o backend da aplicação.

## Tecnologias Utilizadas
* **Frontend:** React 19 (19.2, com Vite).
* **Backend:** Node.js LTS 22 com Express. O grupo optou por Node.js com Express para unificar o desenvolvimento utilizando apenas uma linguagem (JavaScript) tanto no frontend (React) quanto no backend, o que agiliza o trabalho da equipe e facilita a troca de dados nativa em JSON. O Express oferece uma estrutura leve e com pouca configuração, perfeitamente adequada ao porte do sistema. Além disso, a arquitetura do Node.js é ideal para lidar com conexões abertas em tempo real (como SSE), essenciais para a atualização contínua do painel de chamadas. A complexidade do tratamento de concorrência (evitando que dois guichês chamem a mesma senha) foi delegada para o banco de dados MySQL 8.0 através de estratégias de bloqueio (`SELECT ... FOR UPDATE SKIP LOCKED`), não sobrecarregando a aplicação. Por fim, a ausência de tipagem estática do JavaScript será compensada pela execução de testes automatizados das regras de negócio no CI. 
* **Banco de Dados:** MySQL 8.0.
* **Controle de Versão:** Git e GitHub.

## Arquitetura e Visão Geral do Sistema
O sistema opera baseado na interação de três agentes principais:
* **Agente Sistema (AS):** Gerencia a máquina de estados das senhas (Emitida, Aguardando, Chamada, Em Atendimento, etc.), controla a numeração (`YYMMDD-PPSQ`) e atualiza o painel em tempo real.
* **Agente Atendente (AA):** Autenticado no sistema, controla a fila chamando a próxima senha, iniciando ou finalizando atendimentos, e podendo re-chamar clientes.
* **Agente Cliente (AC):** Interage de forma anônima no totem para gerar sua senha e acompanha a chamada no painel (que exibe o histórico das 5 últimas senhas).

A fila de atendimento respeita estritamente a priorização padronizada: `[SP] -> [SE|SG] -> [SP] -> [SE|SG]`.
A saber: 
* **SP** - Senha Prioritária. 
* **SG** - Senha Geral. 
* **SE** - Senha para retirada de Exames. 

## Estrutura do Repositório
Abaixo está a organização de diretórios exigida para o projeto:

```text
nassauTickets/
|- backend/
|- docs/
|  |- branding/
|  |- mer/
|  |- mockups/
|  |- models/
|  |  L- uml/
|  L- requirements/
|- frontend/
|- .gitignore
|- LICENSE
L- README.md
```

## Membros
| Nome             | Matrícula | Papel         |
|------------------|-----------|---------------|
| Diego Teixeira   | 01938580  | Scrum Master  |
| Cauã Henrique    | 01938976  | Testador      |
| Jonatan Teixeira | 01929831  | Desenvolvedor |
| Mário Sousa      | 01353664  | Documentador  |
| Lucas Oliveira   | 01933652  | Documentador  |
| Kaike Filipe     | 01925793  | Testador      |

## Como Configurar e Executar o Projeto

### Pré-requisitos
* Node.js (versão 22 LTS ou superior)
* MySQL (versão 8.0)

### Configuração do Banco de Dados
* Certifique-se de que o serviço do MySQL está rodando.
* Crie um banco de dados chamado `nassau_tickets`.
* Na pasta `backend`, crie manualmente um arquivo chamado `.env`.
* Configure no arquivo `.env` as credenciais de acesso ao banco de dados, conforme o exemplo abaixo:

```env
DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=seu_usuario
DB_PASSWORD=sua_senha
DB_NAME=nassau_tickets
```

### Executando o Backend
```bash
cd backend
# Instale as dependências
npm install
# Inicie o servidor de desenvolvimento
npm run dev
```

### Executando o Frontend
```bash
cd frontend
# Instale as dependências do React
npm install
# Inicie o servidor de desenvolvimento
npm run dev
```
O frontend estará acessível em `http://localhost:5173` (ou na porta configurada pelo Vite).

## Como Usar o Sistema

Após iniciar o backend e o frontend, acesse a aplicação pelo navegador.

* **Totem:** utilizado pelo cliente para emitir senhas dos tipos SP (Prioritária), SG (Geral) e SE (Retirada de Exames).
* **Painel:** exibe as últimas senhas chamadas e o guichê responsável pelo atendimento.
* **Atendimento:** utilizado pelos atendentes autenticados para chamar, rechamar, iniciar e finalizar atendimentos.
* **Gestor:** possui acesso às funcionalidades administrativas, como gerenciamento de atendentes, guichês, relatórios, contingência e simulação.

## Estrutura de Branches e Histórico
Este repositório segue um fluxo de trabalho baseado em duas branches principais:
* `main`: Contém apenas o código estável e funcional (produção).
* `dev`: Branch de integração e desenvolvimento. Todas as novas funcionalidades (features) são enviadas para cá antes de irem para a `main` via merge.

**Padrão de Commits Utilizado:**
* `feat:` para novas funcionalidades (ex: *feat: implementa painel de chamadas*).
* `fix:` para correções de bugs (ex: *fix: corrige regra de prioridade*).
* `docs:` para documentação (ex: *docs: adiciona requisitos do sistema*).
* `chore:` para tarefas de manutenção (ex: *chore: cria estrutura inicial do projeto*).

## Licença
Este projeto está sob a licença MIT. Veja o arquivo `LICENSE` para mais detalhes.