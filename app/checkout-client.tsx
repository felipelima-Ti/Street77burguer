"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  X,
  Utensils,
  Store,
  CreditCard,
  QrCode,
  CheckCircle2,
  Loader2,
  ClipboardList,
} from "lucide-react";

type Category = {
  id: string;
  name: string;
  slug: string;
};

type Product = {
  id: string;
  name: string;
  description: string | null;
  image: string | null;
  price: number;
  stock: number;
  categoryId: string;
};

type RestaurantTable = {
  id: string;
  number: number;
};

type CartItem = {
  product: Product;
  quantity: number;
};

type Props = {
  categories: Category[];
  products: Product[];
  tables: RestaurantTable[];
};

type ServiceType = "COUNTER" | "TABLE" | "DELIVERY";
type PaymentMethod = "PIX" | "CARD";
type PaymentMode = "ONLINE" | "TERMINAL";

export default function SelfCheckout({
  categories,
  products,
  tables,
}: Props) {
  const [selectedCategory, setSelectedCategory] =
    useState("todos");

  const [cart, setCart] = useState<CartItem[]>([]);

  const [serviceType, setServiceType] =
    useState<ServiceType>("COUNTER");

  const [tableId, setTableId] = useState("");

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNumber, setDeliveryNumber] = useState("");
  const [deliveryNeighborhood, setDeliveryNeighborhood] = useState("");
  const [deliveryComplement, setDeliveryComplement] = useState("");
  const [deliveryReference, setDeliveryReference] = useState("");
  const [notes, setNotes] = useState("");

  const [method, setMethod] =
    useState<PaymentMethod>("PIX");

  const [mode, setMode] =
    useState<PaymentMode>("ONLINE");

  const [showCheckout, setShowCheckout] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [finishedOrder, setFinishedOrder] =
    useState<number | null>(null);

  // Código de retirada (retirada no balcão e delivery)
  const [pickupCode, setPickupCode] = useState<string | null>(null);

  const [showSuccess, setShowSuccess] = useState(false);

  const filteredProducts = useMemo(() => {
    if (selectedCategory === "todos") {
      return products;
    }

    return products.filter(
      (product) => product.categoryId === selectedCategory
    );
  }, [products, selectedCategory]);

  // Destaques do banner: sorteados só no cliente (evita erro de hidratação)
  const [featured, setFeatured] = useState<Product[]>([]);
  const [featuredVisible, setFeaturedVisible] = useState(true);

  useEffect(() => {
    // Prefere produtos com foto, se houver ao menos 3
    const withImage = products.filter((p) => p.image);
    const pool = withImage.length >= 3 ? withImage : products;

    // Embaralha (Fisher-Yates) e pega 3
    const draw = () => {
      const copy = [...pool];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy.slice(0, 3);
    };

    setFeatured(draw());
    if (pool.length <= 3) return;

    let timeout: ReturnType<typeof setTimeout> | undefined;
    const interval = setInterval(() => {
      setFeaturedVisible(false); // fade out
      timeout = setTimeout(() => {
        setFeatured(draw());
        setFeaturedVisible(true); // fade in
      }, 400);
    }, 7000);

    return () => {
      clearInterval(interval);
      if (timeout) clearTimeout(timeout);
    };
  }, [products]);

  // [0] = esquerda, [1] = direita, [2] = centro (destaque, por cima)
  const featuredSlots = [
    {
      product: featured[1],
      className:
        "left-0 top-[10%] w-[42%] -rotate-6 brightness-75",
    },
    {
      product: featured[2],
      className:
        "right-0 top-[10%] w-[42%] rotate-6 brightness-75",
    },
    {
      product: featured[0],
      className:
        "left-1/2 top-0 z-10 w-[56%] -translate-x-1/2 shadow-2xl shadow-black/60",
    },
  ];

  const totalItems = cart.reduce(
    (total, item) => total + item.quantity,
    0
  );

  const total = cart.reduce(
    (sum, item) => sum + item.product.price * item.quantity,
    0
  );

  // Exibição apenas: o valor real da taxa é definido no servidor.
  const deliveryFee = 0;
  const finalTotal = total + (serviceType === "DELIVERY" ? deliveryFee : 0);

  function formatPrice(value: number) {
    return (value / 100).toLocaleString("pt-BR", {
      style: "currency",
      currency: "BRL",
    });
  }

  function addToCart(product: Product) {
    setError("");

    setCart((current) => {
      const existing = current.find(
        (item) => item.product.id === product.id
      );

      const currentQuantity = existing?.quantity ?? 0;

      if (currentQuantity >= product.stock) {
        setError(`Estoque insuficiente para ${product.name}.`);
        return current;
      }

      if (existing) {
        return current.map((item) =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        );
      }

      return [...current, { product, quantity: 1 }];
    });
  }

  function changeQuantity(productId: string, amount: number) {
    setCart((current) =>
      current
        .map((item) =>
          item.product.id === productId
            ? { ...item, quantity: item.quantity + amount }
            : item
        )
        .filter((item) => item.quantity > 0)
    );
  }

  function removeFromCart(productId: string) {
    setCart((current) =>
      current.filter((item) => item.product.id !== productId)
    );
  }

  async function finalizeOrder() {
    if (cart.length === 0) {
      setError("Adicione produtos ao carrinho.");
      return;
    }

    if (serviceType === "TABLE" && !tableId) {
      setError("Selecione uma mesa.");
      return;
    }

    // Nome obrigatório em retirada e delivery
    if (serviceType !== "TABLE" && customerName.trim().length < 2) {
      setError("Informe seu nome.");
      return;
    }

    if (serviceType === "DELIVERY") {
      if (
        !customerPhone.trim() ||
        !deliveryAddress.trim() ||
        !deliveryNumber.trim() ||
        !deliveryNeighborhood.trim()
      ) {
        setError("Preencha telefone e endereço de entrega.");
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: cart.map((item) => ({
            productId: item.product.id,
            quantity: item.quantity,
          })),
          serviceType,
          tableId: serviceType === "TABLE" ? tableId : null,
          customerName: customerName.trim() || null,
          customerPhone: serviceType === "DELIVERY" ? customerPhone.trim() : null,
          deliveryAddress: serviceType === "DELIVERY" ? deliveryAddress.trim() : null,
          deliveryNumber: serviceType === "DELIVERY" ? deliveryNumber.trim() : null,
          deliveryNeighborhood: serviceType === "DELIVERY" ? deliveryNeighborhood.trim() : null,
          deliveryComplement: serviceType === "DELIVERY" ? deliveryComplement.trim() : null,
          deliveryReference: serviceType === "DELIVERY" ? deliveryReference.trim() : null,
          notes: notes.trim() || null,
          method,
          mode,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Erro ao realizar pedido.");
      }

      setFinishedOrder(data.order.orderNumber);
      setPickupCode(data.order.pickupCode ?? null);
      setShowCheckout(false);
      setShowSuccess(true);
      setCart([]);
      setCustomerName("");
      setCustomerPhone("");
      setDeliveryAddress("");
      setDeliveryNumber("");
      setDeliveryNeighborhood("");
      setDeliveryComplement("");
      setDeliveryReference("");
      setNotes("");
      setTableId("");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível realizar o pedido."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#0A0A0A] text-white">
      {/* HEADER */}
      <header className="sticky top-0 z-30 border-b border-white/10 bg-[#0A0A0A]/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4">
          <img src="/logo.png" alt="" className="h-16 w-auto" />

          <div className="sr-only">
            <h1 className="text-2xl font-black tracking-tight">
              STREET<span className="text-orange-500">77</span>
            </h1>
            <p className="text-xs tracking-[0.25em] text-gray-400">
              BURGUER
            </p>
          </div>

          <button
            onClick={() => setShowCheckout(true)}
            className="relative flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-3 font-bold text-black transition hover:bg-orange-400"
          >
            <ShoppingCart size={20} />
            <span>Carrinho</span>

            <span className="rounded-full bg-black px-2 py-0.5 text-xs text-white">
              {totalItems}
            </span>
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-8">
        {/* BANNER */}
        <section className="mb-8 grid items-center gap-8 overflow-hidden rounded-3xl border border-orange-500/20 bg-gradient-to-r from-[#321607] to-[#171717] p-6 sm:p-8 lg:grid-cols-2">
          <div>
            <span className="mb-3 inline-block rounded-full bg-orange-500/20 px-3 py-1 text-xs font-bold uppercase text-orange-400">
              Peça agora
            </span>

            <h2 className="text-3xl font-black sm:text-5xl">
              SEU BURGER.
              <br />
              <span className="text-orange-500">
                DO SEU JEITO.
              </span>
            </h2>

            <p className="mt-4 max-w-md text-gray-400">
              Escolha seus favoritos e faça seu pedido
              diretamente pelo nosso autoatendimento.
            </p>
          </div>

          {/* Composição decorativa: 1 produto central e 2 atrás, parcialmente cobertos */}
          {products.length > 0 && (
            <div
              aria-hidden="true"
              className={`relative mx-auto aspect-[4/3] w-full max-w-md transition-opacity duration-500 ${
                featuredVisible ? "opacity-100" : "opacity-0"
              }`}
            >
              {featuredSlots.map(
                (slot, index) =>
                  slot.product && (
                    <div
                      key={`${slot.product.id}-${index}`}
                      className={`absolute aspect-[4/5] overflow-hidden rounded-2xl border border-white/10 bg-[#292929] ${slot.className}`}
                    >
                      {slot.product.image ? (
                        <img
                          src={slot.product.image}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Utensils className="h-1/3 w-1/3 text-orange-500" />
                        </div>
                      )}

                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 to-transparent p-2 pt-8 sm:p-3 sm:pt-10">
                        <p className="truncate text-xs font-black sm:text-sm">
                          {slot.product.name}
                        </p>
                        <p className="text-xs font-black text-orange-500">
                          {formatPrice(slot.product.price)}
                        </p>
                      </div>
                    </div>
                  )
              )}
            </div>
          )}
        </section>

        {/* CATEGORIAS */}
        <section className="mb-8">
          <h2 className="mb-4 text-xl font-bold">
            Nosso cardápio
          </h2>

          <div className="flex gap-3 overflow-x-auto pb-3">
            <button
              onClick={() => setSelectedCategory("todos")}
              className={`whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold ${
                selectedCategory === "todos"
                  ? "bg-orange-500 text-black"
                  : "bg-[#222] text-gray-300 hover:bg-[#333]"
              }`}
            >
              Todos
            </button>

            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`whitespace-nowrap rounded-xl px-5 py-3 text-sm font-bold ${
                  selectedCategory === category.id
                    ? "bg-orange-500 text-black"
                    : "bg-[#222] text-gray-300 hover:bg-[#333]"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>
        </section>

        {/* PRODUTOS */}
        <section className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {filteredProducts.map((product) => {
            const quantity =
              cart.find(
                (item) => item.product.id === product.id
              )?.quantity ?? 0;

            return (
              <article
                key={product.id}
                className="overflow-hidden rounded-2xl border border-white/10 bg-[#1c1c1c] transition hover:border-orange-500/50"
              >
                <div className="flex h-44 items-center justify-center overflow-hidden bg-[#292929]">
                  {product.image ? (
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Utensils
                      size={55}
                      className="text-orange-500"
                    />
                  )}
                </div>

                <div className="p-5">
                  <h3 className="text-lg font-bold">
                    {product.name}
                  </h3>

                  <p className="mt-2 min-h-10 text-sm text-gray-400">
                    {product.description || "Delicioso produto Street77."}
                  </p>

                  <div className="mt-5 flex items-center justify-between">
                    <span className="text-lg font-black text-orange-500">
                      {formatPrice(product.price)}
                    </span>

                    <button
                      onClick={() => addToCart(product)}
                      disabled={product.stock <= 0}
                      className="flex items-center gap-2 rounded-xl bg-orange-500 px-4 py-2 font-bold text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={18} />
                      {product.stock <= 0 ? "Esgotado" : "Adicionar"}
                    </button>
                  </div>

                  {quantity > 0 && (
                    <p className="mt-3 text-xs text-orange-400">
                      {quantity} no carrinho
                    </p>
                  )}
                </div>
              </article>
            );
          })}
        </section>

        {filteredProducts.length === 0 && (
          <p className="py-12 text-center text-gray-400">
            Nenhum produto encontrado nesta categoria.
          </p>
        )}
      </div>

      {/* MODAL DO CARRINHO */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3">
          <div className="max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#1b1b1b] p-5 sm:p-7">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-2xl font-black">
                Finalizar pedido
              </h2>

              <button
                onClick={() => setShowCheckout(false)}
                className="rounded-lg bg-[#333] p-2 hover:bg-[#444]"
              >
                <X />
              </button>
            </div>

            {/* ITENS */}
            <h3 className="mb-3 font-bold text-orange-500">
              SEU CARRINHO
            </h3>

            {cart.length === 0 ? (
              <p className="py-5 text-center text-gray-400">
                Seu carrinho está vazio.
              </p>
            ) : (
              <div className="space-y-3">
                {cart.map((item) => (
                  <div
                    key={item.product.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-[#292929] p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate font-bold">
                        {item.product.name}
                      </p>
                      <p className="text-sm text-orange-400">
                        {formatPrice(item.product.price * item.quantity)}
                      </p>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() =>
                          changeQuantity(item.product.id, -1)
                        }
                        className="rounded-lg bg-[#444] p-2"
                      >
                        <Minus size={15} />
                      </button>

                      <span className="w-5 text-center">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() =>
                          addToCart(item.product)
                        }
                        disabled={item.quantity >= item.product.stock}
                        className="rounded-lg bg-[#444] p-2 disabled:opacity-40"
                      >
                        <Plus size={15} />
                      </button>

                      <button
                        onClick={() =>
                          removeFromCart(item.product.id)
                        }
                        className="rounded-lg bg-red-500/20 p-2 text-red-400"
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ATENDIMENTO */}
            <div className="mt-7">
              <h3 className="mb-3 font-bold text-orange-500">
                COMO DESEJA RECEBER?
              </h3>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <button
                  type="button"
                  onClick={() => {
                    setServiceType("COUNTER");
                    setTableId("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-4 font-bold ${
                    serviceType === "COUNTER"
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-white/10 bg-[#292929]"
                  }`}
                >
                  <Store size={20} />
                  Retirar no balcão
                </button>

                <button
                  type="button"
                  onClick={() => setServiceType("TABLE")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-4 font-bold ${
                    serviceType === "TABLE"
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-white/10 bg-[#292929]"
                  }`}
                >
                  <Utensils size={20} />
                  Comer no local
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setServiceType("DELIVERY");
                    setTableId("");
                  }}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-4 font-bold ${
                    serviceType === "DELIVERY"
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-white/10 bg-[#292929]"
                  }`}
                >
                  <Store size={20} />
                  Delivery
                </button>
              </div>

              {serviceType === "TABLE" && (
                <div className="mt-4">
                  <label className="mb-2 block text-sm text-gray-300">
                    Número da mesa
                  </label>

                  <select
                    value={tableId}
                    onChange={(e) => setTableId(e.target.value)}
                    className="w-full rounded-xl border border-white/10 bg-[#292929] p-3 outline-none focus:border-orange-500"
                  >
                    <option value="">Selecione uma mesa</option>
                    {tables.map((table) => (
                      <option key={table.id} value={table.id}>
                        Mesa {table.number}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {serviceType === "DELIVERY" && (
                <div className="mt-5 space-y-3 rounded-xl border border-orange-500/20 bg-[#242424] p-4">
                  <h4 className="font-bold text-orange-400">
                    ENDEREÇO DE ENTREGA
                  </h4>

                  <input
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    placeholder="Telefone para contato *"
                    maxLength={20}
                    className="w-full rounded-xl border border-white/10 bg-[#292929] p-3 outline-none focus:border-orange-500"
                  />

                  <input
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    placeholder="Rua ou avenida *"
                    maxLength={150}
                    className="w-full rounded-xl border border-white/10 bg-[#292929] p-3 outline-none focus:border-orange-500"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      value={deliveryNumber}
                      onChange={(e) => setDeliveryNumber(e.target.value)}
                      placeholder="Número *"
                      maxLength={20}
                      className="w-full min-w-0 rounded-xl border border-white/10 bg-[#292929] p-3 outline-none focus:border-orange-500"
                    />

                    <input
                      value={deliveryNeighborhood}
                      onChange={(e) => setDeliveryNeighborhood(e.target.value)}
                      placeholder="Bairro *"
                      maxLength={100}
                      className="w-full min-w-0 rounded-xl border border-white/10 bg-[#292929] p-3 outline-none focus:border-orange-500"
                    />
                  </div>

                  <input
                    value={deliveryComplement}
                    onChange={(e) => setDeliveryComplement(e.target.value)}
                    placeholder="Complemento (opcional)"
                    maxLength={100}
                    className="w-full rounded-xl border border-white/10 bg-[#292929] p-3 outline-none focus:border-orange-500"
                  />

                  <input
                    value={deliveryReference}
                    onChange={(e) => setDeliveryReference(e.target.value)}
                    placeholder="Ponto de referência (opcional)"
                    maxLength={150}
                    className="w-full rounded-xl border border-white/10 bg-[#292929] p-3 outline-none focus:border-orange-500"
                  />

                  <p className="text-xs text-gray-400">
                    * Campos obrigatórios para entrega.
                  </p>
                </div>
              )}
            </div>

            {/* CLIENTE */}
            <div className="mt-7 space-y-3">
              <h3 className="font-bold text-orange-500">
                INFORMAÇÕES
              </h3>

              <input
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder={
                  serviceType === "TABLE"
                    ? "Nome do cliente (opcional)"
                    : "Nome do cliente *"
                }
                maxLength={80}
                className="w-full rounded-xl border border-white/10 bg-[#292929] p-3 outline-none focus:border-orange-500"
              />

              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Observações do pedido (opcional)"
                maxLength={300}
                rows={3}
                className="w-full resize-none rounded-xl border border-white/10 bg-[#292929] p-3 outline-none focus:border-orange-500"
              />
            </div>

            {/* PAGAMENTO */}
            <div className="mt-7">
              <h3 className="mb-3 font-bold text-orange-500">
                FORMA DE PAGAMENTO
              </h3>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMethod("PIX")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-4 font-bold ${
                    method === "PIX"
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-white/10 bg-[#292929]"
                  }`}
                >
                  <QrCode />
                  PIX
                </button>

                <button
                  onClick={() => setMethod("CARD")}
                  className={`flex items-center justify-center gap-2 rounded-xl border p-4 font-bold ${
                    method === "CARD"
                      ? "border-orange-500 bg-orange-500/10 text-orange-400"
                      : "border-white/10 bg-[#292929]"
                  }`}
                >
                  <CreditCard />
                  Cartão
                </button>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <button
                  onClick={() => setMode("ONLINE")}
                  className={`rounded-xl border p-3 text-sm font-bold ${
                    mode === "ONLINE"
                      ? "border-orange-500 text-orange-400"
                      : "border-white/10 text-gray-400"
                  }`}
                >
                  Online
                </button>

                <button
                  onClick={() => setMode("TERMINAL")}
                  className={`rounded-xl border p-3 text-sm font-bold ${
                    mode === "TERMINAL"
                      ? "border-orange-500 text-orange-400"
                      : "border-white/10 text-gray-400"
                  }`}
                >
                  Maquininha
                </button>
              </div>

              <p className="mt-2 text-xs text-gray-500">
                Modo de teste: nenhuma cobrança será realizada.
                O pagamento ficará pendente.
              </p>
            </div>

            {/* TOTAL */}
            <div className="mt-7 border-t border-white/10 pt-5">
              <div className="flex justify-between text-gray-400">
                <span>Quantidade de itens</span>
                <span>{totalItems}</span>
              </div>

              {serviceType === "DELIVERY" && (
                <div className="mt-3 flex justify-between text-gray-400">
                  <span>Taxa de entrega</span>
                  <span>{formatPrice(deliveryFee)}</span>
                </div>
              )}

              <div className="mt-3 flex justify-between text-xl font-black">
                <span>Total</span>
                <span className="text-orange-500">
                  {formatPrice(finalTotal)}
                </span>
              </div>
            </div>

            {error && (
              <p className="mt-4 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">
                {error}
              </p>
            )}

            <button
              onClick={finalizeOrder}
              disabled={loading || cart.length === 0}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-orange-500 py-4 font-black text-black transition hover:bg-orange-400 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Registrando pedido...
                </>
              ) : (
                <>
                  <ClipboardList size={20} />
                  CONFIRMAR PEDIDO
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* SUCESSO */}
      {showSuccess && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 p-5">
          <div className="max-h-[95vh] w-full max-w-md overflow-y-auto rounded-3xl border border-green-500/20 bg-[#1b1b1b] p-8 text-center">
            <CheckCircle2
              size={65}
              className="mx-auto text-green-500"
            />

            <h2 className="mt-5 text-2xl font-black">
              PEDIDO REGISTRADO!
            </h2>

            <p className="mt-3 text-gray-400">
              Seu pedido foi enviado para o sistema.
            </p>

            <div className="my-6 rounded-2xl bg-[#292929] p-5">
              <p className="text-sm text-gray-400">
                Número do pedido
              </p>

              <p className="mt-1 text-4xl font-black text-orange-500">
                #{finishedOrder}
              </p>
            </div>

            {pickupCode && (
              <div className="mb-6 rounded-2xl border border-orange-500/40 bg-[#292929] p-5">
                <p className="text-sm text-gray-400">Código de retirada</p>
                <p className="mt-1 text-5xl font-black tracking-[0.3em] text-orange-500">
                  {pickupCode}
                </p>
                <p className="mt-2 text-xs text-gray-400">
                  Guarde este código. Ele é necessário para consultar e retirar seu pedido.
                </p>
              </div>
            )}

            <p className="mb-5 text-xs text-yellow-400">
              Pagamento pendente. Este é um pedido de teste.
            </p>

            <button
              onClick={() => {
                setShowSuccess(false);
                setPickupCode(null);
              }}
              className="w-full rounded-xl bg-orange-500 py-3 font-black text-black hover:bg-orange-400"
            >
              VOLTAR AO CARDÁPIO
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
