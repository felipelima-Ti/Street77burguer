
import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      items,
      serviceType,
      tableId,
      customerName,
      notes,
      method,
      mode,
    } = body;

    // Validações básicas
    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "O pedido precisa ter pelo menos um produto." },
        { status: 400 }
      );
    }

    if (!["COUNTER", "TABLE"].includes(serviceType)) {
      return NextResponse.json(
        { error: "Tipo de atendimento inválido." },
        { status: 400 }
      );
    }

    if (!["PIX", "CARD"].includes(method)) {
      return NextResponse.json(
        { error: "Forma de pagamento inválida." },
        { status: 400 }
      );
    }

    if (!["ONLINE", "TERMINAL"].includes(mode)) {
      return NextResponse.json(
        { error: "Modalidade de pagamento inválida." },
        { status: 400 }
      );
    }

    if (serviceType === "TABLE" && !tableId) {
      return NextResponse.json(
        { error: "Selecione uma mesa." },
        { status: 400 }
      );
    }

    // Agrupa produtos repetidos e valida quantidades
    const quantities = new Map<string, number>();

    for (const item of items) {
      if (
        typeof item.productId !== "string" ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0
      ) {
        return NextResponse.json(
          { error: "Produto ou quantidade inválida." },
          { status: 400 }
        );
      }

      quantities.set(
        item.productId,
        (quantities.get(item.productId) ?? 0) + item.quantity
      );
    }

    const order = await prisma.$transaction(async (tx) => {
      // Confere a mesa
      if (serviceType === "TABLE") {
        const table = await tx.restaurantTable.findFirst({
          where: {
            id: tableId,
            active: true,
          },
        });

        if (!table) {
          throw new Error("MESA_INVALIDA");
        }
      }

      // Busca os preços diretamente no banco
      const products = await tx.product.findMany({
        where: {
          id: { in: Array.from(quantities.keys()) },
          available: true,
        },
      });

      if (products.length !== quantities.size) {
        throw new Error("PRODUTO_INVALIDO");
      }

      const orderItems = products.map((product) => {
        const quantity = quantities.get(product.id)!;

        if (product.stock < quantity) {
          throw new Error(`ESTOQUE_INSUFICIENTE:${product.name}`);
        }

        return {
          productId: product.id,
          productName: product.name,
          quantity,
          unitPrice: product.price,
          subtotal: product.price * quantity,
        };
      });

      const subtotal = orderItems.reduce(
        (total, item) => total + item.subtotal,
        0
      );

      // Cria pedido, itens e pagamento pendente
      return tx.order.create({
        data: {
          serviceType,
          tableId: serviceType === "TABLE" ? tableId : null,
          customerName: customerName || null,
          notes: notes || null,
          subtotal,
          total: subtotal,

          items: {
            create: orderItems,
          },

          payments: {
            create: {
              method,
              mode,
              amount: subtotal,
              status: "PENDING",
              provider: "MANUAL_TEST",
            },
          },
        },
        include: {
          items: true,
          payments: true,
          table: true,
        },
      });
    });

    return NextResponse.json(
      {
        message: "Pedido registrado com sucesso!",
        order,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Erro ao criar pedido:", error);

    const message =
      error instanceof Error ? error.message : "";

    if (message === "MESA_INVALIDA") {
      return NextResponse.json(
        { error: "Mesa inválida ou inativa." },
        { status: 400 }
      );
    }

    if (message === "PRODUTO_INVALIDO") {
      return NextResponse.json(
        { error: "Um ou mais produtos não estão disponíveis." },
        { status: 400 }
      );
    }

    if (message.startsWith("ESTOQUE_INSUFICIENTE:")) {
      return NextResponse.json(
        { error: message.split(":")[1] + " está sem estoque suficiente." },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: "Não foi possível registrar o pedido." },
      { status: 500 }
    );
  }
}
