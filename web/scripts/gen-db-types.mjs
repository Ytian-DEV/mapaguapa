#!/usr/bin/env node
// Generates src/lib/database.ts from a LOCAL Postgres that has the migrations
// applied (see supabase/tests/run.sh). Output follows the `supabase gen types`
// shape so supabase-js can type queries.
//
//   PSQL="C:/Program Files/PostgreSQL/18/bin/psql.exe" PGPORT=54329 node scripts/gen-db-types.mjs
//
// Env: PSQL, PGHOST (default 127.0.0.1), PGPORT (5432), PGUSER (postgres), TEST_DB (mapaguapa_test)

import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const out = resolve(here, "../src/lib/database.ts");

function query(sql) {
  const output = execFileSync(
    process.env.PSQL || "psql",
    [
      "-h", process.env.PGHOST || "127.0.0.1",
      "-p", process.env.PGPORT || "5432",
      "-U", process.env.PGUSER || "postgres",
      "-d", process.env.TEST_DB || "mapaguapa_test",
      "-tAX", "-v", "ON_ERROR_STOP=1",
      "-c", `select coalesce(json_agg(t), '[]') from (${sql}) t`,
    ],
    { encoding: "utf8" }
  );
  return JSON.parse(output.trim());
}

const tsType = (pgType, isArray = false) => {
  const base = pgType.replace(/^_/, "");
  const scalar =
    ["int2", "int4", "int8", "float4", "float8", "numeric"].includes(base) ? "number"
    : base === "bool" ? "boolean"
    : ["json", "jsonb"].includes(base) ? "Json"
    : base === "void" ? "undefined"
    : "string";
  return isArray || pgType.startsWith("_") ? `${scalar}[]` : scalar;
};

const relations = query(`
  select c.relname as name, c.relkind as kind
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('r', 'v')
  order by c.relname
`);

const columns = query(`
  select table_name, column_name, udt_name, is_nullable = 'YES' as nullable,
         column_default is not null or is_identity = 'YES' as has_default,
         is_generated = 'ALWAYS' or identity_generation = 'ALWAYS' as generated
  from information_schema.columns
  where table_schema = 'public'
  order by table_name, ordinal_position
`);

const functions = query(`
  select p.proname as name,
         coalesce(p.proargnames, '{}') as arg_names,
         coalesce(p.proargmodes, '{}') as arg_modes,
         coalesce((select array_agg(format_type(t, null) order by i)
                   from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality a(t, i)), '{}') as arg_types,
         coalesce((select array_agg(typname order by i)
                   from unnest(coalesce(p.proallargtypes, p.proargtypes::oid[])) with ordinality a(t, i)
                   join pg_type ty on ty.oid = a.t), '{}') as arg_udts,
         p.pronargdefaults as n_defaults,
         p.pronargs as n_in,
         rt.typname as return_type,
         p.proretset as returns_set
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  join pg_type rt on rt.oid = p.prorettype
  where n.nspname = 'public'
    and rt.typname <> 'trigger'
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
  order by p.proname
`);

const foreignKeys = query(`
  select con.conname as name,
         rel.relname as table_name,
         ref.relname as referenced_relation,
         (select array_agg(a.attname order by k.i) from unnest(con.conkey) with ordinality k(n, i)
            join pg_attribute a on a.attrelid = con.conrelid and a.attnum = k.n) as columns,
         (select array_agg(a.attname order by k.i) from unnest(con.confkey) with ordinality k(n, i)
            join pg_attribute a on a.attrelid = con.confrelid and a.attnum = k.n) as referenced_columns,
         exists (
           select 1 from pg_index ix
           where ix.indrelid = con.conrelid and ix.indisunique
             and (select array_agg(x order by x) from unnest(ix.indkey::int2[]) x) =
                 (select array_agg(x order by x) from unnest(con.conkey) x)
         ) as one_to_one
  from pg_constraint con
  join pg_class rel on rel.oid = con.conrelid
  join pg_class ref on ref.oid = con.confrelid
  join pg_namespace n on n.oid = rel.relnamespace
  join pg_namespace rn on rn.oid = ref.relnamespace
  where con.contype = 'f' and n.nspname = 'public' and rn.nspname = 'public'
  order by rel.relname, con.conname
`);

