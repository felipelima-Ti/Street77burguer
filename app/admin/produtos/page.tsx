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

const inputClass =
  "w-full rounded-xl border border-white/10 bg-[#222] px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:border-[#D4AF37] focus:outline-none";

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; erro?: string }>;
}) {
  const { ok, erro } = await searchParams;

  const categories = await prisma.category.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  const products = await prisma.product.findMany({
    orderBy: { position: "asc" },
    include: { category: true },
  });

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

        <ul className="space-y-4">
          {products.map((product) => (
            <li
              key={product.id}
              className={`rounded-2xl border border-white/10 bg-[#1c1c1c] p-4 ${
                product.available ? "" : "opacity-60"
              }`}
            >
              <div className="flex items-center gap-3">
                {product.image ? (
                  <img
                    src={product.image}
                    alt={product.name}
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                ) : (
                  <div
                    aria-hidden="true"
                    className="h-14 w-14 rounded-xl bg-[#292929]"
                  />
                )}

                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{product.name}</p>
                  <p className="text-xs text-gray-400">
                    {product.category.name}
                    {!product.available && " · Fora do cardápio"}
                    {product.available && product.stock === 0 && " · Sem estoque"}
                  </p>
                </div>
              </div>

              <form action={updateProduct} className="mt-4 grid grid-cols-2 gap-3">
                <input type="hidden" name="id" value={product.id} />

                <div>
                  <label
                    htmlFor={`price-${product.id}`}
                    className="mb-1 block text-xs font-bold"
                  >
                    Valor (R$)
                  </label>
                  <input
                    id={`price-${product.id}`}
                    name="price"
                    required
                    inputMode="decimal"
                    defaultValue={priceToInput(product.price)}
                    className={inputClass}
                  />
                </div>

                <div>
                  <label
                    htmlFor={`stock-${product.id}`}
                    className="mb-1 block text-xs font-bold"
                  >
                    Estoque
                  </label>
                  <input
                    id={`stock-${product.id}`}
                    name="stock"
                    type="number"
                    min={0}
                    step={1}
                    required
                    defaultValue={product.stock}
                    className={inputClass}
                  />
                </div>

                <div className="col-span-2">
                  <label
                    htmlFor={`description-${product.id}`}
                    className="mb-1 block text-xs font-bold"
                  >
                    Descrição
                  </label>
                  <textarea
                    id={`description-${product.id}`}
                    name="description"
                    rows={2}
                    maxLength={300}
                    defaultValue={product.description ?? ""}
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

              <form action={toggleProduct} className="mt-2">
                <input type="hidden" name="id" value={product.id} />
                <input
                  type="hidden"
                  name="available"
                  value={String(!product.available)}
                />
                <button
                  type="submit"
                  className={`w-full rounded-xl py-3 text-sm font-bold ${
                    product.available
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                  }`}
                >
                  {product.available
                    ? "Tirar do cardápio"
                    : "Colocar no cardápio"}
                </button>
              </form>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}
