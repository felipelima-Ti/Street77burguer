import Link from "next/link";
import { revalidatePath } from "next/cache";
import { prisma } from "../lib/prisma";

export const dynamic = "force-dynamic";

const STATUS = {
  PENDING_PAYMENT: "Aguardando pagamento",
  CONFIRMED: "Pago",
  PREPARING: "Preparando",
  READY: "Pronto",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
} as const;

type Status = keyof typeof STATUS;

// Próximo passo do fluxo de cada pedido
const NEXT: Partial<Record<Status, Status>> = {
  PENDING_PAYMENT: "CONFIRMED",
  CONFIRMED: "PREPARING",
  PREPARING: "READY",
  READY: "COMPLETED",
};

const SERVICE: Record<string, string> = {
  COUNTER: "Balcão",
  TABLE: "Mesa",
  DELIVERY: "Delivery",
};

const ACTIVE: Status[] = ["PENDING_PAYMENT", "CONFIRMED", "PREPARING", "READY"];

async function updateStatus(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");

  if (!id || !(status in STATUS)) return;
  const target = status as Status;

  try {
    await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id },
        include: { items: true },
      });
      if (!order) return;

      const current = order.status as Status;

      // Só aceita transições válidas (evita descontar/devolver estoque duas vezes)
      const allowed =
        target === "CANCELLED"
          ? ACTIVE.includes(current)
          : NEXT[current] === target;
      if (!allowed) return;

      if (target === "CONFIRMED") {
        // Desconta o estoque; falha se algum item não tiver saldo
        for (const item of order.items) {
          if (!item.productId) continue;

          const result = await tx.product.updateMany({
            where: { id: item.productId, stock: { gte: item.quantity } },
            data: { stock: { decrement: item.quantity } },
          });

          if (result.count === 0) {
            throw new Error(`Estoque insuficiente: ${item.productName}`);
          }
        }

        await tx.payment.updateMany({
          where: { orderId: id, status: "PENDING" },
          data: { status: "APPROVED" },
        });
      }

      if (target === "CANCELLED") {
        if (current === "PENDING_PAYMENT") {
          // Nunca descontou estoque
          await tx.payment.updateMany({
            where: { orderId: id, status: "PENDING" },
            data: { status: "REJECTED" },
          });
        } else {
          // Já descontou: devolve o estoque
          for (const item of order.items) {
            if (!item.productId) continue;

            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.quantity } },
            });
          }

          await tx.payment.updateMany({
            where: { orderId: id, status: "APPROVED" },
            data: { status: "REFUNDED" },
          });
        }
      }

      await tx.order.update({
        where: { id },
        data: { status: target },
      });
    });
  } catch (error) {
    // Ex.: estoque insuficiente. O pedido continua no status anterior.
    console.error("Erro ao atualizar pedido:", error);
  }

  revalidatePath("/admin");
}

function formatPrice(value: number) {
  return (value / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = status && status in STATUS ? (status as Status) : null;

  const orders = await prisma.order.findMany({
    where: filter ? { status: filter } : { status: { in: ACTIVE } },
    orderBy: { createdAt: "asc" },
    take: 100,
    include: { table: true, items: true },
  });

  const tabs: { label: string; value: Status | null }[] = [
    { label: "Em andamento", value: null },
    { label: "Concluídos", value: "COMPLETED" },
    { label: "Cancelados", value: "CANCELLED" },
  ];

  return (
    <main className="min-h-screen bg-[#111] p-5 text-white">
      <div className="mx-auto max-w-6xl">
        <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-black">
            STREET<span className="text-[#D4AF37]">77</span>{" "}
            <span className="text-base font-bold text-gray-400">Painel</span>
          </h1>

          <Link
            href={filter ? `/admin?status=${filter}` : "/admin"}
            className="rounded-xl bg-[#222] px-4 py-2 text-sm font-bold hover:bg-[#333]"
          >
            Atualizar
          </Link>
        </header>

        <nav className="mb-6 flex gap-3 overflow-x-auto">
          {tabs.map((tab) => {
            const selected = tab.value === filter;
            return (
              <Link
                key={tab.label}
                href={tab.value ? `/admin?status=${tab.value}` : "/admin"}
                className={`whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold ${
                  selected
                    ? "bg-[#D4AF37] text-black"
                    : "bg-[#222] text-gray-300 hover:bg-[#333]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        {orders.length === 0 && (
          <p className="py-12 text-center text-gray-400">
            Nenhum pedido nesta lista.
          </p>
        )}

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {orders.map((order) => {
            const current = order.status as Status;
            const next = NEXT[current];

            return (
              <article
                key={order.id}
                className="rounded-2xl border border-white/10 bg-[#1c1c1c] p-5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-2xl font-black text-[#D4AF37]">
                      #{order.orderNumber}
                    </p>
                    <p className="text-sm text-gray-400">
                      {SERVICE[order.serviceType] ?? order.serviceType}
                      {order.table ? ` · Mesa ${order.table.number}` : ""}
                    </p>
                  </div>

                  <span className="rounded-full bg-[#D4AF37]/15 px-3 py-1 text-xs font-bold text-[#E6C65C]">
                    {STATUS[current] ?? order.status}
                  </span>
                </div>

                <p className="mt-3 font-bold">
                  {order.customerName || "Sem nome"}
                </p>

                {order.pickupCode && (
                  <p className="mt-1 text-sm text-gray-400">
                    Código:{" "}
                    <span className="font-black tracking-widest text-[#E6C65C]">
                      {order.pickupCode}
                    </span>
                  </p>
                )}

                {order.serviceType === "DELIVERY" && (
                  <p className="mt-1 text-sm text-gray-400">
                    {order.deliveryAddress}, {order.deliveryNumber} -{" "}
                    {order.deliveryNeighborhood}
                    {order.deliveryComplement
                      ? ` (${order.deliveryComplement})`
                      : ""}
                    <br />
                    Tel: {order.customerPhone}
                    {order.deliveryReference
                      ? ` · Ref: ${order.deliveryReference}`
                      : ""}
                  </p>
                )}

                <ul className="mt-4 space-y-1 border-t border-white/10 pt-3 text-sm">
                  {order.items.map((item) => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span>
                        {item.quantity}x {item.productName}
                      </span>
                    </li>
                  ))}
                </ul>

                {order.notes && (
                  <p className="mt-3 rounded-xl bg-[#292929] p-3 text-sm text-gray-300">
                    Obs: {order.notes}
                  </p>
                )}

                <div className="mt-4 flex justify-between font-black">
                  <span>Total</span>
                  <span className="text-[#D4AF37]">
                    {formatPrice(order.total)}
                  </span>
                </div>

                <div className="mt-4 flex gap-2">
                  {next && (
                    <form action={updateStatus} className="flex-1">
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="status" value={next} />
                      <button
                        type="submit"
                        className="w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-black hover:bg-[#E6C65C]"
                      >
                        Marcar como {STATUS[next]}
                      </button>
                    </form>
                  )}

                  {ACTIVE.includes(current) && (
                    <form action={updateStatus}>
                      <input type="hidden" name="id" value={order.id} />
                      <input type="hidden" name="status" value="CANCELLED" />
                      <button
                        type="submit"
                        className="rounded-xl bg-red-500/20 px-4 py-3 text-sm font-bold text-red-400 hover:bg-red-500/30"
                      >
                        Cancelar
                      </button>
                    </form>
                  )}
                </div>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
