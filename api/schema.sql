-- MealMap – Datenbankschema für MySQL
--
-- Übersetzt aus dem ursprünglichen Entwurf. Inhaltlich unverändert: dieselben
-- Tabellen, dieselben Beziehungen, dieselben Korrekturen gegenüber dem Konzept.
--
-- Hinweise zur Umsetzung:
--   * VARCHAR(191) für alles, was in einem Index landet – ältere MySQL-Versionen
--     begrenzen Indexschlüssel bei utf8mb4 auf 191 Zeichen.
--   * Aufzählungen liegen als VARCHAR statt als ENUM, damit neue Werte ohne
--     Schemaänderung dazukommen können. Die erlaubten Werte stehen im Kommentar
--     und in src/lib/domain.ts.
--   * Alle Fremdschlüssel mit ON DELETE CASCADE, damit das Löschen eines Nutzers
--     dessen kompletten Datenbestand mitnimmt.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

CREATE TABLE IF NOT EXISTS users (
  id         VARCHAR(36)  NOT NULL,
  name       VARCHAR(191) NOT NULL,
  -- Schlüssel für den KI-Import. Bleibt serverseitig, erreicht nie den Browser.
  api_key    TEXT         NULL,
  -- Bundesland als Kürzel (BW, BY, …) – bestimmt, welche Feiertage gelten.
  -- Siehe BUNDESLAENDER in api/lib/feiertage.php.
  state      VARCHAR(2)   NOT NULL DEFAULT 'BW',
  -- Persönliche Gewohnheiten als Freitext, vom Nutzer selbst formuliert:
  -- wann er auswärts isst, was er nicht mag, welcher Kochrhythmus passt.
  -- Bewusst unstrukturiert – solche Regeln sind bei jedem anders. Wird beim
  -- Vorschlagen an die KI weitergegeben, siehe api/lib/suggest.php.
  habits     TEXT         NULL,
  created_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_users_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS categories (
  id      VARCHAR(36)  NOT NULL,
  user_id VARCHAR(36)  NOT NULL,
  name    VARCHAR(191) NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_categories_user_name (user_id, name),
  KEY idx_categories_user (user_id),
  CONSTRAINT fk_categories_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipes (
  id           VARCHAR(36)  NOT NULL,
  user_id      VARCHAR(36)  NOT NULL,
  title        VARCHAR(255) NOT NULL,
  notes        TEXT         NULL,
  comment      TEXT         NULL,
  rating       TINYINT      NULL,
  freezable    TINYINT(1)   NOT NULL DEFAULT 0,
  servings     INT          NOT NULL DEFAULT 2,
  prep_minutes INT          NULL,
  -- video | link
  source_type  VARCHAR(16)  NULL,
  source_url   TEXT         NULL,
  -- Gesetzt, sobald das Rezept im Papierkorb liegt. Endgültig gelöscht wird
  -- erst nach Ablauf der Frist (siehe PAPIERKORB_TAGE in lib/trash.php).
  deleted_at   DATETIME     NULL,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_recipes_user (user_id),
  KEY idx_recipes_deleted (deleted_at),
  CONSTRAINT fk_recipes_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS ingredients (
  id        VARCHAR(36)  NOT NULL,
  recipe_id VARCHAR(36)  NOT NULL,
  name      VARCHAR(191) NOT NULL,
  -- Vereinheitlichter Name für das Zusammenfassen in der Einkaufsliste.
  name_key  VARCHAR(191) NOT NULL,
  amount    DECIMAL(10,3) NULL,
  unit      VARCHAR(32)  NULL,
  position  INT          NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_ingredients_recipe (recipe_id),
  KEY idx_ingredients_key (name_key),
  CONSTRAINT fk_ingredients_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS steps (
  id            VARCHAR(36)  NOT NULL,
  recipe_id     VARCHAR(36)  NOT NULL,
  position      INT          NOT NULL DEFAULT 0,
  title         VARCHAR(255) NULL,
  content       TEXT         NOT NULL,
  -- Gesetzt bei zeitkritischen Schritten, treibt den Timer im Kochmodus.
  timer_seconds INT          NULL,
  PRIMARY KEY (id),
  KEY idx_steps_recipe (recipe_id),
  CONSTRAINT fk_steps_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipe_images (
  id        VARCHAR(36) NOT NULL,
  recipe_id VARCHAR(36) NOT NULL,
  url       TEXT        NOT NULL,
  position  INT         NOT NULL DEFAULT 0,
  PRIMARY KEY (id),
  KEY idx_recipe_images_recipe (recipe_id),
  CONSTRAINT fk_recipe_images_recipe FOREIGN KEY (recipe_id) REFERENCES recipes (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS recipe_categories (
  recipe_id   VARCHAR(36) NOT NULL,
  category_id VARCHAR(36) NOT NULL,
  PRIMARY KEY (recipe_id, category_id),
  KEY idx_recipe_categories_category (category_id),
  CONSTRAINT fk_rc_recipe   FOREIGN KEY (recipe_id)   REFERENCES recipes (id)    ON DELETE CASCADE,
  CONSTRAINT fk_rc_category FOREIGN KEY (category_id) REFERENCES categories (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Eigenschaften eines ganzen Tages. Der Einkaufstermin gilt für den Tag,
-- die Abwesenheit dagegen für einzelne Mahlzeiten (siehe plan_entries).
CREATE TABLE IF NOT EXISTS plan_days (
  id              VARCHAR(36) NOT NULL,
  user_id         VARCHAR(36) NOT NULL,
  date            DATE        NOT NULL,
  is_shopping_day TINYINT(1)  NOT NULL DEFAULT 0,
  note            TEXT        NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_plan_days_user_date (user_id, date),
  CONSTRAINT fk_plan_days_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS plan_entries (
  id           VARCHAR(36) NOT NULL,
  user_id      VARCHAR(36) NOT NULL,
  plan_day_id  VARCHAR(36) NOT NULL,
  -- Kochtermin und Essenstermin können auseinanderfallen.
  cook_date    DATE        NULL,
  eat_date     DATE        NOT NULL,
  -- breakfast | snack_am | lunch | snack_pm | dinner | other
  meal_slot    VARCHAR(16) NOT NULL,
  recipe_id    VARCHAR(36) NULL,
  free_text    TEXT        NULL,
  portion_count INT        NOT NULL DEFAULT 1,
  -- JSON-Liste namentlich genannter Personen, Vorgabe ["Ich"]
  for_whom     TEXT        NULL,
  -- Weitere Esser ohne Namen, etwa Besuch. Steht neben for_whom, nicht darin:
  -- Namen und bloße Anzahl sind zweierlei.
  guest_count  INT         NOT NULL DEFAULT 0,
  -- suggested | confirmed
  status       VARCHAR(16) NOT NULL DEFAULT 'confirmed',
  is_absent    TINYINT(1)  NOT NULL DEFAULT 0,
  cooked_at    DATETIME    NULL,
  eaten_at     DATETIME    NULL,
  created_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_plan_entries_user_date (user_id, eat_date),
  KEY idx_plan_entries_day (plan_day_id),
  KEY idx_plan_entries_recipe (recipe_id),
  CONSTRAINT fk_plan_entries_user   FOREIGN KEY (user_id)     REFERENCES users (id)     ON DELETE CASCADE,
  CONSTRAINT fk_plan_entries_day    FOREIGN KEY (plan_day_id) REFERENCES plan_days (id) ON DELETE CASCADE,
  CONSTRAINT fk_plan_entries_recipe FOREIGN KEY (recipe_id)   REFERENCES recipes (id)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS stock_items (
  id            VARCHAR(36)  NOT NULL,
  user_id       VARCHAR(36)  NOT NULL,
  name          VARCHAR(191) NOT NULL,
  name_key      VARCHAR(191) NOT NULL,
  quantity      DECIMAL(10,3) NOT NULL,
  unit          VARCHAR(32)  NULL,
  location      VARCHAR(64)  NULL,
  recipe_id     VARCHAR(36)  NULL,
  plan_entry_id VARCHAR(36)  NULL,
  best_before   DATE         NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_stock_user (user_id),
  KEY idx_stock_key (name_key),
  CONSTRAINT fk_stock_user  FOREIGN KEY (user_id)       REFERENCES users (id)        ON DELETE CASCADE,
  CONSTRAINT fk_stock_recipe FOREIGN KEY (recipe_id)    REFERENCES recipes (id)      ON DELETE SET NULL,
  CONSTRAINT fk_stock_entry FOREIGN KEY (plan_entry_id) REFERENCES plan_entries (id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Aus welchen Vorratsposten eine geplante Mahlzeit besteht.
--
-- Nötig, weil eine Mahlzeit nicht immer ein Rezept ist: "1 Portion Reis,
-- 1 Portion Hackfleisch, 1 Portion Salsasoße aus dem Gefrierschrank" sind drei
-- Posten in einem Eintrag. plan_entries.recipe_id bleibt daneben bestehen –
-- beides zusammen ist erlaubt, etwa ein Rezept plus Reis als Beilage.
CREATE TABLE IF NOT EXISTS plan_entry_stock (
  id            VARCHAR(36)   NOT NULL,
  user_id       VARCHAR(36)   NOT NULL,
  plan_entry_id VARCHAR(36)   NOT NULL,
  stock_item_id VARCHAR(36)   NOT NULL,
  -- Wie viele Portionen dieses Postens für die Mahlzeit vorgesehen sind.
  portions      DECIMAL(10,3) NOT NULL DEFAULT 1,
  -- Gesetzt, sobald die Mahlzeit gegessen und der Vorrat abgebucht wurde.
  -- Verhindert doppeltes Abbuchen, wenn der Haken hin und her geht.
  consumed_at   DATETIME      NULL,
  created_at    DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_pes_entry_item (plan_entry_id, stock_item_id),
  KEY idx_pes_user (user_id),
  KEY idx_pes_item (stock_item_id),
  CONSTRAINT fk_pes_user  FOREIGN KEY (user_id)       REFERENCES users (id)         ON DELETE CASCADE,
  CONSTRAINT fk_pes_entry FOREIGN KEY (plan_entry_id) REFERENCES plan_entries (id)  ON DELETE CASCADE,
  CONSTRAINT fk_pes_item  FOREIGN KEY (stock_item_id) REFERENCES stock_items (id)   ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS shopping_list_items (
  id             VARCHAR(36)  NOT NULL,
  user_id        VARCHAR(36)  NOT NULL,
  name           VARCHAR(191) NOT NULL,
  name_key       VARCHAR(191) NOT NULL,
  quantity       DECIMAL(10,3) NULL,
  unit           VARCHAR(32)  NULL,
  -- produce | dairy | meat | frozen | dry | bakery | drinks | household | other
  store_category VARCHAR(32)  NOT NULL DEFAULT 'other',
  -- recipe | manual
  source_type    VARCHAR(16)  NOT NULL DEFAULT 'manual',
  -- open | done
  status         VARCHAR(16)  NOT NULL DEFAULT 'open',
  needed_by_date DATE         NULL,
  done_at        DATETIME     NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_shopping_user_status (user_id, status),
  KEY idx_shopping_key (name_key),
  CONSTRAINT fk_shopping_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Welcher Plan-Eintrag wie viel zu einem zusammengefassten Posten beiträgt.
-- Nur damit lässt sich beim Entfernen eines Rezepts anteilig wieder abziehen.
CREATE TABLE IF NOT EXISTS shopping_list_contributions (
  id            VARCHAR(36)  NOT NULL,
  item_id       VARCHAR(36)  NOT NULL,
  plan_entry_id VARCHAR(36)  NOT NULL,
  quantity      DECIMAL(10,3) NOT NULL,
  unit          VARCHAR(32)  NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_contribution (item_id, plan_entry_id),
  KEY idx_contribution_entry (plan_entry_id),
  CONSTRAINT fk_contrib_item  FOREIGN KEY (item_id)       REFERENCES shopping_list_items (id) ON DELETE CASCADE,
  CONSTRAINT fk_contrib_entry FOREIGN KEY (plan_entry_id) REFERENCES plan_entries (id)        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS = 1;
