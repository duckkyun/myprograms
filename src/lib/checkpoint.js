import fs from "node:fs/promises";

export async function loadProgress(progressPath) {
  try {
    const raw = await fs.readFile(progressPath, "utf8");
    return JSON.parse(raw);
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function saveProgress(progressPath, payload) {
  await fs.writeFile(progressPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
}

export async function deleteProgress(progressPath) {
  try {
    await fs.unlink(progressPath);
  } catch (error) {
    if (!error || error.code !== "ENOENT") {
      throw error;
    }
  }
}

