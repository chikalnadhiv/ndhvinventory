import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function PATCH(
  req: Request,
  { params }: { params: any }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const { physicalQty, difference } = body;

    const updated = await prisma.stockOpname.update({
      where: { id },
      data: {
        physicalQty,
        difference,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error("Stock Opname update error:", error);
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 });
  }
}

export async function DELETE(
  req: Request,
  { params }: { params: any }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const { id } = await params;
    await prisma.stockOpname.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Record deleted" });
  } catch (error) {
    console.error("Stock Opname delete error:", error);
    return NextResponse.json({ error: "Failed to delete record" }, { status: 500 });
  }
}
