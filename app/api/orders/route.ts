import { NextResponse } from "next/server";
import { prisma } from "../../lib/prisma";
import { generatePickupCode } from "../../lib/pickup-code";

// Retorna o texto limpo ou null se vazio/inválido
function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const {
      items,
      serviceType,
      tableId,
      customerName,
      customerPhone,
      deliveryAddress,
      deliveryNumber,
      deliveryNeighborhood,
      deliveryComplement,
      deliveryReference,
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

    if (!["COUNTER", "TABLE", "DELIVERY"].includes(serviceType)) {
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

    // Retirada e entrega: nome obrigatório e geram código
    const needsCode = serviceType !== "TABLE";
    const name = clean(customerName);

    if (needsCode && (!name || name.length < 2)) {
      return NextResponse.json(
        { error: "Informe seu nome." },
        { status: 400 }
      );
    }

    // Entrega: telefone e endereço obrigatórios
    const isDelivery = serviceType === "DELIVERY";
    const phone = clean(customerPhone);
    const address = clean(deliveryAddress);
    const number = clean(deliveryNumber);
    const neighborhood = clean(deliveryNeighborhood);

    if (isDelivery && (!phone || !address || !number || !neighborhood)) {
      return NextResponse.json(
        { error: "Preencha telefone e endereço de entrega." },
        { status: 400 }
      );
    }

    // Limite das observações
    if (notes !== undefined && notes !== null) {
      if (typeof notes !== "string" || notes.length > 300) {
        return NextResponse.json(
          { error: "As observações devem ter no máximo 300 caracteres." },
          { status: 400 }
        );
      }
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

    // Taxa definida no servidor (o cliente não altera o valor)
    const deliveryFee = 0;

    const order = await prisma.$transaction(async (tx) => {
      // Confere a mesa
      if (serviceType === "TABLE") {
        const table = await tx.restaurantTable.findFirst({
          where: { id: tableId, active: true },
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
          customerName: name,
          customerPhone: isDelivery ? phone : null,
          pickupCode: needsCode ? generatePickupCode() : null,
          notes: clean(notes),

          deliveryAddress: isDelivery ? address : null,
          deliveryNumber: isDelivery ? number : null,
          deliveryNeighborhood: isDelivery ? neighborhood : null,
          deliveryComplement: isDelivery ? clean(deliveryComplement) : null,
          deliveryReference: isDelivery ? clean(deliveryReference) : null,

          subtotal,
          deliveryFee: isDelivery ? deliveryFee : 0,
          total: subtotal + (isDelivery ? deliveryFee : 0),

          items: {
            create: orderItems,
          },

          payments: {
            create: {
              method,
              mode,
              amount: subtotal + (isDelivery ? deliveryFee : 0),
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

    const message = error instanceof Error ? error.message : "";

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
