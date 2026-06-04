import { useState, useEffect, useRef } from 'react'
import BarcodeIcon from '../components/svgs/BarcodeIcon'
import ScanIcon from '../components/svgs/ScanIcon'
import LockIcon from '../components/svgs/LockIcon'
import CoinIcon from '../components/svgs/CoinIcon'
import BottleIcon from '../components/svgs/BottleIcon'
import CanIcon from '../components/svgs/CanIcon'
import BoxIcon from '../components/svgs/BoxIcon'

/* Popular Nigerian products that carry scannable barcodes */
const NIGERIAN_PRODUCTS = [
  { name: 'Swan Table Water', size: '75cl', type: 'Plastic', color: '#3b82f6', img: '/Scannable%20items/swan%2075%20cl.jpg' },
  { name: 'Eva Water', size: '50cl', type: 'Plastic', color: '#06b6d4', img: '/Scannable%20items/eva%2050%20cl.jpg' },
  { name: 'Coca-Cola', size: '60cl', type: 'Plastic', color: '#ef4444', img: '/Scannable%20items/coca-cola%2060%20cl.jpg' },
  { name: 'Pepsi Bottle', size: '50cl', type: 'Plastic', color: '#6366f1', img: '/Scannable%20items/pepsi.jpg' },
  { name: 'Fanta Orange', size: '50cl', type: 'Plastic', color: '#f97316', img: '/Scannable%20items/fanta.jpg' },
  { name: 'Chi Exotic Juice', size: '50cl', type: 'Carton', color: '#eab308', img: '/Scannable%20items/exotic.jpg' },
  { name: 'Malta Guinness', size: '33cl', type: 'Can', color: '#78716c', img: '/Scannable%20items/malta%20guiness.jpg' },
  { name: 'Amstel Malt', size: '33cl', type: 'Can', color: '#d97706', img: '/Scannable%20items/amstel%20Malt.jpg' },
  { name: 'Peak Milk', size: 'Tin', type: 'Metal', color: '#64748b', img: '/Scannable%20items/peak%20milk.jpg' },
  { name: 'Indomie Noodles', size: '70g', type: 'Pack', color: '#dc2626', img: '/Scannable%20items/indomie.jpg' },
  { name: 'Lucozade Boost', size: '33cl', type: 'Plastic', color: '#ca8a04', img: '/Scannable%20items/Lucozade%20Boost.jpg' },
  { name: '7UP Bottle', size: '60cl', type: 'Plastic', color: '#16a34a', img: '/Scannable%20items/7UP%20Bottle.jpg' },
]

const STEPS = [
  {
    num: '01',
    icon: <ScanIcon size={28} color="var(--mint)" />,
    title: 'Find litter with a barcode',
    desc: 'Spot a discarded bottle, can, or carton on campus. If it has a barcode, you can claim it.',
  },
  {
    num: '02',
    icon: <BarcodeIcon size={28} color="var(--mint)" />,
    title: 'Scan the barcode',
    desc: 'Point your camera at the barcode. The number under the bars gets read instantly.',
  },
  {
    num: '03',
    icon: <LockIcon size={28} color="var(--mint)" />,
    title: 'First scan wins',
    desc: 'Every barcode can only be claimed once — globally. Be faster than your classmates.',
  },
  {
    num: '04',
    icon: <CoinIcon size={28} color="var(--mint)" />,
    title: 'Earn 3 points',
    desc: 'Each unique barcode you claim adds 3 points. Race to the top of the leaderboard.',
  },
]

