'use client';

import React, { useEffect, useState, useRef, Suspense } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { collection, getDocs, doc, onSnapshot, query, limit, orderBy, addDoc } from 'firebase/firestore';
import { ref, getDownloadURL, uploadBytes } from 'firebase/storage';
// Asegúrate de haber hecho el PASO 2 (exportar storage en firebase.ts)
import { db, storage } from '../lib/firebase'; 
import { Hammer, Star, ChevronLeft, ChevronRight, CheckCircle, Search, X, Camera } from 'lucide-react';

// --- TIPOS ---
interface Product { id: string; name: string; base_price: number; category?: string; images?: string[]; createdAt?: any; sales?: number; }
interface Review { id: string; userName: string; rating: number; comment: string; createdAt: any; purchasedItems?: string[]; photos?: string[]; }

const STARTER_REVIEWS: Review[] = [
    { id: 'st-1', userName: 'Alejandro Martín', rating: 5, comment: 'La calidad de la tela es increíble, idéntica a la oficial.', createdAt: new Date(), purchasedItems: ['1ª Real Madrid'] },
    { id: 'st-2', userName: 'Sofía Rodríguez', rating: 5, comment: 'Perfecto para regalo.', createdAt: new Date(), purchasedItems: ['Retro Barcelona'] },
    { id: 'st-3', userName: 'David García', rating: 4, comment: 'Buena atención por WhatsApp.', createdAt: new Date(), purchasedItems: ['2ª Liverpool'] },
];

