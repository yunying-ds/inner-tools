import postgres from "postgres";
import { NextRequest, NextResponse } from "next/server";

const sql = postgres(process.env.DATABASE_URL!);

export async function POST(req: NextRequest) {
  const { content } = await req.json();
  if (!content?.trim()) return NextResponse.json({ ok: false }, { status: 400 });

  try {
    await sql`INSERT INTO feedback (content) VALUES (${content.trim()})`;
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[feedback]", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
