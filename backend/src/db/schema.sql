-- nassauTickets — esquema MySQL 8.0 (InnoDB, utf8mb4)
-- Todos os horários DATETIME(3) são gravados em UTC pelo servidor da aplicação (RNF-04).
-- service_date é a data do expediente no fuso do laboratório.

CREATE TABLE IF NOT EXISTS counters (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number      SMALLINT UNSIGNED NOT NULL,
  name        VARCHAR(60) NOT NULL,
  active      TINYINT(1) NOT NULL DEFAULT 1,
  created_at  DATETIME(3) NOT NULL,
  updated_at  DATETIME(3) NOT NULL,
  UNIQUE KEY uq_counters_number (number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS users (
  id                    INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  username              VARCHAR(40) NOT NULL,
  full_name             VARCHAR(120) NOT NULL,
  password_hash         VARCHAR(100) NOT NULL,
  role                  ENUM('GESTOR','ATENDENTE') NOT NULL,
  status                ENUM('ATIVO','BLOQUEADO','INATIVO') NOT NULL DEFAULT 'ATIVO',
  must_change_password  TINYINT(1) NOT NULL DEFAULT 1,
  failed_attempts       TINYINT UNSIGNED NOT NULL DEFAULT 0,
  locked_until          DATETIME(3) NULL,
  password_changed_at   DATETIME(3) NULL,
  created_at            DATETIME(3) NOT NULL,
  updated_at            DATETIME(3) NOT NULL,
  UNIQUE KEY uq_users_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash    CHAR(64) PRIMARY KEY,
  user_id       INT UNSIGNED NOT NULL,
  counter_id    INT UNSIGNED NULL,
  created_at    DATETIME(3) NOT NULL,
  last_seen_at  DATETIME(3) NOT NULL,
  expires_at    DATETIME(3) NOT NULL,
  revoked_at    DATETIME(3) NULL,
  KEY ix_sessions_user (user_id),
  KEY ix_sessions_counter (counter_id, revoked_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_sessions_counter FOREIGN KEY (counter_id) REFERENCES counters (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- RF-08 / RNF-06: um contador por dia e por tipo; o incremento é atômico.
CREATE TABLE IF NOT EXISTS daily_sequences (
  service_date  DATE NOT NULL,
  type          ENUM('SP','SG','SE') NOT NULL,
  last_seq      SMALLINT UNSIGNED NOT NULL,
  PRIMARY KEY (service_date, type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- RNF-07: para cada senha guardamos apenas tipo, número e horários — nenhum dado do cliente.
CREATE TABLE IF NOT EXISTS tickets (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  number          CHAR(12) NOT NULL,
  service_date    DATE NOT NULL,
  type            ENUM('SP','SG','SE') NOT NULL,
  seq             SMALLINT UNSIGNED NOT NULL,
  status          ENUM('EMITIDA','AGUARDANDO','CHAMADA','CHAMADA_NOVAMENTE','EM_ATENDIMENTO','ATENDIDA','NAO_COMPARECEU','DESCARTADA') NOT NULL,
  origin          ENUM('TOTEM','CONTINGENCIA') NOT NULL DEFAULT 'TOTEM',
  issue_key       VARCHAR(64) NULL,
  call_key        VARCHAR(64) NULL,
  issued_at       DATETIME(3) NOT NULL,
  queued_at       DATETIME(3) NULL,
  first_call_at   DATETIME(3) NULL,
  second_call_at  DATETIME(3) NULL,
  started_at      DATETIME(3) NULL,
  finished_at     DATETIME(3) NULL,
  no_show_at      DATETIME(3) NULL,
  discarded_at    DATETIME(3) NULL,
  counter_id      INT UNSIGNED NULL,
  attendant_id    INT UNSIGNED NULL,
  UNIQUE KEY uq_tickets_number (number),
  UNIQUE KEY uq_tickets_day_type_seq (service_date, type, seq),
  UNIQUE KEY uq_tickets_issue_key (issue_key),
  UNIQUE KEY uq_tickets_call_key (call_key),
  KEY ix_tickets_queue (status, service_date, type, seq),
  KEY ix_tickets_attendant (attendant_id, status),
  KEY ix_tickets_counter (counter_id, status),
  KEY ix_tickets_day (service_date),
  CONSTRAINT fk_tickets_counter FOREIGN KEY (counter_id) REFERENCES counters (id),
  CONSTRAINT fk_tickets_attendant FOREIGN KEY (attendant_id) REFERENCES users (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- RNF-08: toda transição de estado de uma senha, com autor, guichê e horário.
CREATE TABLE IF NOT EXISTS ticket_events (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_id    BIGINT UNSIGNED NOT NULL,
  from_status  VARCHAR(20) NULL,
  to_status    VARCHAR(20) NOT NULL,
  at           DATETIME(3) NOT NULL,
  user_id      INT UNSIGNED NULL,
  counter_id   INT UNSIGNED NULL,
  KEY ix_events_ticket (ticket_id),
  KEY ix_events_status (to_status, id),
  CONSTRAINT fk_events_ticket FOREIGN KEY (ticket_id) REFERENCES tickets (id),
  CONSTRAINT fk_events_user FOREIGN KEY (user_id) REFERENCES users (id),
  CONSTRAINT fk_events_counter FOREIGN KEY (counter_id) REFERENCES counters (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Linha única que serializa a decisão de prioridade entre guichês (RF-14 / RNF-05).
CREATE TABLE IF NOT EXISTS call_control (
  id            TINYINT UNSIGNED PRIMARY KEY,
  service_date  DATE NULL,
  last_type     ENUM('SP','SG','SE') NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO call_control (id, service_date, last_type) VALUES (1, NULL, NULL);

-- RNF-08: logins, cadastros e emissão de relatórios.
CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  at          DATETIME(3) NOT NULL,
  user_id     INT UNSIGNED NULL,
  counter_id  INT UNSIGNED NULL,
  action      VARCHAR(40) NOT NULL,
  entity      VARCHAR(30) NULL,
  entity_id   VARCHAR(40) NULL,
  details     JSON NULL,
  ip          VARCHAR(45) NULL,
  KEY ix_audit_at (at),
  KEY ix_audit_user (user_id, at),
  KEY ix_audit_action (action, at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
