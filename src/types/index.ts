// src/types/index.ts
export interface Product {
  id: string;
  name: string;
  base_price: number;
  category?: string;
  images?: string[];
  createdAt?: any;
  sales?: number;
}

export interface Review {
  id: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
  purchasedItems?: string[];
  photos?: string[];
}

export interface HeroSlide {
  image: string;
  title: string;
  subtitle: string;
  link: string;
  buttonText: string;
}

export interface CategoryTile {
  title: string;
  img: string;
  link: string;
}