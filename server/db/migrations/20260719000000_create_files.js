export async function up(knex) {
  await knex.schema.createTable("files", (t) => {
    t.increments("id").primary();
    t.text("slug").notNullable().unique();
    t.text("filename").notNullable();
    t.text("mime_type").notNullable();
    t.bigInteger("size").notNullable();
    t.text("b2_key").notNullable();
    t.text("sender").nullable();
    t.text("receiver").nullable();
    t.timestamp("created_at", { useTz: true }).notNullable().defaultTo(knex.fn.now());
    t.timestamp("expires_at", { useTz: true }).notNullable();
    t.index("expires_at");
  });
}

export async function down(knex) {
  await knex.schema.dropTableIfExists("files");
}
