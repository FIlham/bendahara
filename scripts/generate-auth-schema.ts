// Regenerates src/db/auth-schema.ts from the Better Auth config.
//
// Why not the official CLI? `bun x @better-auth/cli generate` loads our
// config under Node (via jiti), where the `bun:sqlite` import in src/db
// fails. This runs the CLI's own drizzle generator under Bun instead —
// same code path, same output.
import { auth } from "../src/lib/auth";

const [chunk] = [
  ...new Bun.Glob("generators-*.mjs").scanSync(
    "node_modules/@better-auth/cli/dist",
  ),
];
if (!chunk) {
  throw new Error("@better-auth/cli generators chunk not found");
}
// NOTE: the chunk exports the generator under a minified alias (`o`).
const { o: generateDrizzleSchema }: {
  o: (args: {
    options: typeof auth.options;
    adapter: unknown;
    file: string;
  }) => Promise<{ code: string; fileName: string; overwrite: boolean }>;
} = await import(`../node_modules/@better-auth/cli/dist/${chunk}`);

// The generator only reads `adapter.options.provider` (plus optional
// usePlural/camelCase flags), so a stub matching our drizzleAdapter config
// is equivalent to the resolved adapter instance here.
const DB_PROVIDER = "pg"; // "sqlite" | "pg" | "mysql"
const { code, fileName } = await generateDrizzleSchema({
  options: auth.options,
  adapter: { options: { provider: DB_PROVIDER } },
  file: "./src/db/auth-schema.ts",
});

await Bun.write(fileName, code);
console.log(`wrote ${fileName}`);
