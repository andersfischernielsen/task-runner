/**
 * Script to generate Zod schemas and TypeScript types from JSON schemas.
 *
 * Usage: bun run scripts/generate-messages.ts
 */

import { readdir, readFile, writeFile, mkdir } from "fs/promises";
import { join, basename } from "path";
import { jsonSchemaToZod } from "json-schema-to-zod";

const SCHEMAS_DIR = "../samples/schemas/messages";
const TOPICS_FILE = "../samples/schemas/topics.json";
const OUTPUT_FILE = "./src/messages.generated.ts";

async function main() {
  const schemasPath = join(import.meta.dir, "..", SCHEMAS_DIR);
  const topicsPath = join(import.meta.dir, "..", TOPICS_FILE);
  const outputPath = join(import.meta.dir, "..", OUTPUT_FILE);

  console.log(`Reading schemas from: ${schemasPath}`);

  const files = await readdir(schemasPath);
  const jsonFiles = files.filter((f) => f.endsWith(".json"));

  if (jsonFiles.length === 0) {
    console.error("No JSON schema files found");
    process.exit(1);
  }

  console.log(`Found ${jsonFiles.length} schema file(s)`);

  let topicEnum = "";
  try {
    const topicsContent = await readFile(topicsPath, "utf-8");
    const topicsSchema = JSON.parse(topicsContent);
    if (topicsSchema.enum && Array.isArray(topicsSchema.enum)) {
      const enumValues = topicsSchema.enum
        .map((value: string) => `  ${value} = "${value}"`)
        .join(",\n");
      topicEnum = `export enum Topic {\n${enumValues},\n}`;
      console.log(
        `Generated Topic enum with ${topicsSchema.enum.length} values`,
      );
    }
  } catch (error) {
    console.error("Error reading topics.json:", error);
  }

  const generatedSchemas: string[] = [];
  const generatedTypes: string[] = [];

  for (const file of jsonFiles) {
    const filePath = join(schemasPath, file);
    const content = await readFile(filePath, "utf-8");

    try {
      const schema = JSON.parse(content);
      const schemaName = schema.title || pascalCase(basename(file, ".json"));
      const zodSchemaName = camelCase(schemaName) + "Schema";

      console.log(`Processing: ${file} -> ${schemaName}`);

      const zodCode = jsonSchemaToZod(schema, {
        name: zodSchemaName,
        module: "esm",
        type: true,
      });

      const schemaLines = zodCode
        .split("\n")
        .filter((line) => !line.startsWith("import"))
        .join("\n")
        .trim();

      generatedSchemas.push(schemaLines);
      generatedTypes.push(
        `export type ${schemaName} = z.infer<typeof ${zodSchemaName}>;`,
      );
    } catch (error) {
      console.error(`Error processing ${file}:`, error);
    }
  }

  const output = `// This file is auto-generated from JSON schemas.
// Do not edit manually. Run 'bun run generate:messages' to regenerate.

import { z } from "zod";

${topicEnum ? topicEnum + "\n\n" : ""}${generatedSchemas.join("\n\n")}

// Inferred TypeScript types
${generatedTypes.join("\n")}
`;

  await writeFile(outputPath, output, "utf-8");
  console.log(`Generated: ${outputPath}`);
}

function pascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join("");
}

function camelCase(str: string): string {
  const pascal = pascalCase(str);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

main().catch(console.error);
