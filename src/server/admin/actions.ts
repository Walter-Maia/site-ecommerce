"use server";
import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { FormState } from "../actions/auth";
import { requireAdmin } from "../session";
import { idSchema, fieldErrors, SIZES } from "../validation";
import { audit } from "./audit";
import { createMannequin, deleteMannequin, mannequinInUse, updateMannequin } from "./mannequins";
import { OrderStatusError, updateOrderStatus } from "./orders";
import { updateProduct } from "./products";
import { MANNEQUIN_FIELDS, mannequinSchema, orderStatusSchema, productUpdateSchema, stockSchema } from "./schemas";

/**
 * Ações do painel. TODAS começam com requireAdmin(): não logado → /entrar;
 * logado sem papel admin → 404. Toda mutação grava audit_log.
 */

const INVALID: FormState = { error: "Revise os campos destacados." };

function readMannequinForm(fd: FormData) {
  const obj: Record<string, FormDataEntryValue | undefined> = {};
  for (const k of MANNEQUIN_FIELDS) obj[k] = fd.get(k) ?? undefined;
  return mannequinSchema.safeParse(obj);
}

export async function updateProductAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Produto inválido." };

  const parsed = productUpdateSchema.safeParse({
    price: fd.get("price"),
    compareAtPrice: fd.get("compareAtPrice") ?? "",
    isNew: fd.get("isNew"),
    isFeatured: fd.get("isFeatured"),
  });
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };

  const stock: Record<string, number> = {};
  const stockErrors: Record<string, string> = {};
  for (const size of SIZES) {
    const raw = fd.get(`stock:${size}`);
    if (raw === null) continue;
    const s = stockSchema.safeParse(raw);
    if (s.success) stock[size] = s.data;
    else stockErrors[`stock:${size}`] = "Estoque entre 0 e 9999.";
  }
  if (Object.keys(stockErrors).length) return { ...INVALID, fieldErrors: stockErrors };

  const before = updateProduct(id.data, parsed.data, stock);
  if (!before) return { error: "Produto não encontrado." };
  await audit(admin, "product.update", "product", id.data, {
    price: [before.price, parsed.data.price],
    compareAtPrice: [before.compareAtPrice ?? null, parsed.data.compareAtPrice],
    isNew: [before.isNew, parsed.data.isNew],
    isFeatured: [before.isFeatured, parsed.data.isFeatured],
    stock: Object.fromEntries(before.sizes.filter((s) => stock[s.size] !== undefined && stock[s.size] !== s.stock).map((s) => [s.size, [s.stock, stock[s.size]]])),
  });
  refresh();
  return { success: true };
}

export async function createMannequinAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = readMannequinForm(fd);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };
  const created = createMannequin(parsed.data);
  await audit(admin, "mannequin.create", "mannequin", created.id, parsed.data);
  redirect(`/admin/manequins/${created.id}?salvo=1`);
}

export async function updateMannequinAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Manequim inválido." };
  const parsed = readMannequinForm(fd);
  if (!parsed.success) return { ...INVALID, fieldErrors: fieldErrors(parsed.error) };
  const result = updateMannequin(id.data, parsed.data);
  if (!result) return { error: "Manequim não encontrado." };
  await audit(admin, "mannequin.update", "mannequin", id.data, { before: result.before, after: result.after });
  refresh();
  return { success: true };
}

export async function deleteMannequinAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const id = idSchema.safeParse(fd.get("id"));
  if (!id.success) return { error: "Manequim inválido." };
  if (mannequinInUse(id.data)) {
    return { error: "Este manequim é usado nos looks editoriais. Desative-o em vez de apagar." };
  }
  const removed = deleteMannequin(id.data);
  if (!removed) return { error: "Manequim não encontrado." };
  await audit(admin, "mannequin.delete", "mannequin", id.data, removed);
  redirect("/admin/manequins?apagado=1");
}

export async function updateOrderStatusAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  const parsed = orderStatusSchema.safeParse({ id: fd.get("id"), status: fd.get("status") });
  if (!parsed.success) return { error: "Status inválido." };
  try {
    const change = updateOrderStatus(parsed.data.id, parsed.data.status);
    if (change.from !== change.to) await audit(admin, "order.status", "order", parsed.data.id, change);
  } catch (err) {
    if (err instanceof OrderStatusError) return { error: err.message };
    throw err;
  }
  refresh();
  return { success: true };
}
