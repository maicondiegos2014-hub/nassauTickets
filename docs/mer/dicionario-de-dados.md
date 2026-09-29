# Dicionário de Dados — nassauTickets

## ATENDENTE

**id_atendente**  
Identificador único do atendente.

**nome**  
Nome do funcionário que utiliza o sistema.

**login**  
Identificação utilizada para acessar o sistema.

**senha**  
Senha utilizada para autenticação.

**perfil**  
Define as permissões do usuário no sistema.

Valores possíveis:
- ATENDENTE
- GESTOR

**ativo**  
Indica se o usuário está ativo no sistema.

---

## GUICHE

**id_guiche**  
Identificador único do guichê.

**numero**  
Número utilizado para identificar o guichê.

**ativo**  
Indica se o guichê está disponível para atendimento.

---

## SENHA

**id_senha**  
Identificador único da senha.

**numero**  
Número apresentado ao cliente no sistema.

Formato:

YYMMDD-PPSQ

Onde:

- YY = ano;
- MM = mês;
- DD = dia;
- PP = tipo da senha;
- SQ = sequência da senha.

**tipo**  
Identifica o tipo da senha.

Valores possíveis:

- SP = Senha Prioritária;
- SG = Senha Geral;
- SE = Senha para retirada de Exames.

**status**  
Representa o estado atual da senha.

Valores possíveis:

- EMITIDA;
- AGUARDANDO;
- CHAMADA;
- CHAMADA_NOVAMENTE;
- EM_ATENDIMENTO;
- ATENDIDA;
- NÃO_COMPARECEU.

**data_emissao**  
Data em que a senha foi emitida.

**hora_emissao**  
Horário em que a senha foi emitida.

**emitida_em**  
Data e hora completas da emissão.

---

## CHAMADA

**id_chamada**  
Identificador único da chamada.

**id_senha**  
Identifica a senha que está sendo chamada.

**id_atendente**  
Identifica o atendente responsável pela chamada.

**id_guiche**  
Identifica o guichê utilizado na chamada.

**numero_chamada**  
Indica o número da chamada realizada para a senha.

**chamada_em**  
Data e hora em que a senha foi chamada.

**observacao**  
Informações adicionais relacionadas à chamada.

---

## ATENDIMENTO

**id_atendimento**  
Identificador único do atendimento.

**id_senha**  
Identifica a senha que está sendo atendida.

**id_atendente**  
Identifica o atendente responsável pelo atendimento.

**id_guiche**  
Identifica o guichê onde ocorreu o atendimento.

**inicio_atendimento**  
Data e hora do início do atendimento.

**fim_atendimento**  
Data e hora da finalização do atendimento.

---

# Regras importantes

1. O cliente não precisa ser cadastrado no banco de dados, pois sua interação ocorre de forma anônima pelo totem.

2. Uma senha pode possuir várias chamadas.

3. Uma senha pode possuir no máximo um atendimento.

4. Uma chamada deve estar associada a uma senha, um atendente e um guichê.

5. Um atendimento deve estar associado a uma senha, um atendente e um guichê.

6. O sistema deve registrar os horários das chamadas para permitir auditoria.

7. O sistema deve registrar o início e a finalização dos atendimentos.