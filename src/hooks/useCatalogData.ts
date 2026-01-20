// src/hooks/useCatalogData.ts
import { useState, useEffect } from 'react';
import { collection, getDocs, doc, onSnapshot, query, limit, orderBy } from 'firebase/firestore';
import { db } from '@/lib/firebase'; // Asegúrate de que la ruta sea correcta
import { Product, Review, HeroSlide, CategoryTile } from '@/types';

const STARTER_REVIEWS: Review[] = [
    { id: 'st-1', userName: 'Alejandro Martín', rating: 5, comment: 'La calidad de la tela es increíble, idéntica a la oficial.', createdAt: new Date(), purchasedItems: ['1ª Real Madrid'] },
    { id: 'st-2', userName: 'Sofía Rodríguez', rating: 5, comment: 'Perfecto para regalo.', createdAt: new Date(), purchasedItems: ['Retro Barcelona'] },
    { id: 'st-3', userName: 'David García', rating: 4, comment: 'Buena atención por WhatsApp.', createdAt: new Date(), purchasedItems: ['2ª Liverpool'] },
];

export function useCatalogData() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [latestProducts, setLatestProducts] = useState<Product[]>([]);
  const [bestSellers, setBestSellers] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [categoryDiscounts, setCategoryDiscounts] = useState<Record<string, number>>({});
  
  const [configLoading, setConfigLoading] = useState(true);
  const [heroSlides, setHeroSlides] = useState<HeroSlide[]>([]);
  const [qualityImages, setQualityImages] = useState<string[]>([]);
  const [catTiles, setCatTiles] = useState<CategoryTile[]>([]);

  useEffect(() => {
    // 1. Configuración
    const unsubConfig = onSnapshot(doc(db, 'settings', 'config'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setIsMaintenance(data.maintenance);
        setGlobalDiscount(data.globalDiscount || 0);
        if (data.heroSlides && Array.isArray(data.heroSlides)) setHeroSlides(data.heroSlides);
        if (data.catTiles && data.catTiles.length > 0) setCatTiles(data.catTiles);
        if (data.qualityGallery && Array.isArray(data.qualityGallery)) setQualityImages(data.qualityGallery);
      }
      setConfigLoading(false);
    });

    // 2. Descuentos
    const unsubDiscounts = onSnapshot(doc(db, 'settings', 'discounts'), (doc) => {
      if (doc.exists()) {
        setCategoryDiscounts(doc.data().categories || {});
      }
    });

    // 3. Productos y Reviews
    async function fetchData() {
      try {
        const querySnapshot = await getDocs(collection(db, 'products'));
        const productsData = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Product[];
        setAllProducts(productsData);

        const sortedBySales = [...productsData].sort((a, b) => (b.sales || 0) - (a.sales || 0));
        setBestSellers(sortedBySales.slice(0, 6));

        const sortedByDate = [...productsData].sort((a, b) => {
            const dateA = a.createdAt?.seconds || (new Date(a.createdAt).getTime() / 1000) || 0;
            const dateB = b.createdAt?.seconds || (new Date(b.createdAt).getTime() / 1000) || 0;
            return dateB - dateA;
        });
        setLatestProducts(sortedByDate.slice(0, 4));

        const qReviews = query(collection(db, 'reviews'), orderBy('createdAt', 'desc'), limit(10));
        const revSnap = await getDocs(qReviews);
        const realReviews = revSnap.docs.map(d => ({ id: d.id, ...d.data() })) as Review[];
        setReviews(realReviews.length > 0 ? realReviews : STARTER_REVIEWS);
      } catch (error) {
        console.error(error);
      }
    }
    fetchData();

    return () => { unsubConfig(); unsubDiscounts(); };
  }, []);

  return {
    allProducts,
    latestProducts,
    bestSellers,
    reviews,
    isMaintenance,
    globalDiscount,
    categoryDiscounts,
    configLoading,
    heroSlides,
    qualityImages,
    catTiles
  };
}