const relationshipsOf = (table) => {
  const items = foreignKeys
    .filter((fk) => fk.table_name === table)
    .map((fk) =>
      [
        "{",
        `  foreignKeyName: "${fk.name}";`,
        `  columns: [${fk.columns.map((c) => `"${c}"`).join(", ")}];`,
        `  isOneToOne: ${fk.one_to_one};`,
        `  referencedRelation: "${fk.referenced_relation}";`,
        `  referencedColumns: [${fk.referenced_columns.map((c) => `"${c}"`).join(", ")}];`,
        "}",
      ].join("\n")
    );
  return items.length ? `[\n${indent(items.join(",\n"), 2)}\n]` : "[]";
};

const byTable = new Map();
for (const column of columns) {
  if (!byTable.has(column.table_name)) byTable.set(column.table_name, []);
  byTable.get(column.table_name).push(column);
}

const indent = (text, spaces) => text.split("\n").map((line) => (line ? " ".repeat(spaces) + line : line)).join("\n");

function rowType(table, mode) {
  const lines = (byTable.get(table) ?? [])
    .filter((column) => !(mode !== "Row" && column.generated))
    .map((column) => {
      const type = tsType(column.udt_name) + (column.nullable ? " | null" : "");
      const optional = mode === "Update" || (mode === "Insert" && (column.nullable || column.has_default));
      return `${column.column_name}${optional ? "?" : ""}: ${type};`;
    });
  return `{\n${indent(lines.join("\n"), 2)}\n}`;
}

const tables = relations.filter((relation) => relation.kind === "r");
const views = relations.filter((relation) => relation.kind === "v");

const tableBlock = tables
  .map((table) => `${table.name}: {\n  Row: ${indent(rowType(table.name, "Row"), 2).trimStart()};\n  Insert: ${indent(rowType(table.name, "Insert"), 2).trimStart()};\n  Update: ${indent(rowType(table.name, "Update"), 2).trimStart()};\n  Relationships: ${indent(relationshipsOf(table.name), 2).trimStart()};\n};`)
  .join("\n");

const viewBlock = views
  .map((view) => `${view.name}: {\n  Row: ${indent(rowType(view.name, "Row"), 2).trimStart()};\n  Relationships: [];\n};`)
  .join("\n");

const functionBlock = functions
  .map((fn) => {
    const inArgs = [];
    const outCols = [];
    fn.arg_names.forEach((name, index) => {
      const mode = fn.arg_modes[index] ?? "i";
      const udt = fn.arg_udts[index];
      if (mode === "i" || mode === "b") {
        const inIndex = inArgs.length;
        const hasDefault = inIndex >= fn.n_in - fn.n_defaults;
        inArgs.push(`${name}${hasDefault ? "?" : ""}: ${tsType(udt)};`);
      } else if (mode === "t" || mode === "o") {
        outCols.push(`${name}: ${tsType(udt)} | null;`);
      }
    });
    const args = inArgs.length ? `{\n${indent(inArgs.join("\n"), 2)}\n}` : "Record<PropertyKey, never>";
    let returns;
    if (outCols.length) {
      returns = `{\n${indent(outCols.join("\n"), 2)}\n}[]`;
    } else if (byTable.has(fn.return_type)) {
      returns = `Database["public"]["Tables"]["${fn.return_type}"]["Row"]${fn.returns_set ? "[]" : ""}`;
    } else {
      returns = tsType(fn.return_type) + (fn.returns_set ? "[]" : "");
    }
    return `${fn.name}: {\n  Args: ${indent(args, 2).trimStart()};\n  Returns: ${indent(returns, 2).trimStart()};\n};`;
  })
  .join("\n");

const file = `// Generated by scripts/gen-db-types.mjs from the migrations in supabase/migrations.
// Do not edit by hand: change a migration, run supabase/tests/run.sh, then regenerate.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
${indent(tableBlock, 6)}
    };
    Views: {
${indent(viewBlock, 6)}
    };
    Functions: {
${indent(functionBlock, 6)}
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

type PublicSchema = Database["public"];
export type Tables<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Row"];
export type TablesInsert<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Insert"];
export type TablesUpdate<T extends keyof PublicSchema["Tables"]> = PublicSchema["Tables"][T]["Update"];
export type Views<T extends keyof PublicSchema["Views"]> = PublicSchema["Views"][T]["Row"];
`;

writeFileSync(out, file);
console.log(`Wrote ${out} (${tables.length} tables, ${views.length} views, ${functions.length} functions)`);
