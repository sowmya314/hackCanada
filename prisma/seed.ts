import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

type CsvRow = {
  category: string;
  item_name: string;
  pack_count: string;
  unit_type: string;
  raw_label: string;
};

async function main() {
  const csvPath = path.join(process.cwd(), "costco_bulk_grocery_dataset_900_items.csv");
  if (!fs.existsSync(csvPath)) {
    throw new Error(`Dataset missing at ${csvPath}`);
  }

  const csv = fs.readFileSync(csvPath, "utf8");
  const rows = parse(csv, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as CsvRow[];

  await prisma.costcoItem.deleteMany();

  const batchSize = 200;
  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize).map((row) => ({
      category: row.category,
      itemName: row.item_name,
      packCount: Number.parseInt(row.pack_count, 10) || 1,
      unitType: row.unit_type,
      rawLabel: row.raw_label,
    }));
    await prisma.costcoItem.createMany({ data: chunk });
  }

  const existingCommunities = await prisma.community.count();
  if (existingCommunities === 0) {
    await prisma.community.createMany({
      data: [
        {
          name: "Downtown Towers",
          description: "Apartment residents coordinating shared Costco runs.",
          latitude: 43.6532,
          longitude: -79.3832,
        },
        {
          name: "Campus South",
          description: "Students splitting bulk groceries near campus.",
          latitude: 43.6629,
          longitude: -79.3957,
        },
        {
          name: "West End Neighbors",
          description: "Neighborhood Costco pooling and pickup swaps.",
          latitude: 43.644,
          longitude: -79.45,
        },
      ],
    });
  }

  console.log(`Seeded ${rows.length} Costco items.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
