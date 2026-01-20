'use client';

import React, { useState, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Hammer, Search } from 'lucide-react';

// Hooks
import { useCatalogData } from '../hooks/useCatalogData';

// Componentes
import HeroCarousel from '../components/catalog/HeroCarousel';
import ProductCard from '../components/catalog/ProductCard';
import CategoryCard from '../components/catalog/CategoryCard';
import ReviewsCarousel from '../components/catalog/ReviewsCarousel';
import ReviewModal from '../components/catalog/ReviewModal';
import FadeIn from '../components/ui/FadeIn';
import PromoSection from '../components/PromoSection'; // Asumiendo que ya existía

export default function CatalogPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#111'}}>Cargando...</div>}>
      <CatalogContent />
    </Suspense>
  );
}

function CatalogContent() {
  // Usamos el Custom Hook
  const {
    allProducts, latestProducts, bestSellers, reviews,
    isMaintenance, globalDiscount, categoryDiscounts,
    configLoading, heroSlides, qualityImages, catTiles
  } = useCatalogData();

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const searchParams = useSearchParams();
  
  const searchQuery = searchParams.get('q') ? decodeURIComponent(searchParams.get('q')!).trim() : ''; 
  const categoryParam = searchParams.get('category');
  const categoryFilter = categoryParam ? decodeURIComponent(categoryParam).trim() : ''; 

  // Mantenimiento
  if (isMaintenance) return <div style={{ height: '100vh', background: 'white', color: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Hammer size={64} color="#111" style={{ marginBottom: '20px' }} /><h1>Mantenimiento</h1></div>;

  // Filtro
  const filteredProducts = allProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === '' || (product.category && product.category.toLowerCase().trim() === categoryFilter.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const isHomeView = !searchQuery && !categoryFilter;

  return (
    <div style={{ fontFamily: 'var(--font-inter)', background: '#ffffff', minHeight: '100vh', color: '#111111' }}>
        
        {/* Estilos globales inyectados (si no usas CSS modules o Tailwind) */}
        <style dangerouslySetInnerHTML={{__html: `
            @keyframes infinite-scroll { from { transform: translateX(0); } to { transform: translateX(-100%); } }
            .marquee-container { display: flex; overflow: hidden; user-select: none; gap: 0; width: 100%; }
            .marquee-track { flex-shrink: 0; display: flex; align-items: center; justify-content: flex-start; gap: 20px; min-width: 100%; padding-right: 20px; animation: infinite-scroll 40s linear infinite; }
            .marquee-container:hover .marquee-track { animation-play-state: paused; }
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            .skeleton { background: #e0e0e0; border-radius: 8px; animation: pulse 1.5s infinite ease-in-out; }
            @keyframes pulse { 0% { opacity: 0.6; } 50% { opacity: 1; } 100% { opacity: 0.6; } }
        `}} />

      {/* 1. HERO CAROUSEL */}
      {isHomeView && (
          configLoading ? ( <div className="skeleton" style={{ height: '600px', width: '100%', borderRadius:0 }}></div> ) : ( <HeroCarousel slides={heroSlides} /> )
      )}

      {globalDiscount > 0 && (
          <div style={{ background: '#111', color: 'white', textAlign: 'center', padding: '12px', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing:'1px', fontSize:'0.85rem' }}>
              🔥 ¡OFERTA LIMITADA! Todo al {globalDiscount}% de descuento 🔥
          </div>
      )}

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 20px' }}>

        {isHomeView ? (
            <>
                {/* TENDENCIAS */}
                <FadeIn>
                    <div style={{ marginBottom: '60px' }}>
                        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'30px'}}>
                            <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight:'900', letterSpacing:'-1px', color: '#111' }}>Tendencias</h2>
                            <Link href="/catalog" style={{textDecoration:'none', color:'#111', fontWeight:'bold', fontSize:'0.9rem', borderBottom:'1px solid #111'}}>Ver todo</Link>
                        </div>
                        {configLoading ? (
                             <div style={{display:'flex', gap:'20px', overflow:'hidden'}}>{[1,2,3,4].map(i => <div key={i} className="skeleton" style={{width:'260px', height:'350px', flexShrink:0, borderRadius:'16px'}}></div>)}</div>
                        ) : (
                            <div style={{ display: 'flex', gap: '20px', overflowX: 'auto', paddingBottom: '30px', scrollSnapType: 'x mandatory' }} className="hide-scrollbar">
                                {bestSellers.map(product => (
                                    <div key={product.id} style={{ width: '260px', flexShrink: 0, scrollSnapAlign: 'start' }}>
                                        <ProductCard product={product} globalDiscount={globalDiscount} categoryDiscounts={categoryDiscounts} />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </FadeIn>

                <PromoSection />

                {/* CATEGORÍAS */}
                <div style={{ marginBottom: '80px', marginTop: '40px' }}>
                    <h2 style={{ fontSize: '1.8rem', margin: '0 0 30px 0', fontWeight:'900', letterSpacing:'-1px', color:'#111' }}>Explora por Liga</h2>
                    {configLoading ? (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>{[1,2,3].map(i => <div key={i} className="skeleton" style={{height:'250px', borderRadius:'20px'}}></div>)}</div>
                    ) : (
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
                            {catTiles.map((tile, i) => ( <CategoryCard key={i} title={tile.title} img={tile.img} link={tile.link} /> ))}
                        </div>
                    )}
                </div>

                {/* GALERÍA DE CALIDAD */}
                {qualityImages.length > 0 && !configLoading && (
                    <div style={{ marginBottom: '80px' }}>
                        <div style={{textAlign:'center', marginBottom:'40px'}}>
                            <h2 style={{ fontSize: '1.8rem', margin: '0 0 10px 0', fontWeight:'900', letterSpacing:'-1px', color:'#111' }}>Nuestra Calidad</h2>
                            <p style={{color:'#666', fontSize:'1rem'}}>Detalles que marcan la diferencia.</p>
                        </div>
                        <div className="marquee-container">
                            <div className="marquee-track">
                                {qualityImages.map((img, i) => ( <div key={`t1-${i}`} style={{ height: '300px', width: '300px', flexShrink: 0, borderRadius: '20px', overflow: 'hidden', background: '#f4f4f5', position: 'relative' }}> <Image src={img} alt="Calidad" fill style={{ objectFit: 'cover' }} sizes="300px" /> </div> ))}
                            </div>
                            <div className="marquee-track" aria-hidden="true">
                                {qualityImages.map((img, i) => ( <div key={`t2-${i}`} style={{ height: '300px', width: '300px', flexShrink: 0, borderRadius: '20px', overflow: 'hidden', background: '#f4f4f5', position: 'relative' }}> <Image src={img} alt="Calidad" fill style={{ objectFit: 'cover' }} sizes="300px" /> </div> ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* RECIÉN LLEGADAS */}
                <FadeIn>
                    <div id="novedades" style={{ marginBottom: '60px' }}>
                        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'30px'}}>
                            <h2 style={{ fontSize: '1.8rem', margin: 0, fontWeight:'900', letterSpacing:'-1px', color:'#111' }}>Recién llegadas</h2>
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px 15px' }}>
                            {latestProducts.map((product) => (
                                <ProductCard key={product.id} product={product} globalDiscount={globalDiscount} categoryDiscounts={categoryDiscounts} />
                            ))}
                        </div>
                    </div>
                </FadeIn>
            </>
        ) : (
            <div id="catalogo">
                <h2 style={{ fontSize: '2rem', marginBottom: '40px', fontWeight:'900', color: '#111' }}>
                    {categoryFilter ? categoryFilter : `Resultados para "${searchQuery}"`}
                </h2>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: '20px 15px' }}>
                    {filteredProducts.map((product) => (
                        <FadeIn key={product.id}>
                            <ProductCard key={product.id} product={product} globalDiscount={globalDiscount} categoryDiscounts={categoryDiscounts} />
                        </FadeIn>
                    ))}
                </div>
                {filteredProducts.length === 0 && (
                    <div style={{ textAlign: 'center', padding: '100px 20px', color: '#666' }}>
                        <Search size={48} style={{marginBottom:'20px', opacity:0.5}} />
                        <p style={{fontSize: '1.2rem', fontWeight:'bold'}}>No hemos encontrado nada.</p>
                        <Link href="/" style={{ color: '#111', textDecoration: 'underline', fontWeight: 'bold', marginTop:'20px', display:'inline-block' }}>Volver al inicio</Link>
                    </div>
                )}
            </div>
        )}

      </div>

      {isHomeView && (
        <div style={{ background: '#f9f9f9', padding: '80px 20px', borderTop: '1px solid #eee' }}>
            <div style={{ maxWidth: '1000px', margin: '0 auto', textAlign: 'center' }}>
                <h2 style={{ fontSize: '1.8rem', color: '#111', marginBottom: '10px', fontWeight:'900', letterSpacing:'-1px' }}>La comunidad habla</h2>
                <p style={{color:'#666', marginBottom:'40px', fontSize:'1rem'}}>Únete a los más de 500 clientes satisfechos.</p>
                <ReviewsCarousel reviews={reviews} />
                <button onClick={() => setIsReviewModalOpen(true)} style={{ marginTop: '40px', background: 'white', border: '1px solid #111', color: '#111', padding: '12px 30px', borderRadius: '50px', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 'bold', transition:'all 0.3s' }}>Escribir una reseña</button>
            </div>
        </div>
      )}

      {isReviewModalOpen && <ReviewModal onClose={() => setIsReviewModalOpen(false)} />}
    </div>
  );
}