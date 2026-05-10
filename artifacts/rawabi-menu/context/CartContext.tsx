import React, { createContext, useContext, useState, useCallback } from "react";
import { MenuItem } from "@/constants/menu";

export interface CartCustomization {
  size?: string;
  riceType?: string;
  addon?: string;
  extraPrice?: number;
}

export interface CartItem {
  item: MenuItem;
  quantity: number;
  customization?: CartCustomization;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem, qty?: number, customization?: CartCustomization) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((item: MenuItem, qty: number = 1, customization?: CartCustomization) => {
    setItems((prev) => {
      const existing = prev.find((c) => c.item.id === item.id);
      if (existing) {
        return prev.map((c) =>
          c.item.id === item.id ? { ...c, quantity: c.quantity + qty } : c
        );
      }
      return [...prev, { item, quantity: qty, customization }];
    });
  }, []);

  const removeItem = useCallback((itemId: string) => {
    setItems((prev) => prev.filter((c) => c.item.id !== itemId));
  }, []);

  const updateQuantity = useCallback((itemId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((c) => c.item.id !== itemId));
    } else {
      setItems((prev) =>
        prev.map((c) => (c.item.id === itemId ? { ...c, quantity } : c))
      );
    }
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, c) => sum + c.quantity, 0);
  const totalPrice = items.reduce((sum, c) => {
    const extra = c.customization?.extraPrice ?? 0;
    return sum + (c.item.price + extra) * c.quantity;
  }, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
}
