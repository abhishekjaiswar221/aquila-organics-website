import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { EmailMessage, EmailProvider } from "./types";

// Development driver: mail never leaves the machine. One JSON file per message.
export class DevEmailProvider implements EmailProvider {
  private readonly dir: string;

  constructor(dir: string = path.resolve(process.cwd(), "storage", "outbox")) {
    // The outbox directory is a runtime path chosen by configuration; without this hint Turbopack
    // traces the whole project into the server output for a development-only driver.
    this.dir = path.resolve(/*turbopackIgnore: true*/ dir);
  }

  async send(msg: EmailMessage): Promise<void> {
    await mkdir(this.dir, { recursive: true });
    // Filename comes only from a timestamp and a random id, never user input.
    const name = `${Date.now()}-${randomUUID()}.json`;
    await writeFile(
      path.join(this.dir, name),
      JSON.stringify({ ...msg, subject: msg.subject.replace(/[\r\n]+/g, " ") }, null, 2),
      { flag: "wx" },
    );
    console.info(
      `[email:dev] ${name} to=${msg.to.length} recipient(s) subject=${JSON.stringify(
        msg.subject.replace(/[\r\n]+/g, " "),
      )}`,
    );
  }
}
