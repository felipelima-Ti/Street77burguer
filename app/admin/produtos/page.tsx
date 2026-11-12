import Link from "next/link";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { prisma } from "../../lib/prisma";

export const dynamic = "force-dynamic";

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB
const IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// "29,90" ou "29.90" -> 2990 (centavos). Retorna null se inválido
function parsePrice(raw: string): number | null {
  let value = raw.trim().replace(/\s/g, "");
  if (value.includes(",")) value = value.replace(/\./g, "").replace(",", ".");

  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return null;

  return Math.round(number * 100);
}

// Salva a imagem em public/uploads e devolve a URL pública
async function saveImage(file: File): Promise<string> {
  const ext = IMAGE_TYPES[file.type];
  const dir = path.join(process.cwd(), "public", "uploads");
  await mkdir(dir, { recursive: true });

  const filename = `${randomUUID()}.${ext}`; // nome gerado: ignora o nome enviado
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  return `/uploads/${filename}`;
}

async function createProduct(formData: FormData) {
  "use server";

  const fail = (message: string) =>
    redirect(`/admin/produtos?erro=${encodeURIComponent(message)}`);

  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = String(formData.get("categoryId") ?? "");
  const price = parsePrice(String(formData.get("price") ?? ""));
  const stock = Number(formData.get("stock"));
  const photo = formData.get("photo");

  if (name.length < 2) fail("Informe o nome do produto.");
  if (price === null) fail("Informe um valor válido, ex.: 29,90.");
  if (!Number.isInteger(stock) || stock < 0) fail("Estoque inválido.");

  const category = await prisma.category.findFirst({
    where: { id: categoryId, active: true },
  });
  if (!category) fail("Selecione uma categoria.");

  // Foto opcional, com validação de tipo e tamanho
  let imageUrl: string | null = null;

  if (photo instanceof File && photo.size > 0) {
    if (!IMAGE_TYPES[photo.type]) fail("A foto deve ser JPG, PNG ou WebP.");
    if (photo.size > MAX_SIZE) fail("A foto deve ter no máximo 2 MB.");

    try {
      imageUrl = await saveImage(photo);
    } catch (error) {
      console.error("Erro ao salvar imagem:", error);
      fail("Não foi possível salvar a foto.");
    }
  }

  // Coloca o produto no final da lista
  const last = await prisma.product.aggregate({ _max: { position: true } });

  await prisma.product.create({
    data: {
      name,
      description: description || null,
      price: price!,
      stock,
      available: true,
      position: (last._max.position ?? 0) + 1,
      categoryId,
      image: imageUrl,
    },
  });

  revalidatePath("/");
  redirect("/admin/produtos?ok=1");
}

const failWith = (message: string): never =>
  redirect(`/admin/produtos?erro=${encodeURIComponent(message)}`);

// Edita valor, estoque e descrição de um produto existente
async function updateProduct(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  const description = String(formData.get("description") ?? "").trim();
  const price = parsePrice(String(formData.get("price") ?? ""));
  const stock = Number(formData.get("stock"));

  if (!id) failWith("Produto inválido.");
  if (price === null) failWith("Informe um valor válido, ex.: 29,90.");
  if (!Number.isInteger(stock) || stock < 0) failWith("Estoque inválido.");

  try {
    await prisma.product.update({
      where: { id },
      data: {
        price: price!,
        stock,
        description: description || null,
      },
    });
  } catch (error) {
    console.error("Erro ao atualizar produto:", error);
    failWith("Não foi possível atualizar o produto.");
  }

  revalidatePath("/");
  revalidatePath("/admin/produtos");
  redirect("/admin/produtos?ok=2");
}

// Liga/desliga o produto no cardápio (não apaga: pedidos antigos referenciam ele)
async function toggleProduct(formData: FormData) {
  "use server";

  const id = String(formData.get("id") ?? "");
  const available = formData.get("available") === "true";
  if (!id) return;

  try {
    await prisma.product.update({ where: { id }, data: { available } });
  } catch (error) {
    console.error("Erro ao alterar disponibilidade:", error);
  }

  revalidatePath("/");
  revalidatePath("/admin/produtos");
}

