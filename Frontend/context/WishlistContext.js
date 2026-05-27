"use client";

import { createContext, useContext, useState, useEffect, useCallback, useMemo } from "react";

const WishlistContext = createContext();

export function WishlistProvider({ children }) {
  const [wishlistItems, setWishlistItems] = useState(() => {
    try {
      const stored = localStorage.getItem("ruvia_wishlist");
      return stored ? JSON.parse(stored) : [];
    } catch (e) {
      console.error("Failed to load wishlist", e);
      return [];
    }
  });

  // Save to local storage
  useEffect(() => {
    try {
      localStorage.setItem("ruvia_wishlist", JSON.stringify(wishlistItems));
    } catch (e) {
      console.error("Failed to save wishlist", e);
    }
  }, [wishlistItems]);

  const toggleWishlist = useCallback((product) => {
    setWishlistItems(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) {
        return prev.filter(item => item.id !== product.id);
      }
      return [...prev, product];
    });
  }, []);

  const addToWishlist = useCallback((product) => {
    setWishlistItems(prev => {
      const exists = prev.find(item => item.id === product.id);
      if (exists) return prev;
      return [...prev, product];
    });
  }, []);

  const isInWishlist = useCallback((id) => {
    return wishlistItems.some(item => item.id === id);
  }, [wishlistItems]);

  const removeFromWishlist = useCallback((id) => {
    setWishlistItems(prev => prev.filter(item => item.id !== id));
  }, []);

  const clearWishlist = useCallback(() => {
    setWishlistItems([]);
  }, []);

  const value = useMemo(() => ({
    wishlistItems,
    toggleWishlist,
    addToWishlist,
    isInWishlist,
    removeFromWishlist,
    clearWishlist
  }), [wishlistItems, toggleWishlist, addToWishlist, isInWishlist, removeFromWishlist, clearWishlist]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error("useWishlist must be used within a WishlistProvider");
  }
  return context;
}
