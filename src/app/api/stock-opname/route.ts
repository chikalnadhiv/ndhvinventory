import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await prisma.stockOpname.findMany({
    orderBy: { createdAt: 'desc' }
  });
  return NextResponse.json(records);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();
    console.log("Stock Opname POST body:", body);
    const { inventoryId, kd_brg, barcode, nm_brg, systemQty, physicalQty, difference, satuan, hrg_beli, rackNo, userName, division } = body;

    const newRecord = await (prisma.stockOpname as any).create({
      data: {
        inventoryId,
        kd_brg,
        barcode,
        nm_brg,
        systemQty,
        physicalQty,
        difference,
        satuan,
        hrg_beli: Number(hrg_beli) || 0,
        rackNo,
        userName,
        division
      }
    });


    return NextResponse.json(newRecord);
  } catch (error) {
    console.error("Stock Opname save error:", error);
    return NextResponse.json({ error: "Failed to save stock opname record", details: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await prisma.stockOpname.deleteMany();
    return NextResponse.json({ message: "History cleared" });
  } catch (error) {
    return NextResponse.json({ error: "Failed to clear history" }, { status: 500 });
  }
}
