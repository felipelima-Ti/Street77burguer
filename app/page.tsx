import { prisma } from "./lib/prisma";
import CheckoutClient from "./checkout-client";

// Ordem das abas do cardápio (slugs). Slugs fora da lista vão para o final.
const CATEGORY_ORDER = [
  "burgers",
  "linha-smash",
  "acompanhamentos",
  "bebidas",
  "sobremesas",
];

function categoryRank(slug: string) {
  const index = CATEGORY_ORDER.indexOf(slug);
  return index === -1 ? CATEGORY_ORDER.length : index;
}

// Evita cache: o cardápio e o estoque sempre refletem o banco
export const dynamic = "force-dynamic";

export default async function Home() {
  const [categories, products, tables] = await Promise.all([
    prisma.category.findMany({
      where: { active: true },
    }),

    prisma.product.findMany({
      where: {
        available: true,
        stock: { gt: 0 },
      },
      orderBy: { position: "asc" },
    }),

    prisma.restaurantTable.findMany({
      where: { active: true },
      orderBy: { number: "asc" },
    }),
  ]);

  const sortedCategories = [...categories].sort(
    (a, b) => categoryRank(a.slug) - categoryRank(b.slug)
  );

  return (
    <CheckoutClient
      categories={sortedCategories}
      products={products}
      tables={tables}
    />
  );
}