// 2990 -> "29,90"
function priceToInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function formatPrice(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:outline-none";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string; editar?: string }>;
}) {
  const { ok, erro, editar } = await searchParams;

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const products = await prisma.product.findMany({
    orderBy: { position: "asc" },
    include: { category: true },
  });

  // Produto aberto na tela de edição (via ?editar=ID)
  const editing = editar ? products.find((p) => p.id === editar) : null;

  return (
    <main className="min-h-screen bg-[#111] p-5 text-white">
      <div className="mx-auto max-w-xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <h1 className="text-2xl font-black">
            Cadastrar <span className="text-[#D4AF37]">produto</span>
          </h1>
          <Link
            href="/admin"
            className="rounded-xl bg-[#222] px-4 py-2 text-sm font-bold hover:bg-[#333]"
          >
            Voltar
          </Link>
        </header>

        {ok && (
          <p
            role="status"
            className="mb-4 rounded-xl bg-emerald-500/15 p-3 text-sm font-bold text-emerald-400"
          >
            {ok === "2"
              ? "Produto atualizado."
              : "Produto cadastrado! Ele já aparece no cardápio."}
          </p>
        )}

        {erro && (
          <p
            role="alert"
            className="mb-4 rounded-xl bg-red-500/15 p-3 text-sm font-bold text-red-400"
          >
            {erro}
          </p>
        )}

        <form
          action={createProduct}
          className="space-y-4 rounded-2xl border border-white/10 bg-[#1c1c1c] p-5"
        >
          <div>
            <label htmlFor="name" className="mb-1 block text-sm font-bold">
              Nome
            </label>
            <input
              id="name"
              name="name"
              required
              maxLength={80}
              placeholder="Ex.: Sorvete de creme"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label htmlFor="price" className="mb-1 block text-sm font-bold">
                Valor (R$)
              </label>
              <input
                id="price"
                name="price"
                required
                inputMode="decimal"
                placeholder="29,90"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="stock" className="mb-1 block text-sm font-bold">
                Estoque inicial
              </label>
              <input
                id="stock"
                name="stock"
                type="number"
                min={0}
                step={1}
                required
                defaultValue={10}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label htmlFor="categoryId" className="mb-1 block text-sm font-bold">
              Categoria
            </label>
            <select
              id="categoryId"
              name="categoryId"
              required
              defaultValue=""
              className={inputClass}
            >
              <option value="" disabled>
                Selecione...
              </option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="description" className="mb-1 block text-sm font-bold">
              Descrição
            </label>
            <textarea
              id="description"
              name="description"
              rows={3}
              maxLength={300}
              placeholder="Ingredientes, tamanho, observações..."
              className={inputClass}
            />
          </div>

          <div>
            <label htmlFor="photo" className="mb-1 block text-sm font-bold">
              Foto <span className="font-normal text-gray-400">(opcional)</span>
            </label>
            <input
              id="photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="w-full text-sm text-gray-300 file:mr-3 file:rounded-xl file:border-0 file:bg-[#D4AF37] file:px-4 file:py-2 file:text-sm file:font-black file:text-black hover:file:bg-[#E6C65C]"
            />
            <p className="mt-1 text-xs text-gray-500">
              JPG, PNG ou WebP, até 2 MB.
            </p>
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-black hover:bg-[#E6C65C]"
          >
            Salvar produto
          </button>
        </form>

        <h2 className="mb-3 mt-10 text-xl font-black">
          Produtos <span className="text-[#D4AF37]">cadastrados</span>
        </h2>

        {products.length === 0 && (
          <p className="py-6 text-center text-gray-400">
            Nenhum produto cadastrado.
          </p>
        )}

        {/* Lista compacta: cada card tem um botão Editar */}
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {products.map((product) => (
            <li
              key={product.id}
              className="flex items-center gap-3 rounded-xl border border-white/10 bg-[#1c1c1c] p-3"
            >
              {product.image ? (
                <img
                  src={product.image}
                  alt={product.name}
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="h-12 w-12 shrink-0 rounded-lg bg-[#292929]"
                />
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-black">{product.name}</p>
                <p className="truncate text-xs text-gray-400">
                  {formatPrice(product.price)} · {product.category.name}
                </p>
                {!product.available && (
                  <p className="text-xs font-bold text-amber-400">
                    Fora do cardápio
                  </p>
                )}
                {product.available && product.stock === 0 && (
                  <p className="text-xs font-bold text-amber-400">
                    Sem estoque
                  </p>
                )}
              </div>

              <Link
                href={`/admin/produtos?editar=${product.id}`}
                scroll={false}
                aria-label={`Editar ${product.name}`}
                className="shrink-0 rounded-lg bg-[#D4AF37] px-3 py-2 text-xs font-black text-black hover:bg-[#E6C65C]"
              >
                Editar
              </Link>
            </li>
          ))}
        </ul>

        {/* Tela de edição (abre com ?editar=ID) */}
        {editing && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-title"
            className="fixed inset-0 z-50 flex items-center justify-center p-3"
          >
            {/* Fundo: clicar fecha a tela */}
            <Link
              href="/admin/produtos"
              scroll={false}
              aria-label="Fechar"
              className="absolute inset-0 bg-black/80"
            />

            <div className="relative max-h-[95vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-white/10 bg-[#1b1b1b] p-5 sm:p-7">
              <div className="mb-6 flex items-center gap-4">
                {editing.image ? (
                  <img
                    src={editing.image}
                    alt={editing.name}
                    className="h-20 w-20 shrink-0 rounded-2xl object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-20 w-20 shrink-0 rounded-2xl bg-[#292929]"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <h2 id="edit-title" className="truncate text-2xl font-black">
                    {editing.name}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {editing.category.name}
                    {!editing.available && " · Fora do cardápio"}
                  </p>
                </div>

                <Link
                  href="/admin/produtos"
                  scroll={false}
                  aria-label="Fechar"
                  className="shrink-0 rounded-lg bg-[#333] px-3 py-2 text-lg font-bold leading-none hover:bg-[#444]"
                >
                  ×
                </Link>
              </div>

              <form action={updateProduct} className="grid grid-cols-2 gap-4">
                <input type="hidden" name="id" value={editing.id} />

                <div>
                  <label
                    htmlFor="edit-price"
                    className="mb-1 block text-sm font-bold"
                  >
                    Valor (R$)
                  </label>
                  <input
                    id="edit-price"
                    name="price"
                    required
                    inputMode="decimal"
                    defaultValue={priceToInput(editing.price)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor="edit-stock"
                    className="mb-1 block text-sm font-bold"
                  >
                    Estoque
                  </label>
                  <input
                    id="edit-stock"
                    name="stock"
                    type="number"
                    min={0}
                    step={1}
                    required
                    defaultValue={editing.stock}
                    className={inputClass}
                  />
                </div>

                <div className="col-span-2">
                  <label
                    htmlFor="edit-description"
                    className="mb-1 block text-sm font-bold"
                  >
                    Descrição
                  </label>
                  <textarea
                    id="edit-description"
                    name="description"
                    rows={4}
                    maxLength={300}
                    defaultValue={editing.description ?? ""}
                    className={inputClass}
                  />
                </div>

                <button
                  type="submit"
                  className="col-span-2 rounded-xl bg-[#D4AF37] py-3 text-sm font-black text-black hover:bg-[#E6C65C]"
                >
                  Salvar alterações
                </button>
              </form>

              <form action={toggleProduct} className="mt-3">
                <input type="hidden" name="id" value={editing.id} />
                <input
                  type="hidden"
                  name="available"
                  value={String(!editing.available)}
                />
                <button
                  type="submit"
                  className={`w-full rounded-xl py-3 text-sm font-bold ${
                    editing.available
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  }`}
                >
                  {editing.available
                    ? "Tirar do cardápio"
                    : "Colocar no cardápio"}
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
