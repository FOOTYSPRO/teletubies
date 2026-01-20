'use client';
import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ref, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { Product } from '@/types';

interface ProductCardProps {
  product: Product;
  globalDiscount: number;
  categoryDiscounts?: Record<string, number>;
}

export default function ProductCard({ product, globalDiscount, categoryDiscounts }: ProductCardProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [isHovered, setIsHovered] = useState(false);

  useEffect(() => {
    const imageFilename = product.images && product.images.length > 0 ? product.images[0] : `${product.id}.jpg`;
    const cacheKey = `img_cache_${imageFilename}`;
    const cachedUrl = sessionStorage.getItem(cacheKey);
    if (cachedUrl) { setImageUrl(cachedUrl); return; }
    
    async function fetchImage() {
      try {
        let imageRef;
        if (product.images && product.images.length > 0) imageRef = ref(storage, `products-images/${product.images[0]}`);
        else imageRef = ref(storage, `products-images/${product.id}.jpg`);
        const url = await getDownloadURL(imageRef);
        setImageUrl(url);
        sessionStorage.setItem(cacheKey, url);
      } catch (error) { }
    }
    fetchImage();
  }, [product]);

  const categoryDiscount = (product.category && categoryDiscounts && categoryDiscounts[product.category]) || 0;
  const activeDiscount = categoryDiscount > 0 ? categoryDiscount : globalDiscount;
  const finalPrice = activeDiscount > 0 ? product.base_price * (1 - activeDiscount / 100) : product.base_price;

  return (
    <Link href={`/product/${product.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)} style={{ cursor: 'pointer', height: '100%', display: 'flex', flexDirection: 'column', transition: 'transform 0.2s ease' }}>
          <div style={{ aspectRatio: '3/4', width: '100%', background: '#f4f4f5', borderRadius: '16px', overflow: 'hidden', position: 'relative', marginBottom:'12px' }}>
              {activeDiscount > 0 && <span style={{ position: 'absolute', top: '10px', left: '10px', background: '#111', color: 'white', fontSize: '0.7rem', padding: '4px 8px', fontWeight: 'bold', zIndex: 2, borderRadius:'6px' }}>-{activeDiscount}%</span>}
              {imageUrl ? (
                  <Image src={imageUrl} alt={product.name} fill quality={95} sizes="(max-width: 768px) 50vw, 33vw" style={{ objectFit: 'cover', objectPosition: 'top center', transition: 'transform 0.5s ease', transform: isHovered ? 'scale(1.05)' : 'scale(1)' }} priority={false} />
              ) : <div style={{width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize: '2rem', opacity: 0.2}}>👕</div>}
          </div>
          <div>
              <div style={{display:'flex', flexDirection:'column', gap:'2px'}}>
                  <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '600', color: '#111', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{product.name}</h3>
                  <p style={{fontSize:'0.8rem', color:'#666', margin:0}}>{product.category || 'Camiseta'}</p>
                  <div style={{marginTop:'5px', display:'flex', alignItems:'center', gap:'8px'}}>
                      {activeDiscount > 0 ? (
                          <>
                            <span style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '0.95rem' }}>{finalPrice.toFixed(2)}€</span>
                            <span style={{ textDecoration: 'line-through', color: '#999', fontSize: '0.8rem' }}>{product.base_price.toFixed(2)}€</span>
                          </>
                      ) : ( <span style={{ color: '#111', fontWeight: 'bold', fontSize: '0.95rem' }}>{product.base_price.toFixed(2)}€</span> )}
                  </div>
              </div>
          </div>
      </div>
    </Link>
  );
}