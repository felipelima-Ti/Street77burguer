
import { prisma } from "./lib/prisma";
import CheckoutClient from "./checkout-client";

export default async function Home() {
  const [categories, products, tables] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
    }),

   prisma.product.findMany({
  where: {
    available: true,
    stock: { gt: 0 },
  },
  orderBy: {
    position: "asc",
  },
}),

    prisma.restaurantTable.findMany({
      where: { active: true },
      orderBy: { number: "asc" },
    }),
  ]);

  return (
    <CheckoutClient
      categories={categories}
      products={products}
      tables={tables}
    />
  );
}