// --- COMPONENTE PRINCIPAL ---
export default function CatalogPage() {
  return (
    <Suspense fallback={<div style={{minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center', color:'#111'}}>Cargando...</div>}>
      <CatalogContent />
    </Suspense>
  );
}

function CatalogContent() {
  // ESTADOS
  const [allProducts, setAllProducts] = useState<Product[]>([]); 
  const [latestProducts, setLatestProducts] = useState<Product[]>([]); 
  const [bestSellers, setBestSellers] = useState<Product[]>([]); 
  const [reviews, setReviews] = useState<Review[]>([]);
  
  const [isMaintenance, setIsMaintenance] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0); 
  const [categoryDiscounts, setCategoryDiscounts] = useState<Record<string, number>>({});

  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(true);

  const [heroSlides, setHeroSlides] = useState<any[]>([]); 
  const [qualityImages, setQualityImages] = useState<string[]>([]);
  const [catTiles, setCatTiles] = useState<any[]>([]); 

  const searchParams = useSearchParams();
  const searchQuery = searchParams.get('q') ? decodeURIComponent(searchParams.get('q')!).trim() : ''; 
  const categoryParam = searchParams.get('category');
  const categoryFilter = categoryParam ? decodeURIComponent(categoryParam).trim() : ''; 

  // DATA FETCHING
  useEffect(() => {
      // Configuración
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
      // Descuentos
      const unsubDiscounts = onSnapshot(doc(db, 'settings', 'discounts'), (doc) => {
          if (doc.exists()) setCategoryDiscounts(doc.data().categories || {});
      });
      return () => { unsubConfig(); unsubDiscounts(); };
  }, []);

  useEffect(() => {
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
        const realReviews = revSnap.docs.map(d => ({id: d.id, ...d.data()})) as Review[];
        setReviews(realReviews.length > 0 ? realReviews : STARTER_REVIEWS);

      } catch (error) { console.error(error); } 
    }
    fetchData();
  }, []);

  if (isMaintenance) return <div style={{ height: '100vh', background: 'white', color: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}><Hammer size={64} color="#111" style={{ marginBottom: '20px' }} /><h1>Mantenimiento</h1></div>;

  const filteredProducts = allProducts.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === '' || (product.category && product.category.toLowerCase().trim() === categoryFilter.toLowerCase());
    return matchesSearch && matchesCategory;
  });

  const isHomeView = !searchQuery && !categoryFilter;

  return (
    <div style={{ fontFamily: 'var(--font-inter)', background: '#ffffff', minHeight: '100vh', color: '#111111' }}>
        
        {/* Estilos Globales */}
        <style dangerouslySetInnerHTML={{__html: `
            @keyframes infinite-scroll { from { transform: translateX(0); } to { transform: translateX(-100%); } }
            .marquee-container { display: flex; overflow: hidden; user-select: none; gap: 0; width: 100%; }
            .marquee-track { flex-shrink: 0; display: flex; align-items: center; justify-content: flex-start; gap: 20px; min-width: 100%; padding-right: 20px; animation: infinite-scroll 40s linear infinite; }
            .marquee-container:hover .marquee-track { animation-play-state: paused; }
            .hide-scrollbar::-webkit-scrollbar { display: none; }
            .hide-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
            .fade-in-section { opacity: 0; transform: translateY(30px); transition: opacity 0.8s ease-out, transform 0.8s ease-out; will-change: opacity, visibility; }
            .fade-in-section.is-visible { opacity: 1; transform: none; }
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

// -----------------------------------------------------------
// SUB-COMPONENTES (INTEGRADOS PARA EVITAR ERRORES DE RUTA)
// -----------------------------------------------------------

function FadeIn({ children }: { children: React.ReactNode }) {
    const [isVisible, setIsVisible] = useState(false);
    const domRef = useRef<HTMLDivElement>(null);
    useEffect(() => {
        const observer = new IntersectionObserver(entries => { entries.forEach(entry => setIsVisible(entry.isIntersecting)); }, { threshold: 0.1 }); 
        const { current } = domRef;
        if (current) observer.observe(current);
        return () => { if (current) observer.unobserve(current); };
    }, []);
    return ( <div ref={domRef} className={`fade-in-section ${isVisible ? 'is-visible' : ''}`}>{children}</div> );
}

function HeroCarousel({ slides }: { slides: any[] }) {
    const [current, setCurrent] = useState(0);
    const length = slides.length;
    useEffect(() => {
        if (!slides || slides.length === 0) return;
        const timer = setInterval(() => { setCurrent(current === length - 1 ? 0 : current + 1); }, 6000);
        return () => clearInterval(timer);
    }, [current, length, slides]);
    if (!Array.isArray(slides) || slides.length <= 0) return null; 
    const nextSlide = () => setCurrent(current === length - 1 ? 0 : current + 1);
    const prevSlide = () => setCurrent(current === 0 ? length - 1 : current - 1);
    return (
        <div style={{ position: 'relative', height: '600px', width: '100%', overflow: 'hidden' }}>
            <style jsx>{` .hero-text { font-size: 3.5rem; } .hero-arrow { top: 50%; transform: translateY(-50%); } .hero-left { left: 20px; } .hero-right { right: 20px; } @media (max-width: 768px) { .hero-text { font-size: 2.2rem; } .hero-arrow { top: auto; bottom: 20px; transform: none; } .hero-left { left: 20px; } .hero-right { right: 20px; } } `}</style>
            {slides.map((slide, index) => (
                <div key={index} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', backgroundImage: `url("${slide.image || 'https://via.placeholder.com/1920x600'}")`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', opacity: index === current ? 1 : 0, transition: 'opacity 1s ease-in-out', zIndex: index === current ? 1 : 0 }}>
                    <div style={{position:'absolute', inset:0, background:'linear-gradient(to bottom, rgba(0,0,0,0.2), rgba(0,0,0,0.7))'}}></div>
                    <div style={{position:'relative', zIndex:2, textAlign:'center', padding:'20px'}}>
                        <h1 className="hero-text" style={{fontWeight: '900', textTransform: 'uppercase', margin: '0 0 15px 0', letterSpacing: '-2px', color: 'white', lineHeight:'1'}}>{slide.title}</h1>
                        <p style={{fontSize: '1.2rem', maxWidth: '600px', margin: '0 auto 40px auto', color: '#f0f0f0', fontWeight:'500'}}>{slide.subtitle}</p>
                        <a href={slide.link || '#novedades'} style={{background: 'white', color: 'black', padding: '15px 40px', borderRadius: '50px', fontWeight: 'bold', textDecoration: 'none', fontSize: '1rem', transition:'transform 0.2s', display:'inline-block'}}>{slide.buttonText}</a>
                    </div>
                </div>
            ))}
            <button onClick={prevSlide} className="hero-arrow hero-left" style={{position:'absolute', background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', padding:'10px', cursor:'pointer', zIndex:10, backdropFilter:'blur(5px)', color:'white'}}><ChevronLeft size={30}/></button>
            <button onClick={nextSlide} className="hero-arrow hero-right" style={{position:'absolute', background:'rgba(255,255,255,0.2)', border:'none', borderRadius:'50%', padding:'10px', cursor:'pointer', zIndex:10, backdropFilter:'blur(5px)', color:'white'}}><ChevronRight size={30}/></button>
            <div style={{position:'absolute', bottom:'20px', left:'50%', transform:'translateX(-50%)', display:'flex', gap:'10px', zIndex:10}}>
                {slides.map((_, idx) => ( <div key={idx} onClick={() => setCurrent(idx)} style={{width: idx === current ? '30px' : '10px', height:'10px', borderRadius:'5px', background: idx === current ? 'white' : 'rgba(255,255,255,0.5)', cursor:'pointer', transition:'all 0.3s'}} /> ))}
            </div>
        </div>
    );
}

function CategoryCard({ title, img, link }: { title: string, img: string, link: string }) {
    return (
        <Link href={link} style={{textDecoration:'none'}}>
            <div style={{ height: '250px', borderRadius: '20px', overflow: 'hidden', position: 'relative', backgroundImage: `url(${img})`, backgroundSize: 'cover', backgroundPosition: 'center', display: 'flex', alignItems: 'flex-end', padding:'20px', cursor: 'pointer', boxShadow: '0 10px 30px rgba(0,0,0,0.1)', transition:'transform 0.3s' }} className="hover:scale-[1.02]">
                <div style={{position:'absolute', inset:0, background:'linear-gradient(to top, rgba(0,0,0,0.8), transparent)'}}></div>
                <h3 style={{position:'relative', zIndex:2, color:'white', fontSize:'1.5rem', fontWeight:'800', textTransform:'uppercase', letterSpacing:'-0.5px', margin:0}}>{title}</h3>
            </div>
        </Link>
    )
}

function ProductCard({ product, globalDiscount, categoryDiscounts }: { product: Product, globalDiscount: number, categoryDiscounts?: Record<string, number> }) {
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

function PromoSection() {
    return (
        <div style={{display:'flex', gap:'10px', margin:'40px 0'}}>
            <div style={{flex:1, background:'#f4f4f5', padding:'20px', borderRadius:'16px', textAlign:'center'}}>
                <span style={{fontSize:'2rem'}}>🚚</span>
                <h4 style={{margin:'10px 0 5px 0'}}>Envío Gratis</h4>
                <p style={{fontSize:'0.8rem', color:'#666', margin:0}}>En pedidos +50€</p>
            </div>
            <div style={{flex:1, background:'#f4f4f5', padding:'20px', borderRadius:'16px', textAlign:'center'}}>
                <span style={{fontSize:'2rem'}}>🔄</span>
                <h4 style={{margin:'10px 0 5px 0'}}>Devoluciones</h4>
                <p style={{fontSize:'0.8rem', color:'#666', margin:0}}>30 días de garantía</p>
            </div>
        </div>
    )
}

function ReviewsCarousel({ reviews }: { reviews: Review[] }) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const safeReviews = reviews.length > 0 ? reviews : [];
    useEffect(() => {
        if (safeReviews.length <= 1) return;
        const interval = setInterval(() => { setCurrentIndex((p) => (p + 1) % safeReviews.length); }, 8000); 
        return () => clearInterval(interval);
    }, [safeReviews.length]);
    if (safeReviews.length === 0) return <div style={{color:'#666'}}>Sé el primero en opinar.</div>;
    const next = () => setCurrentIndex((p) => (p + 1) % safeReviews.length);
    const prev = () => setCurrentIndex((p) => (p - 1 + safeReviews.length) % safeReviews.length);
    const currentReview = safeReviews[currentIndex];
    return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '15px', minHeight: '250px' }}>
            <button onClick={prev} style={{ background: 'white', border: '1px solid #eee', color: '#111', padding: '10px', borderRadius: '50%', cursor: 'pointer', boxShadow:'0 4px 10px rgba(0,0,0,0.05)' }}><ChevronLeft size={20}/></button>
            <div style={{ flex: 1, background: 'white', padding: '30px', borderRadius: '20px', border: '1px solid #eee', maxWidth: '600px', animation: 'fadeIn 0.5s', boxShadow: '0 10px 30px rgba(0,0,0,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                    <div style={{textAlign: 'left'}}>
                        <h4 style={{ margin: 0, fontSize: '1rem', color: '#111', fontWeight:'bold' }}>{currentReview.userName}</h4>
                        <span style={{ fontSize: '0.75rem', color: '#16a34a', display: 'flex', alignItems: 'center', gap: '4px', marginTop:'2px', fontWeight:'bold' }}><CheckCircle size={12}/> Verificado</span>
                    </div>
                    <div style={{ display: 'flex' }}>{[...Array(5)].map((_, i) => <Star key={i} size={16} fill={i < currentReview.rating ? "#111" : "none"} color={i < currentReview.rating ? "#111" : "#ddd"} />)}</div>
                </div>
                <p style={{ fontSize: '1rem', fontStyle: 'italic', color: '#444', marginBottom: '15px', lineHeight:'1.5' }}>"{currentReview.comment}"</p>
                {currentReview.photos && currentReview.photos.length > 0 && (
                    <div style={{display:'flex', gap:'8px', marginBottom:'15px', overflowX:'auto'}}>
                        {currentReview.photos.map((pic, idx) => ( <img key={idx} src={pic} alt="Review pic" style={{width:'60px', height:'60px', objectFit:'cover', borderRadius:'8px', border:'1px solid #eee', cursor:'pointer'}} onClick={() => window.open(pic, '_blank')} /> ))}
                    </div>
                )}
                {currentReview.purchasedItems && currentReview.purchasedItems.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>{currentReview.purchasedItems.map((item, i) => <span key={i} style={{ background: '#f4f4f5', padding: '4px 10px', borderRadius: '15px', fontSize: '0.7rem', color: '#666', fontWeight:'600' }}>{item}</span>)}</div>}
            </div>
            <button onClick={next} style={{ background: 'white', border: '1px solid #eee', color: '#111', padding: '10px', borderRadius: '50%', cursor: 'pointer', boxShadow:'0 4px 10px rgba(0,0,0,0.05)' }}><ChevronRight size={20}/></button>
        </div>
    );
}

function ReviewModal({ onClose }: { onClose: () => void }) {
    const [step, setStep] = useState(1);
    const [orderId, setOrderId] = useState('');
    const [verifying, setVerifying] = useState(false);
    const [error, setError] = useState('');
    const [purchasedItems, setPurchasedItems] = useState<string[]>([]);
    const [userName, setUserName] = useState('');
    const [rating, setRating] = useState(5);
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [previewUrls, setPreviewUrls] = useState<string[]>([]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            const files = Array.from(e.target.files).slice(0, 3);
            setSelectedFiles(files);
            const urls = files.map(file => URL.createObjectURL(file));
            setPreviewUrls(urls);
        }
    };

    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault(); setVerifying(true); setError('');
        try {
            const { getDoc, doc } = await import('firebase/firestore');
            const orderRef = doc(db, 'orders', orderId.trim());
            const orderSnap = await getDoc(orderRef);
            if (orderSnap.exists()) {
                const data = orderSnap.data();
                setPurchasedItems(data.items?.map((i:any) => i.productName) || []);
                setUserName(data.customer?.name || '');
                setStep(2);
            } else { setError('Pedido no encontrado.'); }
        } catch (err) { setError('Error verificando.'); }
        setVerifying(false);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault(); setSubmitting(true);
        try {
            let photoUrls: string[] = [];
            if (selectedFiles.length > 0) {
                for (const file of selectedFiles) {
                    const storageRef = ref(storage, `review-images/${Date.now()}-${file.name}`);
                    await uploadBytes(storageRef, file);
                    const url = await getDownloadURL(storageRef);
                    photoUrls.push(url);
                }
            }
            await addDoc(collection(db, 'reviews'), { orderId: orderId.trim(), userName, rating, comment, purchasedItems, photos: photoUrls, createdAt: new Date() });
            alert('¡Gracias por tu opinión!'); onClose(); window.location.reload();
        } catch (err) { setError('Error al guardar.'); console.error(err) }
        setSubmitting(false);
    };

    return (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.6)', backdropFilter:'blur(5px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 3000 }}>
            <div style={{ background: 'white', padding: '30px', borderRadius: '24px', width: '90%', maxWidth: '500px', border: 'none', position: 'relative', boxShadow: '0 20px 60px rgba(0,0,0,0.1)', maxHeight:'90vh', overflowY:'auto' }}>
                <button onClick={onClose} style={{ position: 'absolute', top: '20px', right: '20px', background: 'transparent', border: 'none', color: '#111', cursor: 'pointer' }}><X /></button>
                <h2 style={{ marginTop: 0, color: '#111', fontSize:'1.5rem', fontWeight:'800' }}>{step === 1 ? 'Verifica tu compra' : 'Tu opinión cuenta'}</h2>
                {step === 1 ? ( <form onSubmit={handleVerify}><p style={{ color: '#666', marginBottom: '25px', lineHeight:'1.5', fontSize:'0.95rem' }}>Para asegurar la autenticidad, introduce tu ID de pedido.</p><input placeholder="ID Pedido (Ej: 7A3B...)" value={orderId} onChange={e => setOrderId(e.target.value)} style={{ width: '100%', padding: '12px', background: '#f9f9f9', border: '1px solid #eee', color: '#111', borderRadius: '12px', marginBottom: '15px', fontSize:'1rem', outline:'none' }} />{error && <p style={{color:'#d32f2f', fontSize:'0.85rem', marginBottom:'10px'}}>{error}</p>}<button type="submit" disabled={verifying} style={{ width: '100%', padding: '14px', background: '#111', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize:'1rem' }}>{verifying ? 'Verificando...' : 'Verificar'}</button></form> ) : ( <form onSubmit={handleSubmit}><input placeholder="Nombre público" value={userName} onChange={e => setUserName(e.target.value)} style={{ width: '100%', padding: '12px', background: '#f9f9f9', border: '1px solid #eee', color: '#111', borderRadius: '12px', marginBottom: '15px', outline:'none' }} /><div style={{ marginBottom: '20px', display: 'flex', gap: '5px' }}>{[1, 2, 3, 4, 5].map(star => (<button key={star} type="button" onClick={() => setRating(star)} style={{ background: 'transparent', border: 'none', cursor: 'pointer' }}><Star size={28} fill={star <= rating ? "#111" : "none"} color={star <= rating ? "#111" : "#ddd"} /></button>))}</div><textarea placeholder="¿Qué es lo que más te ha gustado?" value={comment} onChange={e => setComment(e.target.value)} style={{ width: '100%', padding: '12px', minHeight: '100px', background: '#f9f9f9', border: '1px solid #eee', color: '#111', borderRadius: '12px', marginBottom: '20px', fontSize:'1rem', fontFamily:'inherit', outline:'none', resize:'none' }} /><div style={{marginBottom:'20px'}}><label style={{display:'block', marginBottom:'10px', fontWeight:'600', fontSize:'0.9rem', color:'#444'}}>Añade fotos (Max 3):</label><div style={{display:'flex', gap:'10px', alignItems:'center'}}><label style={{cursor:'pointer', display:'flex', alignItems:'center', gap:'5px', padding:'10px 15px', border:'1px dashed #ccc', borderRadius:'10px', color:'#666'}}><Camera size={20} /><span style={{fontSize:'0.9rem'}}>Subir</span><input type="file" multiple accept="image/*" onChange={handleFileSelect} style={{display:'none'}} /></label><span style={{fontSize:'0.8rem', color:'#999'}}>{selectedFiles.length} seleccionadas</span></div>{previewUrls.length > 0 && (<div style={{display:'flex', gap:'10px', marginTop:'15px'}}>{previewUrls.map((url, i) => (<div key={i} style={{width:'50px', height:'50px', borderRadius:'8px', overflow:'hidden', border:'1px solid #eee'}}><img src={url} alt="preview" style={{width:'100%', height:'100%', objectFit:'cover'}} /></div>))}</div>)}</div><button type="submit" disabled={submitting} style={{ width: '100%', padding: '14px', background: '#111', color: 'white', border: 'none', borderRadius: '12px', fontWeight: 'bold', cursor: 'pointer', fontSize:'1rem' }}>{submitting ? 'Publicando...' : 'Publicar Reseña'}</button></form> )}
            </div>
        </div>
    );
}