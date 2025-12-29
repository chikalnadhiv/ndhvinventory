import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    // Fetch only items with images
    const itemsWithImages = await prisma.inventoryItem.findMany({
      where: {
        imageUrl: {
          not: null
        }
      },
      select: {
        kd_brg: true,
        barcode: true,
        imageUrl: true
      }
    });

    return NextResponse.json(itemsWithImages);
  } catch (error) {
    console.error("Failed to fetch image backup:", error);
    return NextResponse.json({ error: "Failed to fetch images" }, { status: 500 });
  }
}
