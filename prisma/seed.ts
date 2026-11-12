import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando cadastro dos dados...");

  // "Hambúrgueres" passa a ser "Burgers"; os produtos continuam ligados à categoria
  const oldBurgers = await prisma.category.findUnique({
    where: { slug: "hamburgueres" },
  });
  const newBurgers = await prisma.category.findUnique({
    where: { slug: "burgers" },
  });

  if (oldBurgers && !newBurgers) {
    await prisma.category.update({
      where: { id: oldBurgers.id },
      data: { name: "Burgers", slug: "burgers", active: true },
    });
  } else if (oldBurgers && newBurgers) {
    await prisma.product.updateMany({
      where: { categoryId: oldBurgers.id },
      data: { categoryId: newBurgers.id },
    });
    await prisma.category.update({
      where: { id: oldBurgers.id },
      data: { active: false },
    });
  }

  // CATEGORIAS (nomes conforme o cardápio)
  const categories = [
    { name: "Burgers", slug: "burgers" },
    { name: "Linha Smash", slug: "linha-smash" },
    { name: "Entradinhas", slug: "acompanhamentos" },
    { name: "Bebidas", slug: "bebidas" },
    { name: "Sobremesas", slug: "sobremesas" },
  ];

  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: { name: category.name, active: true },
      create: category,
    });
  }

  console.log("Categorias cadastradas!");

  const allCategories = await prisma.category.findMany();
  const categoryMap = Object.fromEntries(
    allCategories.map((category) => [category.slug, category.id])
  );

  // PRODUTOS (preços em centavos; cada barcode precisa ser único)
  const products = [
    // BURGERS
    {
      name: "77 ORIGINAL",
      description: "Pão brioche, blend bovino 160g, cheddar fatiado, bacon crocante, ovo, vinagrete e maionese da casa.",
      price: 3490,
      stock: 50,
      barcode: "100070000011",
      category: "burgers",
    },
    {
      name: "THE OG",
      description: "Pão brioche, blend bovino 160g, cheddar fatiado e maionese da casa.",
      price: 2990,
      stock: 50,
      barcode: "100000500001",
      category: "burgers",
    },
    {
      name: "CLASSIC 77",
      description: "Pão brioche, blend bovino 160g, cheddar fatiado, alface, tomate, cebola e maionese da casa.",
      price: 3190,
      stock: 50,
      barcode: "100002000001",
      category: "burgers",
    },
    {
      name: "MEX STREET",
      description: "Pão brioche, blend bovino 160g, cheddar fatiado, guacamole, pico de gallo, jalapeño e maionese da casa.",
      price: 3890,
      stock: 50,
      barcode: "100002000011",
      category: "burgers",
    },
    {
      name: "STREET BBQ",
      description: "Pão brioche, blend bovino 160g, queijo provolone, bacon, barbecue defumado e maionese da casa.",
      price: 3790,
      stock: 50,
      barcode: "100070000001",
      category: "burgers",
    },
    {
      name: "MELT BRIE",
      description: "Pão brioche, blend bovino 160g, brie, cebola caramelizada e molho de mostarda e mel.",
      price: 3890,
      stock: 50,
      barcode: "100000400001",
      category: "burgers",
    },
    {
      name: "NAPOLI",
      description: "Pão brioche, blend bovino 160g, grana padano, tomate confit, manjericão e maionese da casa.",
      price: 3990,
      stock: 50,
      barcode: "100009000001",
      category: "burgers",
    },
    {
      name: "BLUE OUTLAW",
      description: "Pão brioche, blend bovino 160g, blue cheese, bacon crocante, cebola caramelizada e maionese da casa.",
      price: 4190,
      stock: 50,
      barcode: "100010000001",
      category: "burgers",
    },

    // LINHA SMASH
    {
      name: "Smash Simples",
      description: "Pão brioche, smash bovino 100g, cheddar e molho da casa.",
      price: 2190,
      stock: 25,
      barcode: "100100200008",
      category: "linha-smash",
    },
    {
      name: "Smash Duplo",
      description: "Pão brioche, 2 smashs bovinos de 100g, dupla cheddar e molho da casa.",
      price: 2690,
      stock: 25,
      barcode: "100500000008",
      category: "linha-smash",
    },
    {
      name: "Smash Bacon",
      description: "Pão brioche, smash bovino 100g, cheddar, bacon crocante e molho da casa.",
      price: 2590,
      stock: 25,
      barcode: "100080000008",
      category: "linha-smash",
    },
    {
      name: "Smash Duplo Bacon",
      description: "Pão brioche, 2 smashs bovinos de 100g, dupla cheddar, bacon crocante e molho da casa.",
      price: 3090,
      stock: 25,
      barcode: "100020000008",
      category: "linha-smash",
    },
    {
      name: "Smash Salada",
      description: "Pão brioche, smash bovino 100g, cheddar, alface, tomate e maionese da casa.",
      price: 2490,
      stock: 25,
      barcode: "100070000008",
      category: "linha-smash",
    },

    // ENTRADINHAS
    {
      name: "CHICKEN BBQ",
      description: "Tiras de frango empanadas e super crocantes, servidas com molho barbecue e cheddar cremoso à parte.",
      price: 3290,
      stock: 50,
      barcode: "100030000001",
      category: "acompanhamentos",
    },
    {
      name: "BATATA PULLED PORK",
      description: "Batatas crocantes cobertas com pulled pork, molho barbecue e jalapeño, acompanhadas de sour cream e cheddar cremoso.",
      price: 3490,
      stock: 40,
      barcode: "100005000002",
      category: "acompanhamentos",
    },
    {
      name: "BATATA FRITA 77",
      description: "Batatas crocantes temperadas com páprica e finalizadas com cebolinha fresca.",
      price: 2990,
      stock: 30,
      barcode: "100020000003",
      category: "acompanhamentos",
    },
    {
      name: "BATATA FRITA",
      description: "Batatas crocantes.",
      price: 2490,
      stock: 50,
      barcode: "100000200004",
      category: "acompanhamentos",
    },
    {
      name: "BATATA INDIVIDUAL",
      description: "Porção individual de batatas fritas.",
      price: 990,
      stock: 50,
      barcode: "1000550000004",
      category: "acompanhamentos",
    },

    // BEBIDAS
    {
      name: "CHOPP 300ML",
      description: "Chopp 300ml.",
      price: 1290,
      stock: 100,
      barcode: "100200000006",
      category: "bebidas",
    },
    {
      name: "CHOPP 500ML",
      description: "Chopp 500ml.",
      price: 1490,
      stock: 100,
      barcode: "100002000029",
      category: "bebidas",
    },
    {
      name: "COCA-COLA",
      description: "Refrigerante Coca-Cola lata 350ml.",
      price: 790,
      stock: 100,
      barcode: "100000300006",
      category: "bebidas",
    },
    {
      name: "FANTA",
      description: "Refrigerante Fanta lata 350ml.",
      price: 790,
      stock: 100,
      barcode: "100000102008",
      category: "bebidas",
    },
    {
      name: "SPRITE",
      description: "Refrigerante Sprite lata 350ml.",
      price: 790,
      stock: 100,
      barcode: "100000002017",
      category: "bebidas",
    },
    {
      name: "ÁGUA",
      description: "Água 500ml.",
      price: 490,
      stock: 100,
      barcode: "100000002027",
      category: "bebidas",
    },
    {
      name: "ÁGUA COM GÁS",
      description: "Água com gás 500ml.",
      price: 490,
      stock: 100,
      barcode: "100000002007",
      category: "bebidas",
    },
    {
      name: "SUCO NATURAL",
      description: "Suco natural de laranja 400ml.",
      price: 1190,
      stock: 100,
      barcode: "10010002007",
      category: "bebidas",
    },
    {
      name: "HEINEKEN",
      description: "Cerveja Heineken long neck.",
      price: 1290,
      stock: 30,
      barcode: "100005000007",
      category: "bebidas",
    },
    {
      name: "BUDWEISER",
      description: "Cerveja Budweiser long neck.",
      price: 1290,
      stock: 30,
      barcode: "100300000018",
      category: "bebidas",
    },
    {
      name: "CORONA",
      description: "Cerveja Corona long neck.",
      price: 1390,
      stock: 30,
      barcode: "102000000021",
      category: "bebidas",
    },

    // SOBREMESAS
    {
      name: "BROWNIE",
      description: "Brownie de chocolate.",
      price: 1290,
      stock: 25,
      barcode: "100090000008",
      category: "sobremesas",
    },
    {
      name: "PUDIM DE LEITE CONDENSADO",
      description: "Pudim de leite condensado.",
      price: 1990,
      stock: 25,
      barcode: "100400000008",
      category: "sobremesas",
    },
  ];

  // Garante que não há barcode repetido antes de gravar
  const seen = new Set<string>();
  for (const p of products) {
    if (seen.has(p.barcode)) {
      throw new Error(`Barcode repetido: ${p.barcode} (${p.name})`);
    }
    seen.add(p.barcode);
  }

  for (const [index, product] of products.entries()) {
    const categoryId = categoryMap[product.category];

    if (!categoryId) {
      throw new Error(`Categoria não encontrada: ${product.category}`);
    }

    const { category, stock, ...data } = product;

    await prisma.product.upsert({
      where: { barcode: product.barcode },
      // O estoque não é alterado ao rodar o seed de novo
      update: {
        ...data,
        categoryId,
        available: true,
        position: index + 1,
      },
      create: {
        ...data,
        stock,
        categoryId,
        position: index + 1,
      },
    });
  }

  // Produtos que não estão mais no cardápio (ex.: SMOKE, BERLIN) ficam indisponíveis.
  // Nada é apagado, então o histórico de pedidos é preservado.
  const removed = await prisma.product.updateMany({
    where: { barcode: { notIn: Array.from(seen) } },
    data: { available: false },
  });

  console.log(`Produtos cadastrados! (${removed.count} fora do cardápio desativados)`);

  // MESAS
  for (let number = 1; number <= 10; number++) {
    await prisma.restaurantTable.upsert({
      where: { number },
      update: { active: true },
      create: { number },
    });
  }

  console.log("10 mesas cadastradas!");
  console.log("Seed executado com sucesso!");
}

main()
  .catch((error) => {
    console.error("Erro ao executar seed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
