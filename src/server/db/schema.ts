/**
 * Migrations versionadas (PRAGMA user_version). Só acrescente novas versões
 * no fim; nunca edite uma versão já aplicada.
 *
 * Convenções:
 * - datas em ISO 8601 UTC (TEXT);
 * - dinheiro em centavos (INTEGER);
 * - dono de carrinho/curtidas/looks: user_id OU visitor_id (nunca os dois).
 */
export const MIGRATIONS: { version: number; sql: string }[] = [
  {
    version: 1,
    sql: /* sql */ `
      CREATE TABLE users (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'cliente' CHECK (role IN ('cliente', 'admin')),
        created_at    TEXT NOT NULL,
        updated_at    TEXT NOT NULL
      );

      CREATE TABLE sessions (
        token_hash          TEXT PRIMARY KEY,
        user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        created_at          TEXT NOT NULL,
        last_seen_at        TEXT NOT NULL,
        expires_at          TEXT NOT NULL,
        absolute_expires_at TEXT NOT NULL
      );
      CREATE INDEX sessions_user ON sessions(user_id);

      CREATE TABLE visitors (
        id           TEXT PRIMARY KEY,
        token_hash   TEXT NOT NULL UNIQUE,
        created_at   TEXT NOT NULL,
        last_seen_at TEXT NOT NULL,
        expires_at   TEXT NOT NULL
      );

      CREATE TABLE products (
        id               TEXT PRIMARY KEY,
        slug             TEXT NOT NULL UNIQUE,
        position         INTEGER NOT NULL DEFAULT 0,
        name             TEXT NOT NULL,
        short_name       TEXT NOT NULL,
        description      TEXT NOT NULL,
        details          TEXT NOT NULL DEFAULT '[]',
        category         TEXT NOT NULL,
        gender           TEXT NOT NULL CHECK (gender IN ('feminino', 'masculino', 'unissex')),
        collection       TEXT NOT NULL,
        price            INTEGER NOT NULL CHECK (price >= 0),
        compare_at_price INTEGER CHECK (compare_at_price IS NULL OR compare_at_price > 0),
        color_name       TEXT NOT NULL,
        color_hex        TEXT NOT NULL,
        size_chart       TEXT NOT NULL DEFAULT '[]',
        images           TEXT NOT NULL DEFAULT '[]',
        garment          TEXT NOT NULL,
        tags             TEXT NOT NULL DEFAULT '[]',
        rating           REAL NOT NULL DEFAULT 0,
        review_count     INTEGER NOT NULL DEFAULT 0,
        is_new           INTEGER NOT NULL DEFAULT 0,
        is_featured      INTEGER NOT NULL DEFAULT 0,
        search_text      TEXT NOT NULL DEFAULT '',
        created_at       TEXT NOT NULL,
        updated_at       TEXT NOT NULL
      );
      CREATE INDEX products_category ON products(category);

      CREATE TABLE product_sizes (
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        size       TEXT NOT NULL,
        stock      INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
        position   INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (product_id, size)
      );

      CREATE TABLE mannequins (
        id         TEXT PRIMARY KEY,
        name       TEXT NOT NULL,
        body       TEXT NOT NULL CHECK (body IN ('feminino', 'masculino')),
        skin_tone  TEXT NOT NULL,
        hair_style TEXT NOT NULL,
        hair_color TEXT NOT NULL,
        style      TEXT NOT NULL CHECK (style IN ('formal', 'informal')),
        height_cm  INTEGER NOT NULL,
        weight_kg  INTEGER NOT NULL,
        active     INTEGER NOT NULL DEFAULT 1,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE cart_items (
        id         TEXT PRIMARY KEY,
        user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
        visitor_id TEXT REFERENCES visitors(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        size       TEXT NOT NULL,
        quantity   INTEGER NOT NULL CHECK (quantity BETWEEN 1 AND 10),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        CHECK ((user_id IS NULL) <> (visitor_id IS NULL))
      );
      CREATE UNIQUE INDEX cart_user_line ON cart_items(user_id, product_id, size) WHERE user_id IS NOT NULL;
      CREATE UNIQUE INDEX cart_visitor_line ON cart_items(visitor_id, product_id, size) WHERE visitor_id IS NOT NULL;

      CREATE TABLE wishlist (
        user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
        visitor_id TEXT REFERENCES visitors(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        created_at TEXT NOT NULL,
        CHECK ((user_id IS NULL) <> (visitor_id IS NULL))
      );
      CREATE UNIQUE INDEX wishlist_user ON wishlist(user_id, product_id) WHERE user_id IS NOT NULL;
      CREATE UNIQUE INDEX wishlist_visitor ON wishlist(visitor_id, product_id) WHERE visitor_id IS NOT NULL;
      CREATE INDEX wishlist_product ON wishlist(product_id);

      CREATE TABLE looks (
        id         TEXT PRIMARY KEY,
        user_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
        visitor_id TEXT REFERENCES visitors(id) ON DELETE CASCADE,
        name       TEXT NOT NULL,
        body       TEXT NOT NULL,
        items      TEXT NOT NULL,
        created_at TEXT NOT NULL,
        CHECK ((user_id IS NULL) <> (visitor_id IS NULL))
      );
      CREATE INDEX looks_user ON looks(user_id);
      CREATE INDEX looks_visitor ON looks(visitor_id);

      CREATE TABLE orders (
        id             TEXT PRIMARY KEY,
        number         TEXT NOT NULL UNIQUE,
        user_id        TEXT REFERENCES users(id) ON DELETE SET NULL,
        visitor_id     TEXT REFERENCES visitors(id) ON DELETE SET NULL,
        status         TEXT NOT NULL CHECK (status IN ('pago', 'aguardando-pagamento', 'enviado', 'cancelado')),
        payment_method TEXT NOT NULL CHECK (payment_method IN ('pix', 'cartao')),
        customer_name  TEXT NOT NULL,
        email          TEXT NOT NULL,
        cpf            TEXT,
        cep            TEXT NOT NULL,
        street         TEXT NOT NULL,
        number_addr    TEXT NOT NULL,
        complement     TEXT,
        district       TEXT NOT NULL,
        city           TEXT NOT NULL,
        state          TEXT NOT NULL,
        subtotal       INTEGER NOT NULL,
        shipping       INTEGER NOT NULL,
        total          INTEGER NOT NULL,
        created_at     TEXT NOT NULL,
        updated_at     TEXT NOT NULL
      );
      CREATE INDEX orders_user ON orders(user_id);
      CREATE INDEX orders_visitor ON orders(visitor_id);

      CREATE TABLE order_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id   TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT REFERENCES products(id) ON DELETE SET NULL,
        slug       TEXT NOT NULL,
        name       TEXT NOT NULL,
        image      TEXT NOT NULL,
        size       TEXT NOT NULL,
        quantity   INTEGER NOT NULL CHECK (quantity > 0),
        unit_price INTEGER NOT NULL,
        line_total INTEGER NOT NULL
      );
      CREATE INDEX order_items_order ON order_items(order_id);

      CREATE TABLE newsletter (
        email      TEXT PRIMARY KEY COLLATE NOCASE,
        created_at TEXT NOT NULL
      );

      CREATE TABLE audit_log (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        actor_user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
        actor_email   TEXT,
        action        TEXT NOT NULL,
        entity        TEXT NOT NULL,
        entity_id     TEXT,
        details       TEXT,
        ip_hash       TEXT,
        created_at    TEXT NOT NULL
      );
      CREATE INDEX audit_created ON audit_log(created_at);

      CREATE TABLE login_attempts (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        kind       TEXT NOT NULL,
        email      TEXT,
        ip_hash    TEXT,
        success    INTEGER NOT NULL,
        reason     TEXT,
        created_at TEXT NOT NULL
      );
      CREATE INDEX login_attempts_email ON login_attempts(email, created_at);
    `,
  },
];

export const SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;
