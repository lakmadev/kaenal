import { config } from "dotenv";

// Tests read the same .env the dev server does; CI supplies the vars directly.
config({ path: new URL("../../../.env", import.meta.url).pathname });