export default function Landing({ onStart, onHowItWorks }) {
  const [activeStep, setActiveStep] = useState(null)
  const stepsRef = useRef(null)

  useEffect(() => {
    const el = stepsRef.current
    if (!el) return
    let interval

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let i = 0
          setActiveStep(0)
          interval = setInterval(() => {
            i = (i + 1) % STEPS.length
            setActiveStep(i)
          }, 1500)
        } else {
          clearInterval(interval)
          setActiveStep(null)
        }
      },
      { threshold: 0.3 }
    )

    observer.observe(el)
    return () => { observer.disconnect(); clearInterval(interval) }
  }, [])

  return (
    <>
      {/* ===== HERO ===== */}
      <section className="hero">
        <span className="eyebrow">
          <span className="dot" />
          Scan • Claim • Earn
        </span>

        <h1 className="display">
          Pick up litter.<br />
          <span className="grad">Earn real points.</span>
        </h1>

        <p className="lead">
          Every bottle and can lying around Topfaith has a barcode.
          Scan it, claim it, and earn points before anyone else does.
          Clean campus. Competitive edge. No excuses.
        </p>
        <p>
          Bonus at the end of every month the top recycler is named Mr/Miss Recyclify gets amazing pizesss and cash prizes.
        </p>

        <div className="hero-cta">
          <button className="btn btn-primary" onClick={onStart}>
            Start scanning →
          </button>
          <button className="btn btn-ghost" onClick={onHowItWorks}>
            How it works
          </button>
        </div>

        <div className="hero-stats">
          <div><b>3 pts</b><small>per unique barcode</small></div>
          <div><b>1×</b><small>each barcode ever</small></div>
          <div><b>Live</b><small>leaderboard</small></div>
        </div>

        {/* floating barcode card */}
        <div className="float-card">
          <div className="float-barcode" />
          <div className="float-row">
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Eva Water 50cl</span>
            <span className="tag">PLASTIC</span>
          </div>
          <div className="float-row">
            <span className="mono" style={{ fontSize: 13, color: 'var(--lime)' }}>#6001254336022</span>
            <span style={{ color: 'var(--lime)', fontWeight: 700 }}>+3 pts</span>
          </div>
        </div>
      </section>

      {/* ===== MISSION: BEFORE / AFTER PHOTOS ===== */}
      <section className="section mission-section">
        <div className="mission-header">
          <span className="eyebrow" style={{ marginBottom: 16 }}>
            <span className="red-dot" style={{ background: 'var(--danger)' }} />
            Our Campus Reality
          </span>
          <h2 className="display">
            Together, we can make<br />
            <span className="grad">Topfaith look like this.</span>
          </h2>
          <p className="sub" style={{ maxWidth: 600 }}>
            The photos below are the same spot on our campus — one taken during a dirty
            period, one after a cleanup. The difference is real. Recyclify turns the act
            of picking up litter into a game everyone wins.
          </p>
        </div>

        <div className="before-after">
          <div className="ba-card">
            {/*
              BEFORE photo: place the dirty-campus.png in /public/dirty-campus.png
              This shows the littered area around the school building
            */}
            <img
              src="/dirty-campus.png"
              alt="Topfaith campus covered in litter"
              className="ba-img"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="ba-label ba-label--bad">
              {/* use a trash-bin SVG here — AlertIcon as placeholder */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14H6L5 6" />
                <path d="M10 11v6M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              This is where we are heading to
            </div>
          </div>

          <div className="ba-arrow">
            {/* right-arrow SVG — direction of change */}
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="var(--lime)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </div>

          <div className="ba-card">
            {/*
              AFTER photo: place the clean-campus.jpg in /public/clean-campus.jpg
              This shows the same spot looking clean and green
            */}
            <img
              src="/clean-campus.png"
              alt="Topfaith campus clean and green"
              className="ba-img"
              onError={(e) => { e.target.style.display = 'none' }}
            />
            <div className="ba-label ba-label--good">
              {/* use a leaf / checkmark SVG here */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="m9 12 2 2 4-4" />
                <circle cx="12" cy="12" r="10" />
              </svg>
              This is what we're building and what we would all love to see
            </div>
          </div>
        </div>

        <div className="mission-cta">
          <p>
            Every barcode you scan is one fewer piece of litter on these grounds.
            <strong style={{ color: 'var(--lime)' }}> Be the reason Topfaith stays clean.</strong>
          </p>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="section" id="how-section">
        <h2 className="display">How it works</h2>
        <p className="sub">Four steps from litter to leaderboard. No friction.</p>
        <div className="steps" ref={stepsRef}>
          {STEPS.map((s, i) => (
            <div
              className={`step${activeStep === i ? ' step--active' : ''}`}
              key={s.num}
            >
              <div className="num">{s.num}</div>
              <div className="step-ico">{s.icon}</div>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ===== WHAT YOU CAN SCAN ===== */}
      <section className="section">
        <h2 className="display">What you can scan</h2>
        <p className="sub">
          Anything with a barcode is fair game — plastic bottles, cans, cartons, packs.
          Here are the common ones you'll find around Topfaith:
        </p>

        <div className="mats">
          <div className="mat">
            <div className="mat-ico"><BottleIcon size={32} color="var(--mint)" /></div>
            <b>Plastic</b>
            <small>Water bottles, PET bottles, juice cups</small>
          </div>
          <div className="mat">
            <div className="mat-ico"><CanIcon size={32} color="var(--mint)" /></div>
            <b>Metal / Cans</b>
            <small>Malt tins, milk tins, energy drink cans</small>
          </div>
          <div className="mat">
            <div className="mat-ico"><BoxIcon size={32} color="var(--mint)" /></div>
            <b>Cartons & Packs</b>
            <small>Juice packs, noodle packs, cardboard boxes</small>
          </div>
        </div>

        {/* Nigerian products grid */}
        <div className="products-grid">
          {NIGERIAN_PRODUCTS.map((p) => (
            <div className="product-card" key={p.name}>
              <div
                className="product-dot"
                style={{ background: p.color + '22', border: `1px solid ${p.color}44`, overflow: 'hidden', padding: 0 }}
              >
                <img
                  src={p.img}
                  alt={p.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'inherit' }}
                  onError={(e) => {
                    e.target.style.display = 'none'
                    e.target.parentElement.style.padding = '8px'
                    e.target.parentElement.innerHTML = `<span style="width:10px;height:10px;border-radius:50%;background:${p.color};display:block"></span>`
                  }}
                />
              </div>
              <div className="product-info">
                <b>{p.name}</b>
                <small>{p.size} · {p.type}</small>
              </div>
              <div className="product-badge">
                <BarcodeIcon size={14} color="var(--mint)" />
              </div>
            </div>
          ))}
        </div>

        <p style={{ color: 'var(--muted)', fontSize: 13, marginTop: 20, fontWeight: 300 }}>
          + any other product with a barcode printed on it. If it has bars, scan it.
        </p>
      </section>
    </>
  )
}
