import React, { createContext, useContext, useState, useCallback, useMemo } from "react";
import { MenuItem } from "@/constants/menu";

export interface CartCustomization {
  size?: string;
  riceType?: string;
  addon?: string;
  extraPrice?: number;
  selectedOptions?: { groupName: string; choice: string }[];
}

export interface CartItem {
  cartItemId: string;
  item: MenuItem;
  quantity: number;
  customization?: CartCustomization;
}

interface CartActions {
  addItem: (item: MenuItem, qty?: number, customization?: CartCustomization) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
}

interface CartState {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
}

const CartActionsContext = createContext<CartActions | undefined>(undefined);
const CartStateContext = createContext<CartState | undefined>(undefined);

export function getCartItemId(itemId: string, customization?: CartCustomization): string {
  if (!customization) return itemId;

  const selectedOptions = [...(customization.selectedOptions ?? [])]
    .sort((a, b) => a.groupName.localeCompare(b.groupName) || a.choice.localeCompare(b.choice));

  return `${itemId}:${JSON.stringify({
    size: customization.size ?? null,
    riceType: customization.riceType ?? null,
    addon: customization.addon ?? null,
    selectedOptions,
    extraPrice: customization.extraPrice ?? 0,
  })}`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: MenuItem, qty: number = 1, customization?: CartCustomization) => {
    const cartItemId = getCartItemId(item.id, customization);
    setItems((prev) => {
      const existing = prev.find((c) => c.cartItemId === cartItemId);
      if (existing) {
        return prev.map((c) =>
          c.cartItemId === cartItemId ? { ...c, quantity: c.quantity + qty } : c
        );
      }
      return [...prev, { cartItemId, item, quantity: qty, customization }];
    });
  }, []);

  const removeItem = useCallback((cartItemId: string) => {
    setItems((prev) => prev.filter((c) => c.cartItemId !== cartItemId));
  }, []);

  const updateQuantity = useCallback((cartItemId: string, quantity: number) => {
    setItems((prev) => {
      const exactMatch = prev.find((c) => c.cartItemId === cartItemId);
      const targetId = exactMatch?.cartItemId
        ?? [...prev].reverse().find((c) => c.item.id === cartItemId)?.cartItemId;

      if (!targetId) return prev;
      if (quantity <= 0) return prev.filter((c) => c.cartItemId !== targetId);
      return prev.map((c) => (c.cartItemId === targetId ? { ...c, quantity } : c));
    });
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const actions = useMemo<CartActions>(
    () => ({ addItem, removeItem, updateQuantity, clearCart }),
    [addItem, removeItem, updateQuantity, clearCart]
  );

  const totalItems = useMemo(() => items.reduce((s, c) => s + c.quantity, 0), [items]);
  const totalPrice = useMemo(
    () => items.reduce((s, c) => s + (c.item.price + (c.customization?.extraPrice ?? 0)) * c.quantity, 0),
    [items]
  );

  const state = useMemo<CartState>(
    () => ({ items, totalItems, totalPrice }),
    [items, totalItems, totalPrice]
  );

  return (
    <CartActionsContext.Provider value={actions}>
      <CartStateContext.Provider value={state}>
        {children}
      </CartStateContext.Provider>
    </CartActionsContext.Provider>
  );
}

export function useCartActions(): CartActions {
  const ctx = useContext(CartActionsContext);
  if (!ctx) throw new Error("useCartActions must be used within CartProvider");
  return ctx;
}

export function useCartState(): CartState {
  const ctx = useContext(CartStateContext);
  if (!ctx) throw new Error("useCartState must be used within CartProvider");
  return ctx;
}

export function useCart(): CartActions & CartState {
  return { ...useCartActions(), ...useCartState() };
}
