
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando cadastro dos dados...");

  // CATEGORIAS
  const categories = [
    { name: "Hambúrgueres", slug: "hamburgueres" },
    { name: "Bebidas", slug: "bebidas" },
    { name: "Acompanhamentos", slug: "acompanhamentos" },
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

  // BUSCAR CATEGORIAS
  const allCategories = await prisma.category.findMany();

  const categoryMap = Object.fromEntries(
    allCategories.map((category) => [
      category.slug,
      category.id,
    ])
  );

  // PRODUTOS
  const products = [
    {
      name: "CHICKEN BBQ",
      description: "Tiras de frango empanadas e super crocantes,servidas com molho barbecue e cheddar cremoso a parte.",
      price: 3290,
      stock: 50,
      barcode: "100030000001",
      category: "hamburgueres",
    },
     {
      name: "77 0RIGINAL",
      description: "Pao brioche, blend bovino 160g, cheddar fatiado, bacon crocante,ovo, vinagrete e maionese da casa.",
      price: 3490,
      stock: 50,
      barcode: "100070000001",
      category: "hamburgueres",
    },
      {
      name: "SMOKE",
      description: "Pao brioche, blend bovino 160g, cheddar fatiado, bacon, picles e molho barbecue.",
      price: 3190,
      stock: 50,
      barcode: "1004500000001",
      category: "hamburgueres",
    },
      {
      name: "MEX STREET",
      description: "Pao brioche, blend bovino 160g, cheddar fatiado, guacamole, pico de gallo, jalapeño e maionese da casa.",
      price: 3890,
      stock: 50,
      barcode: "100002000001",
      category: "hamburgueres",
    },
      {
      name: "NAPOLI",
      description: "Pao brioche, blend bovino 160g, grana padano, tomate confit, manjericão e maionese da casa.",
      price: 3990,
      stock: 50,
      barcode: "100009000001",
      category: "hamburgueres",
    },
      {
      name: "MELT BRIE",
      description: "Pão brioche, blend bovino 160g, queijo brie, cebola caramelizada e molho de mostarda e mel.",
      price: 3890,
      stock: 50,
      barcode: "100000400001",
      category: "hamburgueres",
    },
    {
      name: "BERLIN",
      description: "Pão brioche, blend bovino 160g, queijo prato, bacon, cebola roxa grelhada e maionese da casa.",
      price: 3790,
      stock: 50,
      barcode: "100000800001",
      category: "hamburgueres",
    },
    {
      name: "STREET BBQ",
      description: "Pão brioche, blend bovino 160g, fatia generosa de provolone, bacon, barbacue defumado, e maionese da casa.",
      price: 3790,
      stock: 50,
      barcode: "100070000001",
      category: "hamburgueres",
    },
    {
      name: "BLUE OUTLAW",
      description: "Pão brioche, blend bovino 160g, fatia generosa de provolone, bacon, barbacue defumado, e maionese da casa.",
      price: 4190,
      stock: 50,
      barcode: "100010000001",
      category: "hamburgueres",
    },
       {
      name: "CLASSIC 77",
      description: "Pão brioche, blend bovino 160g, cheddar fatiado, alface, tomate, cebola e maionese da casa.",
      price: 3190,
      stock: 50,
      barcode: "100002000001",
      category: "hamburgueres",
    },


    {
      name: "BATATA PULLED PORK",
      description: "Batata crocantes cobertas com pulled pork, molho barbecue e jalapeño acompanhados de sour cream e cheddar cremoso.",
      price: 3490,
      stock: 40,
      barcode: "100005000002",
      category: "acompanhamentos",
    },
    {
      name: "BATATA FRITA 77",
      description: "Batatas crocantes temperadas com paprica e finalizadas com cebolinha fresca",
      price: 2990,
      stock: 30,
      barcode: "100020000003",
      category: "acompanhamentos",
    },
    {
      name: "BATATA FRITA",
      description: "Porção de batatas fritas crocantes.",
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
    {
      name: "CHOPP300ML",
      description: "300ml de chopp gelado.",
      price: 1290,
      stock: 100,
      barcode: "100200000006",
      category: "bebidas",
    },
      {
      name: "CHOPP500ML",
      description: "500ml de chopp gelado.",
      price: 1490,
      stock: 100,
      barcode: "100002000029",
      category: "bebidas",
    },
    {
      name: "HEINEKEN LONG NECK",
      description: "Cerveja Heineken.",
      price: 1290,
      stock: 30,
      barcode: "100005000007",
      category: "bebidas",
    },
      {
      name: "BUDWEISER LONG NECK",
      description: "Cerveja Budweiser.",
      price: 1290,
      stock: 30,
      barcode: "100300000018",
      category: "bebidas",
    },
      {
      name: "CORONA LONG NECK",
      description: "Cerveja Corona.",
      price: 1390,
      stock: 30,
      barcode: "102000000021",
      category: "bebidas",
    },
      {
      name: "COCA-COLA",
      description: "Refrigerante Coca-Cola lata-350ml.",
      price: 790,
      stock: 100,
      barcode: "100000300006",
      category: "bebidas",
    },
      {
      name: "SPRITE",
      description: "Refrigerante Sprite lata-350ml.",
      price: 790,
      stock: 100,
      barcode: "100000002007",
      category: "bebidas",
    },
       {
      name: "FANTA",
      description: "Refrigerante Fanta lata-350ml.",
      price: 790,
      stock: 100,
      barcode: "100000102008",
      category: "bebidas",
    },
    {
      name: "AGUA",
      description: "Água 500ml.",
      price: 490,
      stock: 100,
      barcode: "100000002007",
      category: "bebidas",
    },
      {
      name: "AGUA COM GÁS",
      description: "Água com gás 500ml.",
      price: 590,
      stock: 100,
      barcode: "100000002007",
      category: "bebidas",
    },
      {
      name: "SUCO NATURAL",
      description: "Suco natural Laranja 400ml.",
      price: 1190,
      stock: 100,
      barcode: "10010002007",
      category: "bebidas",
    },
      {
      name: "Smash simples",
      description: "pão brioche, smash bovino 100g, cheddar e molho da casa.",
      price: 2190,
      stock: 25,
      barcode: "100100200008",
      category: "hamburgueres",
    },
     {
      name: "Smash duplo",
      description: "pão brioche,2 smash bovino 100g, dupla cheddar e molho da casa.",
      price: 2690,
      stock: 25,
      barcode: "100500000008",
      category: "hamburgueres",
    },
      {
      name: "Smash Bacon",
      description: "pão brioche,smash bovino 100g, cheddar, bacon crocante e molho da casa.",
      price: 2590,
      stock: 25,
      barcode: "100080000008",
      category: "hamburgueres",
    },
    {
      name: "Smash Duplo Bacon",
      description: "pão brioche,2 smash bovino 100g, dupla cheddar, bacon crocante e molho da casa.",
      price: 3090,
      stock: 25,
      barcode: "100020000008",
      category: "hamburgueres",
    },
      {
      name: "Smash Salada",
      description: "Pão brioche, smash bovino 100g, cheddar, alface, tomate e maionese da casa.",
      price: 2490,
      stock: 25,
      barcode: "100070000008",
      category: "hamburgueres",
    },
      {
      name: "Brownie",
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

  for (const [index, product] of products.entries()) {
  const categoryId = categoryMap[product.category];

  if (!categoryId) {
    throw new Error(
      `Categoria não encontrada: ${product.category}`
    );
  }

  const { category, ...data } = product;

  await prisma.product.upsert({
    where: { barcode: product.barcode },
    update: {
      ...data,
      categoryId,
      available: true,
      position: index + 1,
    },
    create: {
      ...data,
      categoryId,
      position: index + 1,
    },
  });
}

  console.log("Produtos cadastrados!");

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
