import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const form = await req.formData();
    const file = form.get("file") as File | null;
    const userId = form.get("userId") as string | null;

    if (!file || !userId) {
      return NextResponse.json({ error: "Missing file or userId" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buf = Buffer.from(bytes);

    const raw = file.name.split(".").pop() ?? "jpg";
    const ext = raw.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 5) || "jpg";
    const filename = `${userId}-${Date.now()}.${ext}`;
    const dir = path.join(process.cwd(), "public", "avatars");

    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, filename), buf);

    return NextResponse.json({ imageUrl: `/avatars/${filename}` });
  } catch (err) {
    console.error("Avatar upload error:", err);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }
}
